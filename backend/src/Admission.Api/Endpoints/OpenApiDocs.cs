using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;

namespace Admission.Api.Endpoints;

/// <summary>
/// Swagger metadata. Handlers read the raw request so that every bad input is a clean 400,
/// which means Swagger can't infer bodies or headers: they are described here instead.
/// </summary>
public static class OpenApiDocs
{
    public const string StudentHeader = "X-Student-Id";

    public static RouteHandlerBuilder Doc(
        this RouteHandlerBuilder builder, string tag, string summary, bool needsStudent = false, OpenApiRequestBody? body = null) =>
        builder.WithTags(tag).WithOpenApi(operation =>
        {
            operation.Summary = summary;
            // Documented only: no content-type constraint, so a body sent without a JSON header still gets parsed.
            if (body is not null) operation.RequestBody = body;
            if (needsStudent)
            {
                operation.Parameters.Add(new OpenApiParameter
                {
                    Name = StudentHeader,
                    In = ParameterLocation.Header,
                    Required = true,
                    Description = "The student's 17-digit birth registration number.",
                    Schema = new OpenApiSchema { Type = "string", Pattern = "^[0-9]{17}$" },
                    Example = new OpenApiString("20152691234567890"),
                });
            }
            return operation;
        });

    public static OpenApiRequestBody CreateClassBody() => new()
    {
        Required = true,
        Content =
        {
            ["application/json"] = new OpenApiMediaType
            {
                Schema = new OpenApiSchema
                {
                    Type = "object",
                    Required = new HashSet<string> { "name", "totalSeats" },
                    Properties =
                    {
                        ["name"] = new OpenApiSchema { Type = "string", MaxLength = 200 },
                        ["totalSeats"] = new OpenApiSchema { Type = "integer", Minimum = 1, Maximum = 100000 },
                    },
                },
                Example = new OpenApiObject
                {
                    ["name"] = new OpenApiString("Class 6 - Morning Shift"),
                    ["totalSeats"] = new OpenApiInteger(120),
                },
            },
        },
    };

    public static RouteHandlerBuilder Errors(this RouteHandlerBuilder builder, params int[] statusCodes)
    {
        foreach (var status in statusCodes)
            builder.Produces<Admission.Api.Errors.ErrorBody>(status, "application/json");
        return builder;
    }
}
