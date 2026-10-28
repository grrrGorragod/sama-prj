using SamaApi.Common;

namespace SamaApi.Domain;

/// <summary>Phone / address / photo — stored in the same "User" row.</summary>
public class Profile
{
    private Profile() { }
    public static Profile Create(string? phone, string? address, string? photo)
    {
        var p = new Profile();
        p.Edit(phone, address, photo);
        return p;
    }
    public string? Phone { get; private set; }
    public string? Address { get; private set; }
    public string? Photo { get; private set; }
    public void Edit(string? phone, string? address, string? photo)
    {
        Phone = Clean(phone);
        Address = Clean(address);
        Photo = Clean(photo);
    }
    private static string? Clean(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
}

public abstract class User
{
    protected User() { }

    public long Id { get; protected set; }
    public string Username { get; protected set; } = "";
    public string PasswordHash { get; protected set; } = "";
    public UserRole Role { get; protected set; }
    public string FullName { get; protected set; } = "";
    public string Email { get; protected set; } = "";
    public DateTime CreatedAt { get; protected set; }
    public Profile? Profile { get; protected set; }

    protected void Init(UserRole role, string email, string passwordHash, string fullName, string? phone)
    {
        Role = role;
        Username = email;
        Email = email;
        PasswordHash = passwordHash;
        FullName = fullName;
        CreatedAt = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(phone)) Profile = Profile.Create(phone, null, null);
    }

    public void UpdateProfile(string fullName, string email, string? phone, string? address)
    {
        if (string.IsNullOrWhiteSpace(fullName) || fullName.Trim().Length > 200) throw BusinessException.Invalid("กรุณากรอกชื่อ");
        if (string.IsNullOrWhiteSpace(email) || email.Length > 254 || !email.Contains('@')) throw BusinessException.Invalid("รูปแบบอีเมลไม่ถูกต้อง");
        if (phone is { Length: > 30 }) throw BusinessException.Invalid("เบอร์โทรยาวเกินไป");
        if (address is { Length: > 1000 }) throw BusinessException.Invalid("ที่อยู่ยาวเกินไป");
        FullName = fullName.Trim();
        Email = email.Trim().ToLowerInvariant();
        if (Profile is null) Profile = Profile.Create(phone, address, null);
        else Profile.Edit(phone, address, Profile.Photo);
    }

    public void ChangePassword(string hash) => PasswordHash = hash;
}

public class Student : User
{
    private Student() { }

    public static Student Create(string email, string passwordHash, string fullName, string studentCode,
        long classroomId, int classNumber, string? phone)
    {
        var s = new Student { StudentCode = studentCode.Trim(), ClassroomId = classroomId, ClassNumber = classNumber };
        s.Init(UserRole.Student, email, passwordHash, fullName, phone);
        return s;
    }

    public string StudentCode { get; private set; } = "";
    public long? ClassroomId { get; private set; }
    public Classroom? Classroom { get; private set; }
    public int? ClassNumber { get; private set; }
}

public class Teacher : User
{
    private Teacher() { }

    public static Teacher Create(string email, string passwordHash, string fullName, string teacherCode, string? phone)
    {
        var t = new Teacher { TeacherCode = teacherCode.Trim() };
        t.Init(UserRole.Teacher, email, passwordHash, fullName, phone);
        return t;
    }

    public string TeacherCode { get; private set; } = "";
    public string Department { get; private set; } = "";
}
