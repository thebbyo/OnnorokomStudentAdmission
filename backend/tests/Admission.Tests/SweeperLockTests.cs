using System.Diagnostics;
using Admission.Api.Services;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace Admission.Tests;

/// <summary>The sweeper must never wait on a row another transaction holds (no deadlock with apply/confirm).</summary>
public class SweeperLockTests : IClassFixture<AdmissionApiFactory>
{
    private readonly AdmissionApiFactory _factory;
    public SweeperLockTests(AdmissionApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Sweep_SkipsRowsLockedByAnotherTransaction_InsteadOfWaiting()
    {
        await using var conn = new NpgsqlConnection(_factory.ConnectionString);
        await conn.OpenAsync();
        var classId = Guid.NewGuid();
        var lockedHold = Guid.NewGuid();
        var freeHold = Guid.NewGuid();
        await using (var seed = new NpgsqlCommand(
            "INSERT INTO classes (id, name, total_seats) VALUES (@c, 'Sweep lock', 5);" +
            "INSERT INTO holds (id, class_id, student_id, status, expires_at) VALUES " +
            "(@a, @c, '11111111111111111', 'HELD', now() - interval '1 minute')," +
            "(@b, @c, '22222222222222222', 'HELD', now() - interval '1 minute');", conn))
        {
            seed.Parameters.AddWithValue("c", classId);
            seed.Parameters.AddWithValue("a", lockedHold);
            seed.Parameters.AddWithValue("b", freeHold);
            await seed.ExecuteNonQueryAsync();
        }

        // Another transaction (e.g. a confirm) is holding one overdue row.
        await using var other = new NpgsqlConnection(_factory.ConnectionString);
        await other.OpenAsync();
        await using var tx = await other.BeginTransactionAsync();
        await using (var lockCmd = new NpgsqlCommand("SELECT 1 FROM holds WHERE id = @a FOR UPDATE", other, tx))
        {
            lockCmd.Parameters.AddWithValue("a", lockedHold);
            await lockCmd.ExecuteScalarAsync();
        }

        await using var scope = _factory.Services.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<AdmissionService>();
        var timer = Stopwatch.StartNew();
        var sweep = service.ExpireStaleAsync();
        var finished = await Task.WhenAny(sweep, Task.Delay(TimeSpan.FromSeconds(3))) == sweep;
        await tx.RollbackAsync();
        if (!finished) await sweep;

        Assert.True(finished, "sweeper blocked on a locked row");
        Assert.True(timer.Elapsed < TimeSpan.FromSeconds(3));

        await using var check = new NpgsqlCommand("SELECT status FROM holds WHERE id = @b", conn);
        check.Parameters.AddWithValue("b", freeHold);
        Assert.Equal("EXPIRED", (string?)await check.ExecuteScalarAsync());
    }
}
