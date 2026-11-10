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
        });

        app.MapGet("/holds/{holdId}", async (string holdId, AdmissionService service) =>
            Results.Ok(HoldResponse.From(await service.GetHoldAsync(Validation.RequireHoldId(holdId)))));

        app.MapPost("/holds/{holdId}/confirm", async (string holdId, HttpRequest request, AdmissionService service) =>
        {
            var id = Validation.RequireHoldId(holdId);
            var studentId = Validation.RequireStudentId(request);
            return Results.Ok(ConfirmResponse.From(await service.ConfirmAsync(id, studentId)));
        });

        app.MapDelete("/holds/{holdId}", async (string holdId, HttpRequest request, AdmissionService service) =>
        {
            var id = Validation.RequireHoldId(holdId);
            var studentId = Validation.RequireStudentId(request);
            await service.CancelAsync(id, studentId);
            return Results.NoContent();
        });
    }
}
