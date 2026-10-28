using System.Text.Json;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace SamaApi.Common;

/// <summary>Every failure becomes { "message": "..." } — the shape the web client reads.</summary>
public class ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
{
    public async Task Invoke(HttpContext ctx)
    {
        try { await next(ctx); }
        catch (Exception ex) when (!ctx.Response.HasStarted)
        {
            var (code, message) = ex switch
            {
                BusinessException b => (b.Status, b.Message),
                DbUpdateConcurrencyException => (409, "ข้อมูลเปลี่ยนแปลงแล้ว กรุณาโหลดใหม่ก่อนดำเนินการ"),
                DbUpdateException => (409, "ข้อมูลเปลี่ยนแปลงแล้วหรือมีข้อมูลซ้ำ กรุณาโหลดใหม่"),
                AntiforgeryValidationException => (403, "คุณไม่มีสิทธิ์ หรือเซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง"),
                JsonException or BadHttpRequestException or InvalidDataException => (400, "รูปแบบข้อมูลไม่ถูกต้อง"),
                _ => (500, "เกิดข้อผิดพลาดภายในระบบ")
            };
            if (code == 500 || ex is DbUpdateException and not DbUpdateConcurrencyException)
                logger.LogError(ex, "Request failed: {Path}", ctx.Request.Path);
            ctx.Response.Clear();
            ctx.Response.StatusCode = code;
            await ctx.Response.WriteAsJsonAsync(new { message });
        }
    }
}
