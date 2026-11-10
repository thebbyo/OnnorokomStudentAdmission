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
    }
}
