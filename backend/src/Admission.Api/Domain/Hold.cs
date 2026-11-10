namespace Admission.Api.Domain;

/// <summary>A student's application for a seat. HELD until paid (CONFIRMED), cancelled, or expired.</summary>
public class Hold
{
    public Guid Id { get; set; }
    public Guid ClassId { get; set; }
    public string StudentId { get; set; } = "";
    public HoldStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public SchoolClass Class { get; set; } = null!;
}
