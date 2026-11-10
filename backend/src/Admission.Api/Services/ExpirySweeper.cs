namespace Admission.Api.Services;

/// <summary>
/// Persists EXPIRED for overdue holds every few seconds, so seats return without anyone calling the API.
/// Reads already treat overdue HELD rows as EXPIRED; this makes the database agree.
/// </summary>
public class ExpirySweeper(IServiceScopeFactory scopes, AdmissionOptions options, ILogger<ExpirySweeper> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(options.SweepInterval);
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var expired = await scope.ServiceProvider.GetRequiredService<AdmissionService>().ExpireStaleAsync();
                if (expired > 0) logger.LogInformation("Expired {Count} overdue hold(s)", expired);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning(ex, "Expiry sweep failed; will retry");
            }
        }
        while (await WaitAsync(timer, stoppingToken));
    }

    private static async Task<bool> WaitAsync(PeriodicTimer timer, CancellationToken token)
    {
        try { return await timer.WaitForNextTickAsync(token); }
        catch (OperationCanceledException) { return false; }
    }
}
