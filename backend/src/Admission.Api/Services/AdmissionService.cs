using System.Data;
using Admission.Api.Data;
using Admission.Api.Domain;
using Admission.Api.Errors;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Admission.Api.Services;

/// <summary>
/// Owns every admission rule. Seat-changing operations run in one transaction that first locks the
/// class row (SELECT … FOR UPDATE), so held + confirmed can never exceed total seats — even across processes.
/// </summary>
public class AdmissionService(AdmissionDbContext db, AdmissionOptions options)
{
    private sealed record ClassStatsRow(Guid Id, string Name, int TotalSeats, long Held, long Confirmed);

    // Held seats exclude HELD rows past expires_at, so counts are right even before the sweeper runs.
    private const string StatsSql = """
        SELECT c.id AS "Id", c.name AS "Name", c.total_seats AS "TotalSeats",
               COUNT(h.id) FILTER (WHERE h.status = 'HELD' AND h.expires_at > now()) AS "Held",
               COUNT(h.id) FILTER (WHERE h.status = 'CONFIRMED') AS "Confirmed"
        FROM classes c
        LEFT JOIN holds h ON h.class_id = c.id AND h.status IN ('HELD', 'CONFIRMED')
        """;

    public async Task<ClassView> CreateClassAsync(string name, int totalSeats)
    {
        var entity = new SchoolClass { Id = Guid.NewGuid(), Name = name, TotalSeats = totalSeats };
        db.Classes.Add(entity);
        await db.SaveChangesAsync();
        return new ClassView(entity.Id, entity.Name, entity.TotalSeats, 0, 0, entity.TotalSeats);
    }

    public async Task<IReadOnlyList<ClassView>> ListClassesAsync()
    {
        var rows = await db.Database
            .SqlQueryRaw<ClassStatsRow>(StatsSql + " GROUP BY c.id ORDER BY c.created_at, c.id")
            .ToListAsync();
        return rows.Select(ToView).ToList();
    }

    public async Task<ClassView> GetClassAsync(Guid id)
    {
        var rows = await db.Database
            .SqlQueryRaw<ClassStatsRow>(StatsSql + " WHERE c.id = {0} GROUP BY c.id", id)
            .ToListAsync();
        return rows.Count == 1 ? ToView(rows[0]) : throw ClassNotFound();
    }

    public async Task<HoldView> CreateHoldAsync(Guid classId, string studentId)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);

        // 1. Serialize every seat change for this class (also across backend processes).
        var schoolClass = await LockClassAsync(classId) ?? throw ClassNotFound();

        // 2. Release stale holds first, so an expired-but-unswept hold never blocks a seat or a re-apply.
        await ExpireStaleInClassAsync(classId);

        // 3. One active application per student per class.
        var alreadyActive = await db.Holds.AnyAsync(h => h.ClassId == classId && h.StudentId == studentId
            && (h.Status == HoldStatus.HELD || h.Status == HoldStatus.CONFIRMED));
        if (alreadyActive) throw AlreadyApplied();

        // 4. Seat check under the lock.
        var occupied = await db.Holds.CountAsync(h => h.ClassId == classId
            && (h.Status == HoldStatus.HELD || h.Status == HoldStatus.CONFIRMED));
        if (occupied >= schoolClass.TotalSeats)
            throw ApiException.Conflict(ErrorCodes.SeatsFull, "All seats in this class are taken.");

        var now = await DbNowAsync();
        var hold = new Hold
        {
            Id = Guid.NewGuid(),
            ClassId = classId,
            StudentId = studentId,
            Status = HoldStatus.HELD,
            CreatedAt = now,
            ExpiresAt = TruncateToSeconds(now + options.HoldDuration),
        };
        db.Holds.Add(hold);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw AlreadyApplied(); // second line of defence: partial unique index
        }

        await tx.CommitAsync();
        return new HoldView(hold.Id, classId, schoolClass.Name, studentId, hold.Status, hold.ExpiresAt);
    }

    public async Task<HoldView> GetHoldAsync(Guid holdId)
    {
        var row = await db.Holds.AsNoTracking()
            .Where(h => h.Id == holdId)
            .Select(h => new { Hold = h, ClassName = h.Class.Name })
            .FirstOrDefaultAsync() ?? throw HoldNotFound();
        return ToView(row.Hold, row.ClassName, await DbNowAsync());
    }

    public async Task<HoldView> ConfirmAsync(Guid holdId, string studentId)
    {
        var (tx, schoolClass, hold, now) = await LockForChangeAsync(holdId, studentId);
        await using var _ = tx;

        switch (EffectiveStatus(hold, now))
        {
            case HoldStatus.CONFIRMED:
                break; // idempotent: confirmedSeats does not move again
            case HoldStatus.CANCELLED:
                throw ApiException.Conflict(ErrorCodes.HoldCancelled, "This application was cancelled.");
            case HoldStatus.EXPIRED:
                await PersistExpiredAsync(hold, tx);
                throw HoldExpired();
            default:
                hold.Status = HoldStatus.CONFIRMED;
                hold.ConfirmedAt = now;
                await db.SaveChangesAsync();
                break;
        }

        await tx.CommitAsync();
        return ToView(hold, schoolClass.Name, now);
    }

    public async Task CancelAsync(Guid holdId, string studentId)
    {
        var (tx, _, hold, now) = await LockForChangeAsync(holdId, studentId);
        await using var _ = tx;

        switch (EffectiveStatus(hold, now))
        {
            case HoldStatus.HELD:
                hold.Status = HoldStatus.CANCELLED;
                hold.CancelledAt = now;
                await db.SaveChangesAsync();
                await tx.CommitAsync();
                return;
            case HoldStatus.EXPIRED:
                await PersistExpiredAsync(hold, tx);
                throw HoldExpired();
            default:
                throw ApiException.Conflict(ErrorCodes.HoldNotActive,
                    "Only an application that is still on hold can be cancelled.");
        }
    }

    /// <summary>HELD past its expiry is EXPIRED, whether or not the sweeper has written that yet.</summary>
    public static HoldStatus EffectiveStatus(Hold hold, DateTime dbNow) =>
        hold.Status == HoldStatus.HELD && hold.ExpiresAt <= dbNow ? HoldStatus.EXPIRED : hold.Status;

    /// <summary>
    /// Opens the transaction for confirm/cancel and locks class row, then hold row — the same order as
    /// CreateHoldAsync, so these operations can never deadlock each other. A confirm racing a cancel
    /// or the sweeper is decided exactly once.
    /// </summary>
    private async Task<(Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction Tx, SchoolClass Class, Hold Hold, DateTime Now)>
        LockForChangeAsync(Guid holdId, string studentId)
    {
        var classId = await db.Holds.AsNoTracking().Where(h => h.Id == holdId)
            .Select(h => (Guid?)h.ClassId).FirstOrDefaultAsync() ?? throw HoldNotFound();

        var tx = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
        try
        {
            var schoolClass = await LockClassAsync(classId) ?? throw HoldNotFound();
            var hold = (await db.Holds.FromSqlInterpolated($"SELECT * FROM holds WHERE id = {holdId} FOR UPDATE")
                .ToListAsync()).Single();
            if (hold.StudentId != studentId)
                throw ApiException.Forbidden("This application belongs to a different student.");
            return (tx, schoolClass, hold, await DbNowAsync());
        }
        catch
        {
            await tx.DisposeAsync();
            throw;
        }
    }

    private async Task PersistExpiredAsync(Hold hold, Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction tx)
    {
        if (hold.Status == HoldStatus.EXPIRED) return;
        hold.Status = HoldStatus.EXPIRED;
        await db.SaveChangesAsync();
        await tx.CommitAsync();
    }

    private static HoldView ToView(Hold hold, string className, DateTime dbNow) =>
        new(hold.Id, hold.ClassId, className, hold.StudentId, EffectiveStatus(hold, dbNow), hold.ExpiresAt);

    private static ApiException HoldNotFound() =>
        ApiException.NotFound(ErrorCodes.HoldNotFound, "No application exists with that id.");

    private static ApiException HoldExpired() =>
        ApiException.Conflict(ErrorCodes.HoldExpired, "This seat hold has expired and the seat was released.");

    /// <summary>Row lock on the class. Every seat-changing transaction takes this lock first.</summary>
    private async Task<SchoolClass?> LockClassAsync(Guid id) =>
        (await db.Classes.FromSqlInterpolated($"SELECT * FROM classes WHERE id = {id} FOR UPDATE").ToListAsync())
        .SingleOrDefault();

    /// <summary>
    /// Wall-clock DB time. clock_timestamp(), not now(): now() is frozen at transaction start, and a request
    /// may have waited on the class lock, which would shorten its hold.
    /// </summary>
    private async Task<DateTime> DbNowAsync() =>
        DateTime.SpecifyKind(
            (await db.Database.SqlQueryRaw<DateTime>("SELECT clock_timestamp() AS \"Value\"").ToListAsync()).Single(),
            DateTimeKind.Utc);

    private Task ExpireStaleInClassAsync(Guid classId) =>
        db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE holds SET status = 'EXPIRED' WHERE class_id = {classId} AND status = 'HELD' AND expires_at <= clock_timestamp()");

    /// <summary>The API shows whole seconds, so store whole seconds: clients and server then agree exactly.</summary>
    private static DateTime TruncateToSeconds(DateTime value) =>
        new(value.Ticks - value.Ticks % TimeSpan.TicksPerSecond, DateTimeKind.Utc);

    private static ApiException AlreadyApplied() => ApiException.Conflict(ErrorCodes.AlreadyApplied,
        "This student already has an active application or admission in this class.");

    private static ClassView ToView(ClassStatsRow r)
    {
        var held = (int)r.Held;
        var confirmed = (int)r.Confirmed;
        return new ClassView(r.Id, r.Name, r.TotalSeats, held, confirmed, Math.Max(r.TotalSeats - held - confirmed, 0));
    }

    private static ApiException ClassNotFound() =>
        ApiException.NotFound(ErrorCodes.ClassNotFound, "No class exists with that id.");
}
