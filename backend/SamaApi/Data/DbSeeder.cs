using Microsoft.EntityFrameworkCore;
using SamaApi.Domain;

namespace SamaApi.Data;

/// <summary>
/// Makes sure the reference data exists: 7 activity categories (with code/colour the UI uses), this year's
/// requirements and deadline, and the classrooms 1/1 … 6/10. Only fills what is missing; never deletes.
/// </summary>
public static class DbSeeder
{
    private record CategorySpec(string Code, string Name, string Description, string Color, int Target, string[] OldNames);

    private static readonly CategorySpec[] Specs =
    {
        new("01_ADVISOR", "การพบพ่อครู/แม่ครู", "พูดคุย วางแผน และเติบโตไปด้วยกัน", "purple", 90, new[] { "การพบพ่อครู/แม่ครู" }),
        new("02_READING", "การอ่านหนังสือ", "เปิดโลกความรู้ผ่านหนังสือเล่มใหม่", "blue", 5, new[] { "การอ่านหนังสือ" }),
        new("03_CAMP", "การเข้าค่ายวิชาการ", "เรียนรู้นอกห้องเรียน ค้นหาสิ่งที่ชอบ", "orange", 1, new[] { "การเข้าค่ายวิชาการ" }),
        new("04_EXERCISE", "การออกกำลังกาย", "ดูแลร่างกาย เติมพลังให้ทุกวัน", "pink", 40, new[] { "การออกกำลังกาย" }),
        new("05_CLUB", "การเข้าร่วมกิจกรรมชุมนุม", "ลงมือทำสิ่งที่ชอบกับเพื่อน ๆ", "green", 1, new[] { "การเข้าร่วมกิจกรรมชุมนุม" }),
        new("06_VOLUNTEER", "การบำเพ็ญประโยชน์ต่อโรงเรียน", "เริ่มต้นสิ่งดี ๆ ในโรงเรียนของเรา", "yellow", 10, new[] { "การบำเพ็ญประโยชน์" }),
        new("07_COMMUNITY", "การบำเพ็ญประโยชน์ต่อชุมชน", "แบ่งปันเวลา สร้างคุณค่าให้สังคม", "teal", 3, new[] { "กิจกรรมอื่น ๆ" }),
    };

    public static async Task SeedAsync(SamaDbContext db)
    {
        var year = AcademicCalendar.Current();

        // ---- categories (adopt rows created earlier by name, add the rest) ----
        var categories = await db.ActivityCategories.ToListAsync();
        foreach (var spec in Specs)
        {
            var match = categories.FirstOrDefault(c => c.Code == spec.Code)
                        ?? categories.FirstOrDefault(c => string.IsNullOrEmpty(c.Code) && (c.Name == spec.Name || spec.OldNames.Contains(c.Name)));
            if (match is null)
            {
                match = ActivityCategory.Create(spec.Code, spec.Name, spec.Description, spec.Color);
                db.ActivityCategories.Add(match);
                categories.Add(match);
            }
            else if (string.IsNullOrEmpty(match.Code)) match.Describe(spec.Code, spec.Name, spec.Description, spec.Color);
        }
        await db.SaveChangesAsync();

        // ---- this year's requirements (rows that exist but have no target get one) ----
        var requirements = await db.ActivityRequirements.Where(r => r.AcademicYear == year).ToListAsync();
        foreach (var spec in Specs)
        {
            var category = categories.First(c => c.Code == spec.Code);
            var row = requirements.FirstOrDefault(r => r.CategoryId == category.Id);
            if (row is null) db.ActivityRequirements.Add(ActivityRequirement.Create(category.Id, year, spec.Target, 0));
            else if (row.Target <= 0) row.Configure(spec.Target, 0);
        }

        if (!await db.AcademicDeadlines.AnyAsync(d => d.AcademicYear == year))
            db.AcademicDeadlines.Add(AcademicDeadline.Create(year, new DateOnly(year - 543 + 1, 3, 31), new TimeOnly(23, 59)));
        await db.SaveChangesAsync();

        // ---- classrooms 1/1 … 6/10 ----
        var existing = (await db.Classrooms.Where(c => c.AcademicYear == year).Select(c => c.Name).ToListAsync()).ToHashSet();
        for (var grade = 1; grade <= 6; grade++)
            for (var room = 1; room <= 10; room++)
            {
                var name = $"{grade}/{room}";
                if (!existing.Contains(name)) db.Classrooms.Add(Classroom.Create(name, year));
            }
        await db.SaveChangesAsync();
    }
}
