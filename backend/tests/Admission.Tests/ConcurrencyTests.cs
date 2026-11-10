using System.Net;
using Npgsql;

namespace Admission.Tests;

/// <summary>Rule 1: held + confirmed never exceeds totalSeats, however many requests arrive at once.</summary>
public class ConcurrencyTests : IClassFixture<AdmissionApiFactory>
{
    private readonly AdmissionApiFactory _factory;
    private readonly HttpClient _client;

    public ConcurrencyTests(AdmissionApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private async Task<long> OccupiedSeatsInDbAsync(string classId)
    {
        await using var conn = new NpgsqlConnection(_factory.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(
            "SELECT count(*) FROM holds WHERE class_id = @c AND status IN ('HELD','CONFIRMED')", conn);
        cmd.Parameters.AddWithValue("c", Guid.ParseExact(classId[2..], "N"));
        return (long)(await cmd.ExecuteScalarAsync())!;
    }

    [Fact]
    public async Task ManyStudents_SmallClass_ExactlyNSucceed()
    {
        const int seats = 5, students = 50;
        var classId = (await _client.CreateClassAsync("Race class", seats)).GetProperty("id").GetString()!;

        var responses = await HoldApi.FireTogetherAsync(
            Enumerable.Range(0, students).Select(_ => TestData.NewStudentId())
                .Select(s => (Func<Task<HttpResponseMessage>>)(() => _client.HoldAsync(classId, s))));

        Assert.Equal(seats, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(students - seats, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        foreach (var rejected in responses.Where(r => r.StatusCode == HttpStatusCode.Conflict))
            await rejected.AssertErrorAsync(HttpStatusCode.Conflict, "SEATS_FULL");

        Assert.Equal(seats, await OccupiedSeatsInDbAsync(classId));
        var stats = await _client.GetClassAsync(classId);
        Assert.Equal(seats, stats.GetProperty("heldSeats").GetInt32());
        Assert.Equal(0, stats.GetProperty("availableSeats").GetInt32());
    }

    [Fact]
    public async Task SameStudent_Parallel_OnlyOneHold()
    {
        var classId = (await _client.CreateClassAsync("Same student race", 10)).GetProperty("id").GetString()!;
        var student = TestData.NewStudentId();

        var responses = await HoldApi.FireTogetherAsync(
            Enumerable.Range(0, 20).Select(_ => (Func<Task<HttpResponseMessage>>)(() => _client.HoldAsync(classId, student))));

        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        foreach (var rejected in responses.Where(r => r.StatusCode != HttpStatusCode.Created))
            await rejected.AssertErrorAsync(HttpStatusCode.Conflict, "ALREADY_APPLIED");
        Assert.Equal(1, await OccupiedSeatsInDbAsync(classId));
    }

    [Fact]
    public async Task ManyClasses_Parallel_NoCrossTalk()
    {
        var classIds = new List<string>();
        for (var i = 0; i < 3; i++)
            classIds.Add((await _client.CreateClassAsync($"Parallel class {i}", 3)).GetProperty("id").GetString()!);

        var responses = await HoldApi.FireTogetherAsync(
            Enumerable.Range(0, 30).Select(i => (Func<Task<HttpResponseMessage>>)(() =>
                _client.HoldAsync(classIds[i % 3], TestData.NewStudentId()))));

        Assert.Equal(9, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        foreach (var classId in classIds)
            Assert.Equal(3, await OccupiedSeatsInDbAsync(classId));
    }
}
