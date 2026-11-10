using System.Text.Json;
using Admission.Api.Errors;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;

namespace Admission.Tests;

public class ErrorHandlingMiddlewareTests
{
    private static async Task<(int Status, JsonElement Body)> RunAsync(Exception toThrow)
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        var middleware = new ErrorHandlingMiddleware(_ => throw toThrow, NullLogger<ErrorHandlingMiddleware>.Instance);

        await middleware.InvokeAsync(context);

        context.Response.Body.Position = 0;
        using var doc = await JsonDocument.ParseAsync(context.Response.Body);
        return (context.Response.StatusCode, doc.RootElement.Clone());
    }

    [Fact]
    public async Task ApiException_MapsToItsStatusAndCode()
    {
        var (status, body) = await RunAsync(new ApiException(409, ErrorCodes.SeatsFull, "full"));
        Assert.Equal(409, status);
        Assert.Equal("SEATS_FULL", body.GetProperty("error").GetString());
        Assert.Equal("full", body.GetProperty("message").GetString());
    }

    [Fact]
    public async Task PoolTimeout_Returns503()
    {
        var (status, body) = await RunAsync(new NpgsqlException("timeout", new TimeoutException()));
        Assert.Equal(503, status);
        Assert.Equal("SERVICE_BUSY", body.GetProperty("error").GetString());
    }

    [Fact]
    public async Task PoolExhausted_Returns503()
    {
        var (status, body) = await RunAsync(new InvalidOperationException(
            "The connection pool has been exhausted, either raise 'Max Pool Size' or 'Timeout'"));
        Assert.Equal(503, status);
        Assert.Equal("SERVICE_BUSY", body.GetProperty("error").GetString());
    }

    [Theory]
    [InlineData("40P01")] // deadlock detected
    [InlineData("40001")] // serialization failure
    [InlineData("55P03")] // lock not available
    public async Task TransientLockConflicts_Return503(string sqlState)
    {
        var (status, body) = await RunAsync(new PostgresException("conflict", "ERROR", "ERROR", sqlState));
        Assert.Equal(503, status);
        Assert.Equal("SERVICE_BUSY", body.GetProperty("error").GetString());
    }

    [Fact]
    public async Task BadHttpRequest_Returns400()
    {
        var (status, body) = await RunAsync(new BadHttpRequestException("bad"));
        Assert.Equal(400, status);
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Unknown_Returns500_WithoutLeakingDetails()
    {
        var (status, body) = await RunAsync(new Exception("secret connection string Password=x"));
        Assert.Equal(500, status);
        Assert.Equal("INTERNAL", body.GetProperty("error").GetString());
        Assert.DoesNotContain("secret", body.GetProperty("message").GetString());
    }
}
