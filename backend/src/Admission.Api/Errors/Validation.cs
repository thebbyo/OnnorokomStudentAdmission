using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Admission.Api.Domain;

namespace Admission.Api.Errors;

/// <summary>Strict, hand-rolled input checks so every bad input is a 400 with a clear message (never a 500).</summary>
public static partial class Validation
{
    public const int MaxNameLength = 200;
    public const int MaxTotalSeats = 100_000;
    private const int MaxBodyBytes = 64 * 1024;

    [GeneratedRegex("^[0-9]{17}$")]
    private static partial Regex StudentIdPattern();

    [GeneratedRegex("^-?[0-9]+$")]
    private static partial Regex IntegerToken();

    public static async Task<JsonElement> ReadJsonObjectAsync(HttpRequest request)
    {
        // Strict UTF-8: invalid bytes are a 400, not silently replaced with U+FFFD.
        using var reader = new StreamReader(request.Body, new UTF8Encoding(false, true));
        var buffer = new char[MaxBodyBytes + 1];
        int read;
        try
        {
            read = await reader.ReadBlockAsync(buffer, 0, buffer.Length);
        }
        catch (DecoderFallbackException)
        {
            throw ApiException.BadRequest(ErrorCodes.ValidationError, "The request body must be valid UTF-8 text.");
        }
        if (read > MaxBodyBytes)
            throw ApiException.BadRequest(ErrorCodes.ValidationError, "The request body is too large.");

        var text = new string(buffer, 0, read);
        if (string.IsNullOrWhiteSpace(text))
            throw ApiException.BadRequest(ErrorCodes.ValidationError, "The request body must be a JSON object.");

        try
        {
            using var doc = JsonDocument.Parse(text);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
                throw ApiException.BadRequest(ErrorCodes.ValidationError, "The request body must be a JSON object.");
            return doc.RootElement.Clone();
        }
        catch (JsonException)
        {
            throw ApiException.BadRequest(ErrorCodes.ValidationError, "The request body is not valid JSON.");
        }
    }

    public static string RequireStudentId(HttpRequest request)
    {
        var values = request.Headers["X-Student-Id"];
        var value = values.Count == 1 ? values[0] : null;
        if (value is null || !StudentIdPattern().IsMatch(value))
            throw ApiException.BadRequest(ErrorCodes.InvalidStudentId,
                "The X-Student-Id header must be the student's 17-digit birth registration number.");
        return value;
    }

    public static Guid RequireClassId(string value) =>
        PublicId.TryParseClass(value, out var id)
            ? id
            : throw ApiException.BadRequest(ErrorCodes.InvalidId, "That class id is not valid.");

    public static Guid RequireHoldId(string value) =>
        PublicId.TryParseHold(value, out var id)
            ? id
            : throw ApiException.BadRequest(ErrorCodes.InvalidId, "That application id is not valid.");

    public static (string Name, int TotalSeats) ParseCreateClass(JsonElement body)
    {
        if (!body.TryGetProperty("name", out var nameElement) || nameElement.ValueKind != JsonValueKind.String)
            throw ApiException.BadRequest(ErrorCodes.ValidationError, "\"name\" is required and must be text.");
        var name = nameElement.GetString()!.Trim();
        if (name.Length == 0)
            throw ApiException.BadRequest(ErrorCodes.ValidationError, "\"name\" must not be empty.");
        // Reject names that only contain invisible or punctuation characters (they would show as a blank card).
        if (!name.Any(char.IsLetterOrDigit))
            throw ApiException.BadRequest(ErrorCodes.ValidationError, "\"name\" must contain at least one letter or number.");
        if (name.Length > MaxNameLength)
            throw ApiException.BadRequest(ErrorCodes.ValidationError, $"\"name\" must be at most {MaxNameLength} characters.");

        const string seatsMessage = "\"totalSeats\" must be a whole number from 1 to 100000.";
        if (!body.TryGetProperty("totalSeats", out var seatsElement)
            || seatsElement.ValueKind != JsonValueKind.Number
            || !IntegerToken().IsMatch(seatsElement.GetRawText())
            || !seatsElement.TryGetInt32(out var seats)
            || seats < 1 || seats > MaxTotalSeats)
            throw ApiException.BadRequest(ErrorCodes.ValidationError, seatsMessage);

        return (name, seats);
    }
}
