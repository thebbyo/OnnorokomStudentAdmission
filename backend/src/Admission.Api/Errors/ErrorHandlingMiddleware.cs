using Npgsql;

namespace Admission.Api.Errors;

/// <summary>Turns every exception into a JSON { error, message } body. Unexpected errors never leak details.</summary>
public class ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex) when (!context.Response.HasStarted)
        {
            var (status, code, message) = Classify(ex);
            if (status >= 500) logger.LogError(ex, "Request failed: {Code}", code);
            await WriteAsync(context, status, code, message);
        }
    }

    public static Task WriteAsync(HttpContext context, int status, string code, string message)
    {
        context.Response.Clear();
        context.Response.StatusCode = status;
        return context.Response.WriteAsJsonAsync(new ErrorBody(code, message));
    }

    private static (int Status, string Code, string Message) Classify(Exception ex) => ex switch
    {
        ApiException api => (api.StatusCode, api.Code, api.Message),
        BadHttpRequestException => (400, ErrorCodes.ValidationError, "The request could not be read."),
        _ when IsBusy(ex) => (503, ErrorCodes.ServiceBusy, "The server is busy. Please retry in a few seconds."),
        OperationCanceledException => (503, ErrorCodes.ServiceBusy, "The request was cancelled. Please retry."),
        _ => (500, ErrorCodes.Internal, "Something went wrong on our side. Please try again."),
    };

    private static bool IsBusy(Exception ex) => ex switch
    {
        NpgsqlException { InnerException: TimeoutException } => true,
        InvalidOperationException ioe when ioe.Message.Contains("pool", StringComparison.OrdinalIgnoreCase)
                                          && ioe.Message.Contains("exhausted", StringComparison.OrdinalIgnoreCase) => true,
        _ => ex.InnerException is not null && IsBusy(ex.InnerException),
    };
}

public record ErrorBody(string Error, string Message);
