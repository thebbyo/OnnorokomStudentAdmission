namespace Admission.Api.Domain;

/// <summary>Public ids are a type prefix plus a 32-char lowercase-hex GUID: c_… for classes, h_… for holds.</summary>
public static class PublicId
{
    private const string ClassPrefix = "c_";
    private const string HoldPrefix = "h_";

    public static string Class(Guid id) => ClassPrefix + id.ToString("N");
    public static string Hold(Guid id) => HoldPrefix + id.ToString("N");

    public static bool TryParseClass(string? value, out Guid id) => TryParse(value, ClassPrefix, out id);
    public static bool TryParseHold(string? value, out Guid id) => TryParse(value, HoldPrefix, out id);

    private static bool TryParse(string? value, string prefix, out Guid id)
    {
        id = Guid.Empty;
        if (value is null || value.Length != prefix.Length + 32 || !value.StartsWith(prefix, StringComparison.Ordinal))
            return false;
        return Guid.TryParseExact(value.AsSpan(prefix.Length), "N", out id);
    }
}
