using Npgsql;

namespace Admission.Tests;

public class SchemaTests : IClassFixture<AdmissionApiFactory>
{
    private readonly AdmissionApiFactory _factory;
    public SchemaTests(AdmissionApiFactory factory) => _factory = factory;

    private async Task<Guid> InsertClassAsync(NpgsqlConnection conn, int seats = 5)
    {
        var id = Guid.NewGuid();
        await using var cmd = new NpgsqlCommand(
            "INSERT INTO classes (id, name, total_seats) VALUES (@id, 'Schema test', @seats)", conn);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("seats", seats);
        await cmd.ExecuteNonQueryAsync();
        return id;
    }

    private static async Task InsertHoldAsync(NpgsqlConnection conn, Guid classId, string studentId, string status)
    {
        await using var cmd = new NpgsqlCommand(
            "INSERT INTO holds (id, class_id, student_id, status, expires_at) VALUES (@id, @c, @s, @st, now() + interval '10 minutes')",
            conn);
        cmd.Parameters.AddWithValue("id", Guid.NewGuid());
        cmd.Parameters.AddWithValue("c", classId);
        cmd.Parameters.AddWithValue("s", studentId);
        cmd.Parameters.AddWithValue("st", status);
        await cmd.ExecuteNonQueryAsync();
    }

    private async Task<NpgsqlConnection> OpenAsync()
    {
        var conn = new NpgsqlConnection(_factory.ConnectionString);
        await conn.OpenAsync();
        return conn;
    }

    [Fact]
    public async Task TotalSeats_Zero_RejectedByCheckConstraint()
    {
        await using var conn = await OpenAsync();
        var ex = await Assert.ThrowsAsync<PostgresException>(() => InsertClassAsync(conn, seats: 0));
        Assert.Equal("23514", ex.SqlState);
    }

    [Fact]
    public async Task PartialUniqueIndex_BlocksSecondActiveHold()
    {
        await using var conn = await OpenAsync();
        var classId = await InsertClassAsync(conn);
        var student = TestData.NewStudentId();
        await InsertHoldAsync(conn, classId, student, "HELD");

        var ex = await Assert.ThrowsAsync<PostgresException>(() => InsertHoldAsync(conn, classId, student, "HELD"));
        Assert.Equal("23505", ex.SqlState);

        // Inactive rows are not covered by the partial index.
        await InsertHoldAsync(conn, classId, student, "CANCELLED");
        await InsertHoldAsync(conn, classId, student, "EXPIRED");
    }

    [Fact]
    public async Task PartialUniqueIndex_BlocksHeldWhenConfirmedExists()
    {
        await using var conn = await OpenAsync();
        var classId = await InsertClassAsync(conn);
        var student = TestData.NewStudentId();
        await InsertHoldAsync(conn, classId, student, "CONFIRMED");

        var ex = await Assert.ThrowsAsync<PostgresException>(() => InsertHoldAsync(conn, classId, student, "HELD"));
        Assert.Equal("23505", ex.SqlState);
    }

    [Fact]
    public async Task Status_Check_RejectsUnknown()
    {
        await using var conn = await OpenAsync();
        var classId = await InsertClassAsync(conn);
        var ex = await Assert.ThrowsAsync<PostgresException>(
            () => InsertHoldAsync(conn, classId, TestData.NewStudentId(), "FOO"));
        Assert.Equal("23514", ex.SqlState);
    }
}
