namespace Admission.Api.Errors;

/// <summary>Machine-readable error codes returned in the "error" field. The UI maps each to plain language.</summary>
public static class ErrorCodes
{
    public const string ValidationError = "VALIDATION_ERROR";
    public const string InvalidStudentId = "INVALID_STUDENT_ID";
    public const string InvalidId = "INVALID_ID";
    public const string Forbidden = "FORBIDDEN";
    public const string ClassNotFound = "CLASS_NOT_FOUND";
    public const string HoldNotFound = "HOLD_NOT_FOUND";
    public const string NotFound = "NOT_FOUND";
    public const string MethodNotAllowed = "METHOD_NOT_ALLOWED";
    public const string SeatsFull = "SEATS_FULL";
    public const string AlreadyApplied = "ALREADY_APPLIED";
    public const string HoldExpired = "HOLD_EXPIRED";
    public const string HoldCancelled = "HOLD_CANCELLED";
    public const string HoldNotActive = "HOLD_NOT_ACTIVE";
    public const string ServiceBusy = "SERVICE_BUSY";
    public const string Internal = "INTERNAL";
}
