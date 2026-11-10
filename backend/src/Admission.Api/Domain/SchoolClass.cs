namespace Admission.Api.Domain;

/// <summary>One class-shift with a fixed seat count, e.g. "Class 6 – Morning Shift".</summary>
public class SchoolClass
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public int TotalSeats { get; set; }
    public DateTime CreatedAt { get; set; }
}
