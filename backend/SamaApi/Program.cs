using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SamaApi.Common;
using SamaApi.Data;
using SamaApi.Repositories;
using SamaApi.Services;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;
config.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: false); // your secrets, git-ignored

// ---- database (Supabase PostgreSQL) ----
builder.Services.AddDbContext<SamaDbContext>(o =>
    o.UseNpgsql(config.GetConnectionString("Supabase")).UseSnakeCaseNamingConvention());

// ---- session cookie + CSRF ----
Task Reject(RedirectContext<CookieAuthenticationOptions> ctx, int status, string message)
{
    ctx.Response.StatusCode = status;
    return ctx.Response.WriteAsJsonAsync(new { message });
}
// Behind Render's proxy: trust X-Forwarded-For / -Proto so the login rate limit sees each user's own IP
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownNetworks.Clear();
    o.KnownProxies.Clear();
    o.ForwardLimit = null; // read the whole chain (static-site rewrite + Render load balancer)
});

// Cookie-encryption keys: in the database in production (DataProtection:UseDatabase=true) so sessions survive deploys;
// in a local folder during development.
var dataProtection = builder.Services.AddDataProtection().SetApplicationName("SAMA");
if (config.GetValue<bool>("DataProtection:UseDatabase"))
{
    builder.Services.AddDbContext<KeyDbContext>(o => o.UseNpgsql(config.GetConnectionString("Supabase")));
    dataProtection.PersistKeysToDbContext<KeyDbContext>();
}
else dataProtection.PersistKeysToFileSystem(new DirectoryInfo(config["DataProtection:KeysPath"] ?? ".keys"));
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(o =>
{
    o.Cookie.Name = "SAMA_SESSION";
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Lax;
    o.Cookie.SecurePolicy = config.GetValue<bool>("Auth:CookieSecure") ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
    o.ExpireTimeSpan = TimeSpan.FromHours(8);
    o.SlidingExpiration = true;
    o.Events.OnRedirectToLogin = ctx => Reject(ctx, 401, "กรุณาเข้าสู่ระบบ");
    o.Events.OnRedirectToAccessDenied = ctx => Reject(ctx, 403, "คุณไม่มีสิทธิ์ดำเนินการนี้");
});
builder.Services.AddAuthorization(o => o.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
builder.Services.AddAntiforgery(o =>
{
    o.HeaderName = "X-CSRF-TOKEN";
    o.Cookie.Name = "SAMA_CSRF";
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Lax;
});

// ---- limit password guessing ----
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.OnRejected = async (ctx, ct) =>
        await ctx.HttpContext.Response.WriteAsJsonAsync(new { message = "ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" }, ct);
    o.AddPolicy("login", http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
});

// ---- dependency injection: Controller → Service → Repository → DbContext ----
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<UserRepository>();
builder.Services.AddScoped<AcademicRepository>();
builder.Services.AddScoped<ActivityRepository>();
builder.Services.AddScoped<FavoriteRepository>();
builder.Services.AddScoped<CurrentUser>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<AcademicService>();
builder.Services.AddScoped<ActivityService>();
builder.Services.AddScoped<AttachmentService>();
builder.Services.AddScoped<ReviewService>();
builder.Services.AddScoped<ProgressService>();
builder.Services.AddScoped<FavoriteService>();
builder.Services.AddScoped<UserImporter>();
builder.Services.AddSingleton<CsvReportExporter>();
builder.Services.AddSingleton<EvidenceFilePolicy>();

// ---- evidence storage: Supabase Storage when configured, otherwise a local folder (development) ----
var useSupabaseStorage = !string.IsNullOrWhiteSpace(config["Supabase:Url"]) && !string.IsNullOrWhiteSpace(config["Supabase:ServiceKey"]);
if (useSupabaseStorage) builder.Services.AddHttpClient<IEvidenceStorage, SupabaseEvidenceStorage>();
else builder.Services.AddSingleton<IEvidenceStorage, LocalEvidenceStorage>();

builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseUpper));
        o.JsonSerializerOptions.Converters.Add(new TimeOnlyJsonConverter());
    })
    .ConfigureApiBehaviorOptions(o => o.InvalidModelStateResponseFactory = ctx =>
        new BadRequestObjectResult(new { message = "รูปแบบข้อมูลไม่ถูกต้อง กรุณาตรวจสอบข้อมูลที่กรอก" }));

var app = builder.Build();

app.Logger.LogInformation("Evidence storage: {Mode}", useSupabaseStorage ? "Supabase Storage (private bucket)" : "local folder (set Supabase:Url and Supabase:ServiceKey for production)");

// ---- command line: dotnet run -- import --teachers teachers.csv --students students.csv ----
if (args.Length > 0 && args[0] == "import")
{
    string? Option(string name) { var i = Array.IndexOf(args, "--" + name); return i >= 0 && i + 1 < args.Length ? args[i + 1] : null; }
    var teachers = Option("teachers");
    var students = Option("students");
    if (teachers is null && students is null)
    {
        Console.WriteLine("ใช้งาน: dotnet run -- import --teachers teachers.csv --students students.csv");
        return 2;
    }
    foreach (var path in new[] { teachers, students }.Where(p => p is not null))
        if (!File.Exists(path)) { Console.WriteLine($"ไม่พบไฟล์ {path}"); return 2; }

    using var scope = app.Services.CreateScope();
    await DbSeeder.SeedAsync(scope.ServiceProvider.GetRequiredService<SamaDbContext>());
    return await scope.ServiceProvider.GetRequiredService<UserImporter>().RunAsync(teachers, students);
}

if (config.GetValue<bool>("Seed:Enabled"))
{
    using var scope = app.Services.CreateScope();
    try { await DbSeeder.SeedAsync(scope.ServiceProvider.GetRequiredService<SamaDbContext>()); }
    catch (Exception ex) { app.Logger.LogWarning(ex, "Seeding skipped — check the connection string and that database/002_pp_frontend.sql was run"); }
}

app.UseForwardedHeaders();
app.UseMiddleware<ErrorHandlingMiddleware>();
app.UseAuthentication();

// CSRF: every state-changing /api request must carry the token from GET /api/auth/csrf in X-CSRF-TOKEN
app.Use(async (ctx, next) =>
{
    var m = ctx.Request.Method;
    if (ctx.Request.Path.StartsWithSegments("/api") && !HttpMethods.IsGet(m) && !HttpMethods.IsHead(m) && !HttpMethods.IsOptions(m))
        await ctx.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(ctx);
    await next();
});

app.UseAuthorization();
app.UseRateLimiter();
app.MapControllers();
app.Run();
return 0;
