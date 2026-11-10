using Admission.Api.Errors;
using Admission.Api.Services;

namespace Admission.Api.Endpoints;

public static class MeEndpoints
{
    public static void MapMeEndpoints(this IEndpointRouteBuilder app)
    {
        // Returns ALL of the student's applications (newest first) as an array — see ASSUMPTIONS.md.
        app.MapGet("/me/holds", async (HttpRequest request, AdmissionService service) =>
        {
            var studentId = Validation.RequireStudentId(request);
            return Results.Ok((await service.ListStudentHoldsAsync(studentId)).Select(MyHoldResponse.From));
        });
    }
}
