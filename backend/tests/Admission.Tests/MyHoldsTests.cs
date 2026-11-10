using System.Net;
using System.Text.Json;

namespace Admission.Tests;

public class MyHoldsTests : IClassFixture<AdmissionApiFactory>
{
    private readonly HttpClient _client;
    public MyHoldsTests(AdmissionApiFactory factory) => _client = factory.CreateClient();

    private Task<HttpResponseMessage> MeAsync(string? studentId) =>
        _client.SendAsync(new HttpRequestMessage(HttpMethod.Get, "/me/holds").WithStudent(studentId));

    private async Task<string> NewClassAsync(string name) =>
        (await _client.CreateClassAsync(name, 5)).GetProperty("id").GetString()!;

    [Fact]
    public async Task Me_ReturnsArrayOfOwnHoldsOnly_NewestFirst()
    {
        var a = TestData.NewStudentId();
        var b = TestData.NewStudentId();
        var first = await NewClassAsync("Me class one");
        var second = await NewClassAsync("Me class two");
        var firstHold = (await _client.HoldOkAsync(first, a)).GetProperty("holdId").GetString();
        await Task.Delay(20);
        var secondHold = (await _client.HoldOkAsync(second, a)).GetProperty("holdId").GetString();
        await _client.HoldOkAsync(first, b);

        var response = await MeAsync(a);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.ReadJsonAsync();
        Assert.Equal(JsonValueKind.Array, body.ValueKind);
        var items = body.EnumerateArray().ToList();
        Assert.Equal(2, items.Count);
        Assert.Equal(secondHold, items[0].GetProperty("holdId").GetString());
        Assert.Equal(firstHold, items[1].GetProperty("holdId").GetString());

        var item = items[0];
        foreach (var key in new[] { "holdId", "classId", "className", "status", "expiresAt" })
            Assert.True(item.TryGetProperty(key, out _), $"missing {key}");
        Assert.Equal(second, item.GetProperty("classId").GetString());
        Assert.Equal("Me class two", item.GetProperty("className").GetString());
        Assert.Equal("HELD", item.GetProperty("status").GetString());
        Assert.EndsWith("Z", item.GetProperty("expiresAt").GetString());
    }

    [Fact]
    public async Task Me_NoHolds_EmptyArray()
    {
        var response = await MeAsync(TestData.NewStudentId());
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("[]", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Me_MissingHeader_400() =>
        await (await MeAsync(null)).AssertErrorAsync(HttpStatusCode.BadRequest, "INVALID_STUDENT_ID");

    [Fact]
    public async Task Me_IncludesConfirmedAndCancelled()
    {
        var student = TestData.NewStudentId();
        var confirmed = (await _client.HoldOkAsync(await NewClassAsync("Paid class"), student)).GetProperty("holdId").GetString()!;
        var cancelled = (await _client.HoldOkAsync(await NewClassAsync("Dropped class"), student)).GetProperty("holdId").GetString()!;
        await _client.ConfirmAsync(confirmed, student);
        await _client.CancelAsync(cancelled, student);

        var items = (await (await MeAsync(student)).ReadJsonAsync()).EnumerateArray()
            .ToDictionary(i => i.GetProperty("holdId").GetString()!, i => i.GetProperty("status").GetString());

        Assert.Equal("CONFIRMED", items[confirmed]);
        Assert.Equal("CANCELLED", items[cancelled]);
    }
}
