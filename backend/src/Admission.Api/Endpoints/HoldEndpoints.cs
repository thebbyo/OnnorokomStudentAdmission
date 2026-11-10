using Admission.Api.Errors;
using Admission.Api.Services;

namespace Admission.Api.Endpoints;

public static class HoldEndpoints
{
    public static void MapHoldEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/classes/{classId}/holds", async (string classId, HttpRequest request, AdmissionService service) =>
        {
            var id = Validation.RequireClassId(classId);
            var studentId = Validation.RequireStudentId(request);
            var hold = CreateHoldResponse.From(await service.CreateHoldAsync(id, studentId));
            return Results.Created($"/holds/{hold.HoldId}", hold);
        })
        .Produces<CreateHoldResponse>(StatusCodes.Status201Created)
        .Errors(400, 404, 409)
        .Doc("Holds", "Apply: hold a seat for HOLD_DURATION_SECONDS. 409 SEATS_FULL / ALREADY_APPLIED.", needsStudent: true);

        app.MapGet("/holds/{holdId}", async (string holdId, HttpRequest request, AdmissionService service) =>
        {
            var id = Validation.RequireHoldId(holdId);
            // The header is optional here; without it (or with another student's) studentId is omitted.
            var caller = request.Headers["X-Student-Id"].Count == 1 ? request.Headers["X-Student-Id"][0] : null;
            return Results.Ok(HoldResponse.From(await service.GetHoldAsync(id), caller));
        })
        .Produces<HoldResponse>()
        .Errors(400, 404)
        .Doc("Holds", "Current status of an application: HELD, CONFIRMED, EXPIRED or CANCELLED.");

        app.MapPost("/holds/{holdId}/confirm", async (string holdId, HttpRequest request, AdmissionService service) =>
        {
            var id = Validation.RequireHoldId(holdId);
            var studentId = Validation.RequireStudentId(request);
            return Results.Ok(ConfirmResponse.From(await service.ConfirmAsync(id, studentId)));
        })
        .Produces<ConfirmResponse>()
        .Errors(400, 403, 404, 409)
        .Doc("Holds", "Pay the admission fee (simulated) and confirm. Idempotent.", needsStudent: true);

        app.MapDelete("/holds/{holdId}", async (string holdId, HttpRequest request, AdmissionService service) =>
        {
            var id = Validation.RequireHoldId(holdId);
            var studentId = Validation.RequireStudentId(request);
            await service.CancelAsync(id, studentId);
            return Results.NoContent();
        })
        .Produces(StatusCodes.Status204NoContent)
        .Errors(400, 403, 404, 409)
        .Doc("Holds", "Cancel a HELD application and release the seat.", needsStudent: true);
    }
}
