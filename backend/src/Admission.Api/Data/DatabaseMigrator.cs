using Microsoft.EntityFrameworkCore;

namespace Admission.Api.Data;

/// <summary>Applies EF migrations at startup, retrying while PostgreSQL is still starting.</summary>
public static class DatabaseMigrator
{
    public static async Task MigrateWithRetryAsync(
        IServiceProvider services, ILogger logger, int attempts = 30, TimeSpan? delay = null)
    {
        var wait = delay ?? TimeSpan.FromSeconds(2);
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await using var scope = services.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AdmissionDbContext>();
                await db.Database.MigrateAsync();
                logger.LogInformation("Database migrations applied");
                return;
            }
            catch (Exception ex) when (attempt < attempts)
            {
                logger.LogWarning("Database not ready (attempt {Attempt}/{Max}): {Message}", attempt, attempts, ex.Message);
                await Task.Delay(wait);
            }
        }
    }
}
