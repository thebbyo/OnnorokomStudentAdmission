using Admission.Api.Errors;
using Admission.Api.Services;

namespace Admission.Api.Endpoints;

public static class ClassEndpoints
{
    public static void MapClassEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/classes", async (HttpRequest request, AdmissionService service) =>
        {
            var body = await Validation.ReadJsonObjectAsync(request);
            var (name, totalSeats) = Validation.ParseCreateClass(body);
            var created = await service.CreateClassAsync(name, totalSeats);
            var response = ClassResponse.From(created);
            return Results.Created($"/classes/{response.Id}", response);
        })
        .Produces<ClassResponse>(StatusCodes.Status201Created)
        .Errors(400)
        .Doc("Classes", "Create a class (one shift) with a seat count. School admin.", body: OpenApiDocs.CreateClassBody());

        app.MapGet("/classes", async (AdmissionService service) =>
            Results.Ok((await service.ListClassesAsync()).Select(ClassStatsResponse.From)))
        .Produces<ClassStatsResponse[]>()
        .Doc("Classes", "List every class with held, confirmed and available seats.");

        app.MapGet("/classes/{classId}", async (string classId, AdmissionService service) =>
        {
            var id = Validation.RequireClassId(classId);
            return Results.Ok(ClassStatsResponse.From(await service.GetClassAsync(id)));
        })
        .Produces<ClassStatsResponse>()
        .Errors(400, 404)
        .Doc("Classes", "Seat status of one class.");
    }
}
