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

public static class HoldApi
{
    public static Task<HttpResponseMessage> HoldAsync(this HttpClient client, string classId, string? studentId) =>
        client.SendAsync(new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds").WithStudent(studentId));

    public static async Task<JsonElement> HoldOkAsync(this HttpClient client, string classId, string studentId)
    {
        var response = await client.HoldAsync(classId, studentId);
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.Created, $"hold expected 201, got {(int)response.StatusCode}: {text}");
        using var doc = JsonDocument.Parse(text);
        return doc.RootElement.Clone();
    }

    public static async Task<JsonElement> GetClassAsync(this HttpClient client, string classId)
    {
        var response = await client.GetAsync($"/classes/{classId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.ReadJsonAsync();
    }

    /// <summary>Starts every request at the same instant, then waits for all of them.</summary>
    public static async Task<HttpResponseMessage[]> FireTogetherAsync(IEnumerable<Func<Task<HttpResponseMessage>>> requests)
    {
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var tasks = requests.Select(send => Task.Run(async () => { await gate.Task; return await send(); })).ToArray();
        gate.SetResult();
        return await Task.WhenAll(tasks);
    }
}
