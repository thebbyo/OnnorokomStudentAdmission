using Admission.Api.Services;
using Microsoft.Extensions.Configuration;

namespace Admission.Tests;

public class AdmissionOptionsTests
{
    private static AdmissionOptions From(params (string Key, string? Value)[] pairs) =>
        AdmissionOptions.FromConfiguration(new ConfigurationBuilder()
            .AddInMemoryCollection(pairs.Select(p => new KeyValuePair<string, string?>(p.Key, p.Value)))
            .Build());

    [Fact]
    public void HoldDuration_DefaultsTo600() => Assert.Equal(TimeSpan.FromSeconds(600), From().HoldDuration);

    [Fact]
    public void HoldDuration_ReadsEnv() =>
        Assert.Equal(TimeSpan.FromSeconds(30), From(("HOLD_DURATION_SECONDS", "30")).HoldDuration);

    [Theory]
    [InlineData("abc")]
    [InlineData("0")]
    [InlineData("-5")]
    [InlineData("")]
    public void HoldDuration_InvalidFallsBackTo600(string raw) =>
        Assert.Equal(TimeSpan.FromSeconds(600), From(("HOLD_DURATION_SECONDS", raw)).HoldDuration);

    [Fact]
    public void SweepInterval_DefaultsTo2() => Assert.Equal(TimeSpan.FromSeconds(2), From().SweepInterval);

    [Fact]
    public void Cors_DefaultsToAnyOrigin() => Assert.Empty(From().CorsOrigins);

    [Fact]
    public void Cors_StarMeansAnyOrigin() => Assert.Empty(From(("CORS_ORIGINS", "*")).CorsOrigins);

    [Fact]
    public void Cors_SplitsAndTrims() =>
        Assert.Equal(new[] { "http://a.test", "http://b.test:3000" },
            From(("CORS_ORIGINS", " http://a.test/ , http://b.test:3000 ")).CorsOrigins);
}
