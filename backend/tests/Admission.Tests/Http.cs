using System.Net;
using System.Text;
using System.Text.Json;

namespace Admission.Tests;

/// <summary>Small helpers so tests talk raw HTTP + JSON, exactly like the evaluators' API tests.</summary>
public static class Http
{
    public static StringContent Json(string raw) => new(raw, Encoding.UTF8, "application/json");

    public static StringContent Json(object body) => Json(JsonSerializer.Serialize(body));

    public static async Task<JsonElement> ReadJsonAsync(this HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(text);
        return doc.RootElement.Clone();
    }

    public static async Task AssertErrorAsync(this HttpResponseMessage response, HttpStatusCode status, string code)
    {
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == status, $"Expected {(int)status}, got {(int)response.StatusCode}: {text}");
        using var doc = JsonDocument.Parse(text);
        Assert.Equal(code, doc.RootElement.GetProperty("error").GetString());
        Assert.False(string.IsNullOrWhiteSpace(doc.RootElement.GetProperty("message").GetString()));
    }

    public static string[] Keys(this JsonElement obj) =>
        obj.EnumerateObject().Select(p => p.Name).OrderBy(n => n, StringComparer.Ordinal).ToArray();

    public static async Task<JsonElement> CreateClassAsync(this HttpClient client, string name = "Test class", int seats = 120)
    {
        var response = await client.PostAsync("/classes", Json(new { name, totalSeats = seats }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await response.ReadJsonAsync();
    }

    public static HttpRequestMessage WithStudent(this HttpRequestMessage request, string? studentId)
    {
        if (studentId is not null) request.Headers.TryAddWithoutValidation("X-Student-Id", studentId);
        return request;
    }
}
