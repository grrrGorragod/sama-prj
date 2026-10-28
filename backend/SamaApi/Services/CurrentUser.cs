using System.Security.Claims;
using SamaApi.Common;
using SamaApi.Domain;
using SamaApi.Repositories;

namespace SamaApi.Services;

/// <summary>The signed-in user, re-loaded from the database on each request (so removed users lose access at once).</summary>
public class CurrentUser(IHttpContextAccessor http, UserRepository users)
{
    private User? _user;

    public async Task<User> GetAsync()
    {
        if (_user is not null) return _user;
        var raw = http.HttpContext?.User.FindFirstValue("sub");
        if (!long.TryParse(raw, out var id)) throw BusinessException.Unauthorized("กรุณาเข้าสู่ระบบ");
        _user = await users.GetAsync(id) ?? throw BusinessException.Unauthorized("กรุณาเข้าสู่ระบบ");
        return _user;
    }

    public async Task<Student> StudentAsync() =>
        await GetAsync() as Student ?? throw BusinessException.Forbidden("เฉพาะนักเรียนเท่านั้น");

    public async Task<Teacher> TeacherAsync() =>
        await GetAsync() as Teacher ?? throw BusinessException.Forbidden("เฉพาะครูเท่านั้น");
}
