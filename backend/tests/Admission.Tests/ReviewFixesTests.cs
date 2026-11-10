using System.Net;
using System.Text;

namespace Admission.Tests;

public class ReviewFixesTests : IClassFixture<AdmissionApiFactory>
{
    private readonly HttpClient _client;
    public ReviewFixesTests(AdmissionApiFactory factory) => _client = factory.CreateClient();

    [Fact]
    public async Task InvalidUtf8Body_Returns400()
    {
        var bytes = Encoding.UTF8.GetBytes("{\"name\":\"A\",\"totalSeats\":3}").ToList();
        bytes.InsertRange(10, new byte[] { 0xFF, 0xFE });
        var content = new ByteArrayContent(bytes.ToArray());
        content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");

        var response = await _client.PostAsync("/classes", content);

        await response.AssertErrorAsync(HttpStatusCode.BadRequest, "VALIDATION_ERROR");
    }

    [Theory]
    [InlineData("\u200B")]      // zero-width space
    [InlineData("\u200B\u200C")]
    [InlineData("\u00A0")]      // no-break space only
    public async Task NameWithNoLetterOrDigit_Returns400(string name)
    {
        var response = await _client.PostAsync("/classes", Http.Json(new { name, totalSeats = 3 }));
        await response.AssertErrorAsync(HttpStatusCode.BadRequest, "VALIDATION_ERROR");
    }

    [Fact]
    public async Task NameWithLettersInAnyScript_Accepted()
    {
        var response = await _client.PostAsync("/classes", Http.Json(new { name = "ষষ্ঠ শ্রেণি – সকাল", totalSeats = 3 }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task GetHold_OmitsStudentId_ForAnonymousCaller()
    {
        var classId = (await _client.CreateClassAsync("Privacy class", 2)).GetProperty("id").GetString()!;
        var hold = await _client.HoldOkAsync(classId, TestData.NewStudentId());
        var holdId = hold.GetProperty("holdId").GetString()!;

        var body = await (await _client.GetAsync($"/holds/{holdId}")).ReadJsonAsync();

        Assert.False(body.TryGetProperty("studentId", out _), "studentId leaked to a caller without the header");
    }

    [Fact]
    public async Task GetHold_IncludesStudentId_ForOwner()
    {
        var classId = (await _client.CreateClassAsync("Owner class", 2)).GetProperty("id").GetString()!;
        var student = TestData.NewStudentId();
        var holdId = (await _client.HoldOkAsync(classId, student)).GetProperty("holdId").GetString()!;

        var request = new HttpRequestMessage(HttpMethod.Get, $"/holds/{holdId}").WithStudent(student);
        var body = await (await _client.SendAsync(request)).ReadJsonAsync();

        Assert.Equal(student, body.GetProperty("studentId").GetString());
    }

    [Fact]
    public async Task GetHold_OmitsStudentId_ForAnotherStudent()
    {
        var classId = (await _client.CreateClassAsync("Other class", 2)).GetProperty("id").GetString()!;
        var holdId = (await _client.HoldOkAsync(classId, TestData.NewStudentId())).GetProperty("holdId").GetString()!;

        var request = new HttpRequestMessage(HttpMethod.Get, $"/holds/{holdId}").WithStudent(TestData.NewStudentId());
        var body = await (await _client.SendAsync(request)).ReadJsonAsync();

        Assert.False(body.TryGetProperty("studentId", out _));
    }

    [Fact]
    public async Task EveryResponse_HasMillisecondServerTimeHeader()
    {
        var response = await _client.GetAsync("/classes");
        Assert.True(response.Headers.TryGetValues("X-Server-Time", out var values), "missing X-Server-Time");
        var value = values!.Single();
        Assert.Matches(@"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$", value);
        var skew = Math.Abs((DateTime.Parse(value).ToUniversalTime() - DateTime.UtcNow).TotalSeconds);
        Assert.True(skew < 5, $"X-Server-Time is {skew}s away from the test clock");
    }
}
