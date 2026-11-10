using Admission.Api.Data;
using Admission.Api.Endpoints;
using Admission.Api.Errors;
using Admission.Api.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var options = AdmissionOptions.FromConfiguration(builder.Configuration);
builder.Services.AddSingleton(options);

builder.Services.AddDbContext<AdmissionDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Default")
        ?? "Host=localhost;Port=5432;Database=admission;Username=admission;Password=admission"));
builder.Services.AddScoped<AdmissionService>();
builder.Services.AddHostedService<ExpirySweeper>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(o => o.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
{
    Title = "School Admission API",
    Version = "v1",
    Description = "First-come-first-served seat holds. Student identity is the X-Student-Id header (17 digits). "
                  + "Errors are { \"error\": CODE, \"message\": text }.",
}));

builder.Services.AddCors(cors => cors.AddDefaultPolicy(policy => policy
    .WithOrigins(options.CorsOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()
    .WithExposedHeaders("Date")));

var app = builder.Build();

app.UseMiddleware<ErrorHandlingMiddleware>();
// Empty-bodied framework errors (e.g. 405) still get the { error, message } shape.
app.UseStatusCodePages(async ctx =>
{
    var status = ctx.HttpContext.Response.StatusCode;
    var (code, message) = status switch
    {
        404 => (ErrorCodes.NotFound, "That endpoint does not exist."),
        405 => (ErrorCodes.MethodNotAllowed, "That method is not allowed on this endpoint."),
        415 => (ErrorCodes.ValidationError, "Send the request body as JSON."),
        _ when status < 500 => (ErrorCodes.ValidationError, "The request could not be processed."),
        _ => (ErrorCodes.Internal, "Something went wrong on our side. Please try again."),
    };
    await ErrorHandlingMiddleware.WriteAsync(ctx.HttpContext, status, code, message);
});
app.UseCors();

// API explorer UI for reviewers: http://localhost:8080/swagger
app.UseSwagger();
app.UseSwaggerUI(o => o.DocumentTitle = "School Admission API");

app.MapClassEndpoints();
app.MapHoldEndpoints();
app.MapMeEndpoints();
app.MapFallback((HttpContext ctx) =>
    ErrorHandlingMiddleware.WriteAsync(ctx, 404, ErrorCodes.NotFound, "That endpoint does not exist."));

await DatabaseMigrator.MigrateWithRetryAsync(app.Services, app.Logger);

app.Run();

public partial class Program;
