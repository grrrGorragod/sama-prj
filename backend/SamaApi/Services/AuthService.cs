using SamaApi.Common;
using SamaApi.Domain;
using SamaApi.Dtos;
using SamaApi.Repositories;

namespace SamaApi.Services;

public class AuthService(UserRepository users, CurrentUser current)
{
    // Used so that an unknown e-mail takes as long as a wrong password.
    private static readonly string DummyHash = BCrypt.Net.BCrypt.HashPassword("not-a-real-password");

    public async Task<User> ValidateAsync(string? email, string? password)
    {
        var user = string.IsNullOrWhiteSpace(email) ? null : await users.FindByEmailAsync(email);
        var ok = BCrypt.Net.BCrypt.Verify(password ?? "", user?.PasswordHash ?? DummyHash);
        if (user is null || !ok) throw BusinessException.Unauthorized("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
        return user;
    }

    public async Task<Me> UpdateProfileAsync(ProfileRequest r)
    {
        var user = await current.GetAsync();
        var email = (r.Email ?? "").Trim().ToLowerInvariant();
        if (await users.EmailTakenAsync(email, user.Id)) throw BusinessException.Invalid("อีเมลนี้ถูกใช้งานแล้ว");
        user.UpdateProfile(r.FullName, email, r.Phone, r.Address);
        await users.SaveAsync();
        return Me.From(user);
    }
}
