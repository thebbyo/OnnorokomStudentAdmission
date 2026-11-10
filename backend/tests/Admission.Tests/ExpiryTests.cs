using System.Net;
using Npgsql;

namespace Admission.Tests;

/// <summary>Holds last 2 seconds; the sweeper runs every second.</summary>
public class ShortHoldApiFactory : AdmissionApiFactory
{
    public ShortHoldApiFactory() : base(2, new Dictionary<string, string?> { ["SWEEP_INTERVAL_SECONDS"] = "1" }) { }
}

/// <summary>Rule 2: on expiry the seat returns by itself, without anyone calling an API.</summary>
public class ExpiryTests : IClassFixture<ShortHoldApiFactory>
{
    private readonly ShortHoldApiFactory _factory;
    private readonly HttpClient _client;

    public ExpiryTests(ShortHoldApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private async Task<string?> StoredStatusAsync(string holdId)
    {
        await using var conn = new NpgsqlConnection(_factory.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand("SELECT status FROM holds WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", Guid.ParseExact(holdId[2..], "N"));
        return (string?)await cmd.ExecuteScalarAsync();
    }

    private async Task<(string ClassId, string HoldId, string Student)> HoldOnlySeatAsync()
    {
        var classId = (await _client.CreateClassAsync("Expiring class", 1)).GetProperty("id").GetString()!;
        var student = TestData.NewStudentId();
        var holdId = (await _client.HoldOkAsync(classId, student)).GetProperty("holdId").GetString()!;
        return (classId, holdId, student);
    }

    [Fact]
    public async Task Expiry_ReleasesSeat_WithoutApiCalls()
    {
        var (classId, holdId, _) = await HoldOnlySeatAsync();

        await Task.Delay(TimeSpan.FromSeconds(4)); // no API calls while waiting

        Assert.Equal("EXPIRED", await StoredStatusAsync(holdId)); // persisted by the background sweeper
        var stats = await _client.GetClassAsync(classId);
        Assert.Equal(0, stats.GetProperty("heldSeats").GetInt32());
        Assert.Equal(1, stats.GetProperty("availableSeats").GetInt32());
        await _client.HoldOkAsync(classId, TestData.NewStudentId());
    }

    [Fact]
    public async Task Expired_ConfirmIs409_HOLD_EXPIRED_AndCountsUnchanged()
    {
        var (classId, holdId, student) = await HoldOnlySeatAsync();
        await Task.Delay(TimeSpan.FromSeconds(3));

        await (await _client.ConfirmAsync(holdId, student)).AssertErrorAsync(HttpStatusCode.Conflict, "HOLD_EXPIRED");

        var stats = await _client.GetClassAsync(classId);
        Assert.Equal(0, stats.GetProperty("confirmedSeats").GetInt32());
        Assert.Equal(1, stats.GetProperty("availableSeats").GetInt32());
    }

    [Fact]
    public async Task Expired_CancelIs409_HOLD_EXPIRED()
    {
        var (_, holdId, student) = await HoldOnlySeatAsync();
        await Task.Delay(TimeSpan.FromSeconds(3));
        await (await _client.CancelAsync(holdId, student)).AssertErrorAsync(HttpStatusCode.Conflict, "HOLD_EXPIRED");
    }

    [Fact]
    public async Task Expired_GetShowsEXPIRED()
    {
        var (_, holdId, _) = await HoldOnlySeatAsync();
        await Task.Delay(TimeSpan.FromSeconds(3));
        var body = await (await _client.GetAsync($"/holds/{holdId}")).ReadJsonAsync();
        Assert.Equal("EXPIRED", body.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Expired_SameStudentCanReapply()
    {
        var (classId, _, student) = await HoldOnlySeatAsync();
        await Task.Delay(TimeSpan.FromSeconds(3));
        await _client.HoldOkAsync(classId, student);
    }

    [Fact]
    public async Task HoldDuration_ComesFromConfiguration()
    {
        var hold = await _client.HoldOkAsync(
            (await _client.CreateClassAsync("Duration class", 1)).GetProperty("id").GetString()!, TestData.NewStudentId());
        var seconds = (DateTime.Parse(hold.GetProperty("expiresAt").GetString()!).ToUniversalTime() - DateTime.UtcNow).TotalSeconds;
        Assert.InRange(seconds, 0, 3);
    }
}
