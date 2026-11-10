namespace Admission.Api.Services;

/// <summary>Runtime settings read from environment variables / configuration.</summary>
public class AdmissionOptions
{
    public TimeSpan HoldDuration { get; init; } = TimeSpan.FromSeconds(600);
    public TimeSpan SweepInterval { get; init; } = TimeSpan.FromSeconds(2);
    /// <summary>Allowed browser origins. Empty means any origin (the API uses no cookies or credentials).</summary>
    public string[] CorsOrigins { get; init; } = [];

    public static AdmissionOptions FromConfiguration(IConfiguration config) => new()
    {
        HoldDuration = TimeSpan.FromSeconds(PositiveInt(config["HOLD_DURATION_SECONDS"], 600)),
        SweepInterval = TimeSpan.FromSeconds(PositiveInt(config["SWEEP_INTERVAL_SECONDS"], 2)),
        CorsOrigins = ParseOrigins(config["CORS_ORIGINS"]),
    };

    private static int PositiveInt(string? raw, int fallback) =>
        int.TryParse(raw, out var value) && value > 0 ? value : fallback;

    private static string[] ParseOrigins(string? raw)
    {
        var origins = (raw ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(o => o.TrimEnd('/'))
            .ToArray();
        return origins.Contains("*") ? [] : origins;
    }
}
