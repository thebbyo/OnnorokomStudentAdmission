namespace Admission.Api.Errors;

/// <summary>An expected, client-facing failure. Rendered by ErrorHandlingMiddleware as { error, message }.</summary>
public class ApiException(int statusCode, string code, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public string Code { get; } = code;

    public static ApiException BadRequest(string code, string message) => new(StatusCodes.Status400BadRequest, code, message);
    public static ApiException NotFound(string code, string message) => new(StatusCodes.Status404NotFound, code, message);
    public static ApiException Forbidden(string message) => new(StatusCodes.Status403Forbidden, ErrorCodes.Forbidden, message);
    public static ApiException Conflict(string code, string message) => new(StatusCodes.Status409Conflict, code, message);
}
