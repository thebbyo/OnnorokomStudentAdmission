using System.Net;

namespace Admission.Tests;

public class HealthAndRequestIdTests : IClassFixture<AdmissionApiFactory>
{
    private readonly HttpClient _client;
    public HealthAndRequestIdTests(AdmissionApiFactory factory) => _client = factory.CreateClient();

    [Fact]
    public async Task Live_Returns200()
    {
        var response = await _client.GetAsync("/health/live");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Ready_Returns200_WhenDatabaseIsUp()
    {
        var response = await _client.GetAsync("/health/ready");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("Healthy", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task EveryResponse_HasRequestId()
    {
        var ok = await _client.GetAsync("/classes");
        Assert.True(ok.Headers.TryGetValues("X-Request-Id", out var values) && values!.Single().Length >= 8);
    }

    [Fact]
    public async Task ClientRequestId_IsEchoed()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/classes");
        request.Headers.Add("X-Request-Id", "req-abc-123");
        var response = await _client.SendAsync(request);
        Assert.Equal("req-abc-123", response.Headers.GetValues("X-Request-Id").Single());
    }

    [Fact]
    public async Task ErrorBody_IncludesRequestId_MatchingHeader()
    {
        var response = await _client.GetAsync($"/classes/c_{Guid.NewGuid():N}");
        var header = response.Headers.GetValues("X-Request-Id").Single();
        var body = await response.ReadJsonAsync();
        Assert.Equal(header, body.GetProperty("requestId").GetString());
        Assert.Equal("CLASS_NOT_FOUND", body.GetProperty("error").GetString());
    }
}
