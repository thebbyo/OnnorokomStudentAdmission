using System.Net;
using System.Text.RegularExpressions;

namespace Admission.Tests;

public class AdmissionSlipTests : IClassFixture<AdmissionApiFactory>
{
    private readonly HttpClient _client;
    public AdmissionSlipTests(AdmissionApiFactory factory) => _client = factory.CreateClient();

    private static readonly Regex AdmissionNo = new(@"^ADM-\d{4}-\d{6}$");

    private async Task<(string ClassId, string HoldId, string Student)> NewHoldAsync(int seats = 10)
    {
        var classId = (await _client.CreateClassAsync("Slip class", seats)).GetProperty("id").GetString()!;
        var student = TestData.NewStudentId();
        var holdId = (await _client.HoldOkAsync(classId, student)).GetProperty("holdId").GetString()!;
        return (classId, holdId, student);
    }

    [Fact]
    public async Task Confirm_AssignsAdmissionNumber_AndConfirmedAt()
    {
        var (_, holdId, student) = await NewHoldAsync();

        var body = await (await _client.ConfirmAsync(holdId, student)).ReadJsonAsync();

        Assert.Matches(AdmissionNo, body.GetProperty("admissionNo").GetString()!);
        Assert.Matches(@"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$", body.GetProperty("confirmedAt").GetString()!);
    }

    [Fact]
    public async Task ConfirmTwice_KeepsTheSameAdmissionNumber()
    {
        var (_, holdId, student) = await NewHoldAsync();

        var first = await (await _client.ConfirmAsync(holdId, student)).ReadJsonAsync();
        var second = await (await _client.ConfirmAsync(holdId, student)).ReadJsonAsync();

        Assert.Equal(first.GetProperty("admissionNo").GetString(), second.GetProperty("admissionNo").GetString());
    }

    [Fact]
    public async Task DifferentStudents_GetDifferentNumbers()
    {
        var (_, a, sa) = await NewHoldAsync();
        var (_, b, sb) = await NewHoldAsync();

        var na = (await (await _client.ConfirmAsync(a, sa)).ReadJsonAsync()).GetProperty("admissionNo").GetString();
        var nb = (await (await _client.ConfirmAsync(b, sb)).ReadJsonAsync()).GetProperty("admissionNo").GetString();

        Assert.NotEqual(na, nb);
    }

    [Fact]
    public async Task HeldApplication_HasNoAdmissionNumberYet()
    {
        var (_, holdId, student) = await NewHoldAsync();

        var request = new HttpRequestMessage(HttpMethod.Get, $"/holds/{holdId}").WithStudent(student);
        var body = await (await _client.SendAsync(request)).ReadJsonAsync();

        Assert.False(body.TryGetProperty("admissionNo", out _));
    }

    [Fact]
    public async Task MyApplications_ShowsAdmissionNumberForConfirmedOnly()
    {
        var (_, paidHold, student) = await NewHoldAsync();
        await _client.ConfirmAsync(paidHold, student);
        var classId = (await _client.CreateClassAsync("Slip unpaid", 5)).GetProperty("id").GetString()!;
        var unpaid = (await _client.HoldOkAsync(classId, student)).GetProperty("holdId").GetString()!;

        var items = (await (await _client.SendAsync(new HttpRequestMessage(HttpMethod.Get, "/me/holds").WithStudent(student))).ReadJsonAsync())
            .EnumerateArray().ToDictionary(i => i.GetProperty("holdId").GetString()!, i => i);

        Assert.Matches(AdmissionNo, items[paidHold].GetProperty("admissionNo").GetString()!);
        Assert.False(items[unpaid].TryGetProperty("admissionNo", out _));
    }
}
