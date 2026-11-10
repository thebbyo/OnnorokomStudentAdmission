using Admission.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

namespace Admission.Tests;

/// <summary>
/// Boots the real API in-process against a throwaway PostgreSQL container.
/// One instance per test class (IClassFixture); tests isolate themselves by creating their own classes.
/// </summary>
public class AdmissionApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _pg = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithCommand("-c", "max_connections=300", "-c", "fsync=off")
        .Build();

    private readonly Dictionary<string, string?> _settings;

    public AdmissionApiFactory() : this(600) { }

    protected AdmissionApiFactory(int holdDurationSeconds, IDictionary<string, string?>? settings = null)
    {
        _settings = new Dictionary<string, string?>(settings ?? new Dictionary<string, string?>())
        {
            ["HOLD_DURATION_SECONDS"] = holdDurationSeconds.ToString(),
        };
    }

    public string ConnectionString => _pg.GetConnectionString() + ";Maximum Pool Size=50;Timeout=30";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:Default", ConnectionString);
        foreach (var (key, value) in _settings) builder.UseSetting(key, value);
    }

    public AdmissionDbContext CreateDbContext() =>
        new(new DbContextOptionsBuilder<AdmissionDbContext>().UseNpgsql(ConnectionString).Options);

    public async Task InitializeAsync()
    {
        await _pg.StartAsync();
        _ = Server; // boot the host now so migrations run before any test
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        await _pg.DisposeAsync();
    }
}
