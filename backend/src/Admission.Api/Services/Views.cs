using Admission.Api.Domain;

namespace Admission.Api.Services;

public record ClassView(Guid Id, string Name, int TotalSeats, int HeldSeats, int ConfirmedSeats, int AvailableSeats);

public record HoldView(
    Guid Id,
    Guid ClassId,
    string ClassName,
    string StudentId,
    HoldStatus Status,
    DateTime ExpiresAt,
    long? AdmissionNo = null,
    DateTime? ConfirmedAt = null);
