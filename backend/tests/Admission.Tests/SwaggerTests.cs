using System.Net;
using System.Text.Json;

namespace Admission.Tests;

public class SwaggerTests : IClassFixture<AdmissionApiFactory>
{
    private readonly HttpClient _client;
    public SwaggerTests(AdmissionApiFactory factory) => _client = factory.CreateClient();

    [Fact]
    public async Task SwaggerUi_IsServed()
    {
        var response = await _client.GetAsync("/swagger/index.html");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task OpenApiDocument_DescribesEveryEndpoint_WithStudentHeaderAndBody()
    {
        var response = await _client.GetAsync("/swagger/v1/swagger.json");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var paths = doc.RootElement.GetProperty("paths");

        foreach (var path in new[] { "/classes", "/classes/{classId}", "/classes/{classId}/holds", "/holds/{holdId}", "/holds/{holdId}/confirm", "/me/holds" })
            Assert.True(paths.TryGetProperty(path, out _), $"missing {path}");

        // POST /classes documents its JSON body.
        Assert.True(paths.GetProperty("/classes").GetProperty("post").TryGetProperty("requestBody", out _));

        // Student-scoped operations document the X-Student-Id header.
        var holdParams = paths.GetProperty("/classes/{classId}/holds").GetProperty("post").GetProperty("parameters");
        Assert.Contains(holdParams.EnumerateArray(), p =>
            p.GetProperty("name").GetString() == "X-Student-Id" && p.GetProperty("in").GetString() == "header");
        var confirmParams = paths.GetProperty("/holds/{holdId}/confirm").GetProperty("post").GetProperty("parameters");
        Assert.Contains(confirmParams.EnumerateArray(), p => p.GetProperty("name").GetString() == "X-Student-Id");
    }
}
