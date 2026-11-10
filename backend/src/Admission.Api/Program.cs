using Admission.Api.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AdmissionDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Default")
        ?? "Host=localhost;Port=5432;Database=admission;Username=admission;Password=admission"));

var app = builder.Build();

await DatabaseMigrator.MigrateWithRetryAsync(app.Services, app.Logger);

app.Run();

public partial class Program;
