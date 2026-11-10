using System.Globalization;
using Admission.Api.Domain;
using Admission.Api.Services;

namespace Admission.Api.Endpoints;

public record ClassResponse(string Id, string Name, int TotalSeats)
{
    public static ClassResponse From(ClassView v) => new(PublicId.Class(v.Id), v.Name, v.TotalSeats);
}

public record ClassStatsResponse(string Id, string Name, int TotalSeats, int HeldSeats, int ConfirmedSeats, int AvailableSeats)
{
    public static ClassStatsResponse From(ClassView v) =>
        new(PublicId.Class(v.Id), v.Name, v.TotalSeats, v.HeldSeats, v.ConfirmedSeats, v.AvailableSeats);
}

public record CreateHoldResponse(string HoldId, string ClassId, string StudentId, string Status, string ExpiresAt, string ClassName)
{
    public static CreateHoldResponse From(HoldView v) => new(
        PublicId.Hold(v.Id), PublicId.Class(v.ClassId), v.StudentId, v.Status.ToString(), Utc.Format(v.ExpiresAt), v.ClassName);
}

/// <summary>StudentId is only included for the student who owns the hold (their X-Student-Id matches).</summary>
public record HoldResponse(
    string HoldId,
    string ClassId,
    string Status,
    string ExpiresAt,
    string ClassName,
    [property: System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    string? StudentId,
    [property: System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    string? AdmissionNo = null)
{
    public static HoldResponse From(HoldView v, string? callerStudentId)
    {
        var owner = callerStudentId == v.StudentId;
        return new(
            PublicId.Hold(v.Id), PublicId.Class(v.ClassId), v.Status.ToString(), Utc.Format(v.ExpiresAt), v.ClassName,
            owner ? v.StudentId : null,
            owner ? AdmissionNumber.Format(v) : null);
    }
}

public record ConfirmResponse(
    string HoldId,
    string Status,
    string ClassId,
    string ExpiresAt,
    [property: System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    string? AdmissionNo = null,
    [property: System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    string? ConfirmedAt = null)
{
    public static ConfirmResponse From(HoldView v) => new(
        PublicId.Hold(v.Id), v.Status.ToString(), PublicId.Class(v.ClassId), Utc.Format(v.ExpiresAt),
        AdmissionNumber.Format(v), v.ConfirmedAt is { } c ? Utc.Format(c) : null);
}

public record MyHoldResponse(
    string HoldId,
    string ClassId,
    string ClassName,
    string Status,
    string ExpiresAt,
    [property: System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    string? AdmissionNo = null,
    [property: System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    string? ConfirmedAt = null)
{
    public static MyHoldResponse From(HoldView v) => new(
        PublicId.Hold(v.Id), PublicId.Class(v.ClassId), v.ClassName, v.Status.ToString(), Utc.Format(v.ExpiresAt),
        AdmissionNumber.Format(v), v.ConfirmedAt is { } c ? Utc.Format(c) : null);
}

/// <summary>Format ADM-{year of confirmation}-{six digits}, e.g. ADM-2026-000123.</summary>
public static class AdmissionNumber
{
    public static string? Format(HoldView v) =>
        v.AdmissionNo is { } n && v.ConfirmedAt is { } c
            ? $"ADM-{c.Year:D4}-{n:D6}"
            : null;
}

public static class Utc
{
    /// <summary>UTC ISO-8601 with a literal Z, e.g. 2026-11-01T04:10:00Z.</summary>
    public static string Format(DateTime value) =>
        DateTime.SpecifyKind(value, DateTimeKind.Utc).ToUniversalTime()
            .ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture);
}
