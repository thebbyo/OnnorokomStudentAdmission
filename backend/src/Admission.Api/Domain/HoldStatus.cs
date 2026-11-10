namespace Admission.Api.Domain;

/// <summary>Persisted as its name (text). HELD and CONFIRMED occupy a seat.</summary>
public enum HoldStatus
{
    HELD,
    CONFIRMED,
    EXPIRED,
    CANCELLED,
}
