using System.Net;

namespace Admission.Tests;

public class ClassEndpointsTests : IClassFixture<AdmissionApiFactory>
{
    private readonly HttpClient _client;
    public ClassEndpointsTests(AdmissionApiFactory factory) => _client = factory.CreateClient();

    [Fact]
    public async Task Create_Returns201WithContractShape()
    {
        var response = await _client.PostAsync("/classes", Http.Json("""{"name":"Class 6 - Morning Shift","totalSeats":120}"""));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.ReadJsonAsync();
        Assert.Equal(new[] { "id", "name", "totalSeats" }, body.Keys());
        Assert.StartsWith("c_", body.GetProperty("id").GetString());
        Assert.Equal("Class 6 - Morning Shift", body.GetProperty("name").GetString());
        Assert.Equal(120, body.GetProperty("totalSeats").GetInt32());
    }

    [Fact]
    public async Task Create_TrimsName()
    {
        var body = await _client.CreateClassAsync("  Class 7  ");
        Assert.Equal("Class 7", body.GetProperty("name").GetString());
    }

    [Fact]
    public async Task List_IncludesCreatedClassWithZeroCounts()
    {
        var created = await _client.CreateClassAsync("Listed class", 120);
        var id = created.GetProperty("id").GetString();

        var response = await _client.GetAsync("/classes");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var list = await response.ReadJsonAsync();
        var item = list.EnumerateArray().Single(c => c.GetProperty("id").GetString() == id);

        Assert.Equal(new[] { "availableSeats", "confirmedSeats", "heldSeats", "id", "name", "totalSeats" }, item.Keys());
        Assert.Equal(120, item.GetProperty("totalSeats").GetInt32());
        Assert.Equal(0, item.GetProperty("heldSeats").GetInt32());
        Assert.Equal(0, item.GetProperty("confirmedSeats").GetInt32());
        Assert.Equal(120, item.GetProperty("availableSeats").GetInt32());
    }

    [Fact]
    public async Task Get_ReturnsSameShapeAsListItem()
    {
        var created = await _client.CreateClassAsync("Single class", 30);
        var id = created.GetProperty("id").GetString();

        var response = await _client.GetAsync($"/classes/{id}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.ReadJsonAsync();
        Assert.Equal(new[] { "availableSeats", "confirmedSeats", "heldSeats", "id", "name", "totalSeats" }, body.Keys());
        Assert.Equal(id, body.GetProperty("id").GetString());
        Assert.Equal(30, body.GetProperty("availableSeats").GetInt32());
    }

    [Fact]
    public async Task Get_Unknown_404_CLASS_NOT_FOUND()
    {
        var response = await _client.GetAsync($"/classes/c_{Guid.NewGuid():N}");
        await response.AssertErrorAsync(HttpStatusCode.NotFound, "CLASS_NOT_FOUND");
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("c_123")]
    [InlineData("h_0123456789abcdef0123456789abcdef")]
    public async Task Get_MalformedId_400_INVALID_ID(string id)
    {
        var response = await _client.GetAsync($"/classes/{id}");
        await response.AssertErrorAsync(HttpStatusCode.BadRequest, "INVALID_ID");
    }

    [Fact]
    public async Task Get_UnknownBareGuid_404()
    {
        var response = await _client.GetAsync($"/classes/{Guid.NewGuid()}");
        await response.AssertErrorAsync(HttpStatusCode.NotFound, "CLASS_NOT_FOUND");
    }

    [Fact]
    public async Task Get_ByBareGuidOfExistingClass_200()
    {
        var id = (await _client.CreateClassAsync("Bare guid class", 3)).GetProperty("id").GetString()!;
        var response = await _client.GetAsync($"/classes/{Guid.ParseExact(id[2..], "N")}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(id, (await response.ReadJsonAsync()).GetProperty("id").GetString());
    }

    [Theory]
    [InlineData("http://127.0.0.1:3000")]
    [InlineData("http://my-laptop.local:3000")]
    public async Task Cors_AllowsAnyOriginByDefault(string origin)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/classes");
        request.Headers.Add("Origin", origin);
        var response = await _client.SendAsync(request);
        Assert.True(response.Headers.TryGetValues("Access-Control-Allow-Origin", out var values), "missing ACAO");
        Assert.Contains(values!, v => v == "*" || v == origin);
        Assert.True(response.Headers.TryGetValues("Access-Control-Expose-Headers", out var exposed) && exposed.Any(v => v.Contains("Date")));
    }

    [Fact]
    public async Task UnknownRoute_404_JsonError()
    {
        var response = await _client.GetAsync("/nope");
        await response.AssertErrorAsync(HttpStatusCode.NotFound, "NOT_FOUND");
    }

    [Fact]
    public async Task DuplicateNames_Allowed()
    {
        await _client.CreateClassAsync("Same name");
        await _client.CreateClassAsync("Same name");
    }
}
