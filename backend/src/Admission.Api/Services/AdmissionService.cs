using Admission.Api.Data;
using Admission.Api.Domain;
using Admission.Api.Errors;
using Microsoft.EntityFrameworkCore;

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

    private static ClassView ToView(ClassStatsRow r)
    {
        var held = (int)r.Held;
        var confirmed = (int)r.Confirmed;
        return new ClassView(r.Id, r.Name, r.TotalSeats, held, confirmed, Math.Max(r.TotalSeats - held - confirmed, 0));
    }

    private static ApiException ClassNotFound() =>
        ApiException.NotFound(ErrorCodes.ClassNotFound, "No class exists with that id.");
}
