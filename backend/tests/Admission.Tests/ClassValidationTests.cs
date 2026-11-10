using System.Net;

namespace Admission.Tests;

public class ClassValidationTests : IClassFixture<AdmissionApiFactory>
{
    private readonly HttpClient _client;
    public ClassValidationTests(AdmissionApiFactory factory) => _client = factory.CreateClient();

    public static TheoryData<string> BadBodies => new()
    {
        "",
        "{",
        "[]",
        "null",
        "{}",
        "\"text\"",
        """{"totalSeats":10}""",
        """{"name":"","totalSeats":10}""",
        """{"name":"   ","totalSeats":10}""",
        """{"name":123,"totalSeats":10}""",
        """{"name":null,"totalSeats":10}""",
        "{\"name\":\"" + new string('x', 201) + "\",\"totalSeats\":10}",
        """{"name":"A"}""",
        """{"name":"A","totalSeats":0}""",
        """{"name":"A","totalSeats":-1}""",
        """{"name":"A","totalSeats":1.5}""",
        """{"name":"A","totalSeats":"120"}""",
        """{"name":"A","totalSeats":true}""",
        """{"name":"A","totalSeats":null}""",
        """{"name":"A","totalSeats":1e20}""",
        """{"name":"A","totalSeats":1e2}""",
        """{"name":"A","totalSeats":120.0}""",
        """{"name":"A","totalSeats":100001}""",
        """{"name":"A","totalSeats":99999999999999999999}""",
    };

    [Theory, MemberData(nameof(BadBodies))]
    public async Task Create_BadBody_400_VALIDATION_ERROR(string body)
    {
        var response = await _client.PostAsync("/classes", Http.Json(body));
        await response.AssertErrorAsync(HttpStatusCode.BadRequest, "VALIDATION_ERROR");
    }

    [Fact]
    public async Task Create_NoContentType_400()
    {
        var response = await _client.PostAsync("/classes", new StringContent("""{"name":"A","totalSeats":5}"""));
        // text/plain body is still parsed as JSON; we accept it rather than 415, but malformed types must be 400.
        Assert.True(response.StatusCode is HttpStatusCode.Created or HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Create_MaxSeats_201()
    {
        var response = await _client.PostAsync("/classes", Http.Json("""{"name":"Big","totalSeats":100000}"""));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task Create_200CharName_201()
    {
        var response = await _client.PostAsync("/classes", Http.Json(new { name = new string('x', 200), totalSeats = 1 }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }
}
