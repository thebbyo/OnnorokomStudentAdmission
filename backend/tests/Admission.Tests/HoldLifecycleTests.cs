using System.Net;

namespace Admission.Tests;

public class HoldLifecycleTests : IClassFixture<AdmissionApiFactory>
{
    private readonly HttpClient _client;
    public HoldLifecycleTests(AdmissionApiFactory factory) => _client = factory.CreateClient();

    private async Task<(string ClassId, string HoldId, string Student)> NewHoldAsync(int seats = 10)
    {
        var classId = (await _client.CreateClassAsync("Lifecycle class", seats)).GetProperty("id").GetString()!;
        var student = TestData.NewStudentId();
        var hold = await _client.HoldOkAsync(classId, student);
        return (classId, hold.GetProperty("holdId").GetString()!, student);
    }

    [Fact]
    public async Task GetHold_NoHeaderNeeded_ReturnsShape()
    {
        var (classId, holdId, _) = await NewHoldAsync();

        var response = await _client.GetAsync($"/holds/{holdId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.ReadJsonAsync();
        foreach (var key in new[] { "holdId", "classId", "status", "expiresAt" })
            Assert.True(body.TryGetProperty(key, out _), $"missing {key}");
        Assert.Equal(holdId, body.GetProperty("holdId").GetString());
        Assert.Equal(classId, body.GetProperty("classId").GetString());
        Assert.Equal("HELD", body.GetProperty("status").GetString());
        Assert.EndsWith("Z", body.GetProperty("expiresAt").GetString());
    }

    [Fact]
    public async Task GetHold_Unknown_404() =>
        await (await _client.GetAsync($"/holds/h_{Guid.NewGuid():N}")).AssertErrorAsync(HttpStatusCode.NotFound, "HOLD_NOT_FOUND");

    [Fact]
    public async Task GetHold_Malformed_400() =>
        await (await _client.GetAsync("/holds/xyz")).AssertErrorAsync(HttpStatusCode.BadRequest, "INVALID_ID");

    [Fact]
    public async Task Confirm_Own_200_Confirmed_CountsMove()
    {
        var (classId, holdId, student) = await NewHoldAsync();

        var response = await _client.ConfirmAsync(holdId, student);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.ReadJsonAsync();
        Assert.Equal(holdId, body.GetProperty("holdId").GetString());
        Assert.Equal("CONFIRMED", body.GetProperty("status").GetString());
        var stats = await _client.GetClassAsync(classId);
        Assert.Equal(0, stats.GetProperty("heldSeats").GetInt32());
        Assert.Equal(1, stats.GetProperty("confirmedSeats").GetInt32());
        Assert.Equal(9, stats.GetProperty("availableSeats").GetInt32());
    }

    [Fact]
    public async Task Confirm_Twice_Sequential_Idempotent()
    {
        var (classId, holdId, student) = await NewHoldAsync();

        var first = await _client.ConfirmAsync(holdId, student);
        var second = await _client.ConfirmAsync(holdId, student);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.Equal("CONFIRMED", (await second.ReadJsonAsync()).GetProperty("status").GetString());
        Assert.Equal(1, (await _client.GetClassAsync(classId)).GetProperty("confirmedSeats").GetInt32());
    }

    [Fact]
    public async Task Confirm_Parallel10_Idempotent()
    {
        var (classId, holdId, student) = await NewHoldAsync();

        var responses = await HoldApi.FireTogetherAsync(
            Enumerable.Range(0, 10).Select(_ => (Func<Task<HttpResponseMessage>>)(() => _client.ConfirmAsync(holdId, student))));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        Assert.Equal(1, (await _client.GetClassAsync(classId)).GetProperty("confirmedSeats").GetInt32());
    }

    [Fact]
    public async Task Confirm_OtherStudent_403_FORBIDDEN()
    {
        var (_, holdId, _) = await NewHoldAsync();
        await (await _client.ConfirmAsync(holdId, TestData.NewStudentId())).AssertErrorAsync(HttpStatusCode.Forbidden, "FORBIDDEN");
    }

    [Fact]
    public async Task Confirm_MissingHeader_400()
    {
        var (_, holdId, _) = await NewHoldAsync();
        await (await _client.ConfirmAsync(holdId, null)).AssertErrorAsync(HttpStatusCode.BadRequest, "INVALID_STUDENT_ID");
    }

    [Fact]
    public async Task Confirm_Unknown_404() =>
        await (await _client.ConfirmAsync($"h_{Guid.NewGuid():N}", TestData.NewStudentId()))
            .AssertErrorAsync(HttpStatusCode.NotFound, "HOLD_NOT_FOUND");

    [Fact]
    public async Task Confirm_Cancelled_409_HOLD_CANCELLED()
    {
        var (_, holdId, student) = await NewHoldAsync();
        Assert.Equal(HttpStatusCode.NoContent, (await _client.CancelAsync(holdId, student)).StatusCode);

        await (await _client.ConfirmAsync(holdId, student)).AssertErrorAsync(HttpStatusCode.Conflict, "HOLD_CANCELLED");
    }

    [Fact]
    public async Task Cancel_Own_204_SeatReleased_CanReapply()
    {
        var (classId, holdId, student) = await NewHoldAsync(1);

        var response = await _client.CancelAsync(holdId, student);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(0, (await response.Content.ReadAsByteArrayAsync()).Length);
        Assert.Equal(1, (await _client.GetClassAsync(classId)).GetProperty("availableSeats").GetInt32());
        var status = (await (await _client.GetAsync($"/holds/{holdId}")).ReadJsonAsync()).GetProperty("status").GetString();
        Assert.Equal("CANCELLED", status);
        await _client.HoldOkAsync(classId, student);
    }

    [Fact]
    public async Task Cancel_Confirmed_409_HOLD_NOT_ACTIVE()
    {
        var (_, holdId, student) = await NewHoldAsync();
        await _client.ConfirmAsync(holdId, student);
        await (await _client.CancelAsync(holdId, student)).AssertErrorAsync(HttpStatusCode.Conflict, "HOLD_NOT_ACTIVE");
    }

    [Fact]
    public async Task Cancel_Twice_SecondIs409()
    {
        var (_, holdId, student) = await NewHoldAsync();
        await _client.CancelAsync(holdId, student);
        await (await _client.CancelAsync(holdId, student)).AssertErrorAsync(HttpStatusCode.Conflict, "HOLD_NOT_ACTIVE");
    }

    [Fact]
    public async Task Cancel_OtherStudent_403()
    {
        var (_, holdId, _) = await NewHoldAsync();
        await (await _client.CancelAsync(holdId, TestData.NewStudentId())).AssertErrorAsync(HttpStatusCode.Forbidden, "FORBIDDEN");
    }

    [Fact]
    public async Task Cancel_Malformed_400() =>
        await (await _client.CancelAsync("h_nope", TestData.NewStudentId())).AssertErrorAsync(HttpStatusCode.BadRequest, "INVALID_ID");

    [Fact]
    public async Task ConfirmAndCancel_Race_ExactlyOneWins()
    {
        var classId = (await _client.CreateClassAsync("Race confirm/cancel", 50)).GetProperty("id").GetString()!;
        for (var i = 0; i < 20; i++)
        {
            var student = TestData.NewStudentId();
            var holdId = (await _client.HoldOkAsync(classId, student)).GetProperty("holdId").GetString()!;

            var responses = await HoldApi.FireTogetherAsync(new Func<Task<HttpResponseMessage>>[]
            {
                () => _client.ConfirmAsync(holdId, student),
                () => _client.CancelAsync(holdId, student),
            });
            var (confirm, cancel) = (responses[0], responses[1]);

            var final = (await (await _client.GetAsync($"/holds/{holdId}")).ReadJsonAsync()).GetProperty("status").GetString();
            if (confirm.StatusCode == HttpStatusCode.OK)
            {
                await cancel.AssertErrorAsync(HttpStatusCode.Conflict, "HOLD_NOT_ACTIVE");
                Assert.Equal("CONFIRMED", final);
            }
            else
            {
                Assert.Equal(HttpStatusCode.NoContent, cancel.StatusCode);
                await confirm.AssertErrorAsync(HttpStatusCode.Conflict, "HOLD_CANCELLED");
                Assert.Equal("CANCELLED", final);
            }
        }
    }
}
