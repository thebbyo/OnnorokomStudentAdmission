using System.Net;
using System.Text.RegularExpressions;

namespace Admission.Tests;

public class CreateHoldTests : IClassFixture<AdmissionApiFactory>
{
    private readonly HttpClient _client;
    public CreateHoldTests(AdmissionApiFactory factory) => _client = factory.CreateClient();

    private async Task<string> NewClassAsync(int seats = 10) =>
        (await _client.CreateClassAsync("Hold class", seats)).GetProperty("id").GetString()!;

    [Fact]
    public async Task Hold_Returns201ContractShape()
    {
        var classId = await NewClassAsync();
        var student = TestData.NewStudentId();
        var before = DateTime.UtcNow;

        var response = await _client.HoldAsync(classId, student);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.ReadJsonAsync();
        foreach (var key in new[] { "holdId", "classId", "studentId", "status", "expiresAt" })
            Assert.True(body.TryGetProperty(key, out _), $"missing {key}");
        Assert.StartsWith("h_", body.GetProperty("holdId").GetString());
        Assert.Equal(classId, body.GetProperty("classId").GetString());
        Assert.Equal(student, body.GetProperty("studentId").GetString());
        Assert.Equal("HELD", body.GetProperty("status").GetString());

        var expiresAt = body.GetProperty("expiresAt").GetString()!;
        Assert.Matches(new Regex(@"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$"), expiresAt);
        var seconds = (DateTime.Parse(expiresAt).ToUniversalTime() - before).TotalSeconds;
        Assert.InRange(seconds, 595, 605);
    }

    [Fact]
    public async Task Hold_IncrementsHeldSeats()
    {
        var classId = await NewClassAsync(10);
        await _client.HoldOkAsync(classId, TestData.NewStudentId());

        var stats = await _client.GetClassAsync(classId);
        Assert.Equal(1, stats.GetProperty("heldSeats").GetInt32());
        Assert.Equal(9, stats.GetProperty("availableSeats").GetInt32());
    }

    [Fact]
    public async Task Hold_LastSeat_ThenNext409_SEATS_FULL()
    {
        var classId = await NewClassAsync(1);
        await _client.HoldOkAsync(classId, TestData.NewStudentId());

        var response = await _client.HoldAsync(classId, TestData.NewStudentId());
        await response.AssertErrorAsync(HttpStatusCode.Conflict, "SEATS_FULL");
    }

    [Fact]
    public async Task Hold_SameStudentSameClass_409_ALREADY_APPLIED()
    {
        var classId = await NewClassAsync();
        var student = TestData.NewStudentId();
        await _client.HoldOkAsync(classId, student);

        var response = await _client.HoldAsync(classId, student);
        await response.AssertErrorAsync(HttpStatusCode.Conflict, "ALREADY_APPLIED");
    }

    [Fact]
    public async Task Hold_SameStudentFullClass_ReportsAlreadyAppliedNotSeatsFull()
    {
        var classId = await NewClassAsync(1);
        var student = TestData.NewStudentId();
        await _client.HoldOkAsync(classId, student);

        var response = await _client.HoldAsync(classId, student);
        await response.AssertErrorAsync(HttpStatusCode.Conflict, "ALREADY_APPLIED");
    }

    [Fact]
    public async Task Hold_SameStudentDifferentClass_201()
    {
        var student = TestData.NewStudentId();
        await _client.HoldOkAsync(await NewClassAsync(), student);
        await _client.HoldOkAsync(await NewClassAsync(), student);
    }

    [Fact]
    public async Task Hold_MissingHeader_400_INVALID_STUDENT_ID()
    {
        var response = await _client.HoldAsync(await NewClassAsync(), null);
        await response.AssertErrorAsync(HttpStatusCode.BadRequest, "INVALID_STUDENT_ID");
    }

    [Theory]
    [InlineData("")]
    [InlineData("123")]
    [InlineData("1234567890123456a")]
    [InlineData("123456789012345678")]
    [InlineData(" 12345678901234567")]
    [InlineData("1234567890123456")]
    [InlineData("-1234567890123456")]
    public async Task Hold_BadHeader_400_INVALID_STUDENT_ID(string header)
    {
        var response = await _client.HoldAsync(await NewClassAsync(), header);
        await response.AssertErrorAsync(HttpStatusCode.BadRequest, "INVALID_STUDENT_ID");
    }

    [Fact]
    public async Task Hold_UnknownClass_404()
    {
        var response = await _client.HoldAsync($"c_{Guid.NewGuid():N}", TestData.NewStudentId());
        await response.AssertErrorAsync(HttpStatusCode.NotFound, "CLASS_NOT_FOUND");
    }

    [Fact]
    public async Task Hold_MalformedClassId_400()
    {
        var response = await _client.HoldAsync("not-an-id", TestData.NewStudentId());
        await response.AssertErrorAsync(HttpStatusCode.BadRequest, "INVALID_ID");
    }

    [Fact]
    public async Task Hold_IgnoresRequestBody()
    {
        var classId = await NewClassAsync();
        var request = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds") { Content = Http.Json("{garbage") }
            .WithStudent(TestData.NewStudentId());
        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }
}
