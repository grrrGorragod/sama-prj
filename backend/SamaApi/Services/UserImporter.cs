using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using SamaApi.Common;
using SamaApi.Data;
using SamaApi.Domain;

namespace SamaApi.Services;

/// <summary>
/// Creates teacher and student accounts from CSV files (there is no self-registration).
///   teachers.csv : teacher_code, full_name, email, phone, advisor_classroom, password
///   students.csv : student_code, full_name, email, classroom, class_number, phone, password
/// Leave "password" empty to get a random one; those are written to import-passwords-*.csv.
/// Rows already in the database (same e-mail) are skipped; invalid rows are reported and nothing from them is saved.
/// </summary>
public class UserImporter(SamaDbContext db)
{
    private const string Alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    public async Task<int> RunAsync(string? teachersPath, string? studentsPath)
    {
        var year = AcademicCalendar.Current();
        var errors = new List<string>();
        var generated = new List<(string Email, string Name, string Password)>();
        var created = 0;

        var emails = (await db.Users.Select(u => u.Email.ToLower()).ToListAsync()).ToHashSet();
        var rooms = await db.Classrooms.Where(c => c.AcademicYear == year).ToDictionaryAsync(c => c.Name);
        var pending = new List<(User User, string Password, bool Generated)>();
        var advisorOf = new List<(Teacher Teacher, string Room)>();

        // ---------- teachers ----------
        if (teachersPath is not null)
        {
            var codes = (await db.Teachers.Select(t => t.TeacherCode).ToListAsync()).ToHashSet();
            var line = 1;
            foreach (var r in Csv.Read(teachersPath))
            {
                line++;
                var tag = $"teachers.csv บรรทัด {line}";
                var email = Get(r, "email").ToLowerInvariant();
                var name = Get(r, "full_name");
                var code = Get(r, "teacher_code");
                if (name == "" || code == "" || !email.Contains('@')) { errors.Add($"{tag}: ข้อมูลไม่ครบ (teacher_code, full_name, email)"); continue; }
                if (emails.Contains(email)) { errors.Add($"{tag}: มีอีเมล {email} อยู่แล้ว — ข้าม"); continue; }
                if (!codes.Add(code)) { errors.Add($"{tag}: รหัสครู {code} ซ้ำ"); continue; }
                var room = Get(r, "advisor_classroom");
                if (room != "" && !rooms.ContainsKey(room)) { errors.Add($"{tag}: ไม่พบห้อง {room} ในปีการศึกษา {year}"); continue; }
                if (!TryPassword(r, tag, errors, out var password, out var gen)) continue;

                emails.Add(email);
                var teacher = Teacher.Create(email, "", name, code, Get(r, "phone"));
                pending.Add((teacher, password, gen));
                if (room != "") advisorOf.Add((teacher, room));
            }
        }

        // ---------- students ----------
        if (studentsPath is not null)
        {
            var codes = (await db.Students.Select(s => s.StudentCode).ToListAsync()).ToHashSet();
            var taken = (await db.Students.Where(s => s.ClassroomId != null && s.ClassNumber != null)
                .Select(s => new { s.ClassroomId, s.ClassNumber }).ToListAsync())
                .Select(s => (s.ClassroomId!.Value, s.ClassNumber!.Value)).ToHashSet();
            var line = 1;
            foreach (var r in Csv.Read(studentsPath))
            {
                line++;
                var tag = $"students.csv บรรทัด {line}";
                var email = Get(r, "email").ToLowerInvariant();
                var name = Get(r, "full_name");
                var code = Get(r, "student_code");
                if (name == "" || code == "" || !email.Contains('@') || !int.TryParse(Get(r, "class_number"), out var roll) || roll <= 0)
                { errors.Add($"{tag}: ข้อมูลไม่ครบหรือไม่ถูกต้อง (student_code, full_name, email, classroom, class_number)"); continue; }
                if (emails.Contains(email)) { errors.Add($"{tag}: มีอีเมล {email} อยู่แล้ว — ข้าม"); continue; }
                if (!rooms.TryGetValue(Get(r, "classroom"), out var room)) { errors.Add($"{tag}: ไม่พบห้อง '{Get(r, "classroom")}' ในปีการศึกษา {year}"); continue; }
                if (!codes.Add(code)) { errors.Add($"{tag}: รหัสนักเรียน {code} ซ้ำ"); continue; }
                if (!taken.Add((room.Id, roll))) { errors.Add($"{tag}: เลขที่ {roll} ในห้อง {room.Name} ถูกใช้แล้ว"); continue; }
                if (!TryPassword(r, tag, errors, out var password, out var gen)) continue;

                emails.Add(email);
                pending.Add((Student.Create(email, "", name, code, room.Id, roll, Get(r, "phone")), password, gen));
            }
        }

        // ---------- hash passwords (slow by design) in parallel, then save ----------
        var hashed = pending.AsParallel().AsOrdered().Select(p => (p.User, Hash: BCrypt.Net.BCrypt.HashPassword(p.Password), p.Password, p.Generated)).ToList();
        foreach (var h in hashed)
        {
            h.User.ChangePassword(h.Hash);
            await db.Users.AddAsync(h.User);
            created++;
            if (h.Generated) generated.Add((h.User.Email, h.User.FullName, h.Password));
        }
        await db.SaveChangesAsync();

        foreach (var (teacher, room) in advisorOf) rooms[room].AssignAdvisor(teacher.Id);
        await db.SaveChangesAsync();

        // ---------- report ----------
        Console.WriteLine($"สร้างบัญชีแล้ว {created} บัญชี");
        foreach (var e in errors) Console.WriteLine("  ! " + e);
        if (generated.Count > 0)
        {
            var file = $"import-passwords-{DateTime.Now:yyyyMMdd-HHmmss}.csv";
            var sb = new StringBuilder("\uFEFFemail,full_name,password\r\n");
            foreach (var g in generated) sb.Append(Csv.Cell(g.Email)).Append(',').Append(Csv.Cell(g.Name)).Append(',').Append(Csv.Cell(g.Password)).Append("\r\n");
            await File.WriteAllTextAsync(file, sb.ToString(), new UTF8Encoding(false));
            Console.WriteLine($"รหัสผ่านที่สุ่มให้ {generated.Count} บัญชี บันทึกไว้ที่ {Path.GetFullPath(file)} (แจกแล้วลบไฟล์นี้ทิ้ง)");
        }
        return errors.Count == 0 ? 0 : 1;
    }

    private static string Get(Dictionary<string, string> row, string key) => row.TryGetValue(key, out var v) ? v.Trim() : "";

    private static bool TryPassword(Dictionary<string, string> row, string tag, List<string> errors, out string password, out bool generated)
    {
        password = Get(row, "password");
        generated = password == "";
        if (generated) { password = RandomPassword(); return true; }
        if (password.Length < 8) { errors.Add($"{tag}: รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร"); return false; }
        return true;
    }

    private static string RandomPassword() =>
        new(Enumerable.Range(0, 12).Select(_ => Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)]).ToArray());
}
