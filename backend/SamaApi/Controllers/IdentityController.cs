using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using SamaApi.Dtos;
using SamaApi.Services;

namespace SamaApi.Controllers;

[ApiController]
[Route("api")]
public class IdentityController(AuthService auth, CurrentUser current, IAntiforgery antiforgery) : ControllerBase
{
    [AllowAnonymous, HttpGet("auth/config")]
    public object Configuration() => new { provider = "local", demoAvailable = false };

    [AllowAnonymous, HttpGet("auth/csrf")]
    public object Csrf()
    {
        var tokens = antiforgery.GetAndStoreTokens(HttpContext);
        Response.Headers.CacheControl = "no-store";
        return new { token = tokens.RequestToken, headerName = "X-CSRF-TOKEN" };
    }

    [AllowAnonymous, EnableRateLimiting("login"), HttpPost("auth/login")]
    public async Task<Me> Login(LoginRequest body)
    {
        var user = await auth.ValidateAsync(body.Email, body.Password);
        var claims = new List<Claim>
        {
            new("sub", user.Id.ToString()),
            new("name", user.FullName),
            new(ClaimTypes.Role, user.Role.ToString().ToUpperInvariant())
        };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme));
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal);
        return Me.From(user);
    }

    [HttpPost("auth/logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    [HttpGet("me")]
    public async Task<Me> CurrentMe() => Me.From(await current.GetAsync());

    [HttpPatch("me")]
    public Task<Me> Update(ProfileRequest body) => auth.UpdateProfileAsync(body);
}
