using Microsoft.EntityFrameworkCore;
using SamaApi.Domain;

namespace SamaApi.Data;

/// <summary>
/// Makes sure the reference data exists: 9 activity categories (with code/colour the UI uses), this year's
/// requirements and deadline, and the classrooms 1/1 … 6/10. Only fills what is missing; never deletes.
/// </summary>
public static class DbSeeder
{
    public record CategorySpec(string Code, string Name, string Description, string Color, int Target);

    // Target = how many approved activities are required this year (edit here, or in table Activites_Requirement).
    public static readonly CategorySpec[] Specs =
    {
        new("01_FIELD_TRIP", "แบบบันทึกการศึกษาดูงานนอกสถานที่", "เรียนรู้จากสถานที่จริงนอกโรงเรียน", "purple", 1),
        new("02_MEETING", "แบบบันทึกการพบปะ สนทนา ฯลฯ", "พูดคุย แลกเปลี่ยนความคิดเห็นและเรียนรู้ร่วมกัน", "blue", 1),
        new("03_LECTURE", "แบบบันทึกการฟังบรรยาย/กิจกรรมอื่น ๆ", "ฟังบรรยายและร่วมกิจกรรมเพื่อเปิดโลกทัศน์", "orange", 1),
        new("04_ACADEMIC_CAMP", "แบบบันทึกกิจกรรมค่ายวิชาการ", "เรียนรู้นอกห้องเรียน ค้นหาสิ่งที่ชอบ", "pink", 1),
        new("05_DHARMA_CAMP", "แบบบันทึกกิจกรรมค่ายปฏิบัติธรรม", "ฝึกจิต สงบใจ ปฏิบัติธรรม", "green", 1),
        new("06_SCHOOL_SERVICE", "แบบบันทึกกิจกรรมสาธารณประโยชน์ให้กับโรงเรียน", "เริ่มต้นสิ่งดี ๆ ในโรงเรียนของเรา", "yellow", 1),
        new("07_EXERCISE", "แบบบันทึกการออกกำลังกาย เล่นกีฬา", "ดูแลร่างกาย เติมพลังให้ทุกวัน", "teal", 1),
        new("08_INTERNSHIP", "แบบบันทึกการศึกษาดูงาน/ฝึกงาน", "เรียนรู้การทำงานจริงจากหน่วยงานภายนอก", "red", 1),
        new("09_ADVISOR", "แบบบันทึกการพบและปฏิบัติกิจกรรมและรวมกับครูที่ปรึกษาประจำชั้น", "ทำกิจกรรมร่วมกับครูที่ปรึกษาประจำชั้น", "indigo", 1),
    };

    /// <summary>
    /// One-off clean-up (dotnet run -- reset-categories): deletes every category that is not in <see cref="Specs"/>
    /// together with its requirements, activities, history and attachment rows (+ the evidence files), then seeds the new ones.
    /// </summary>
    public static async Task<int> ResetCategoriesAsync(SamaDbContext db, SamaApi.Services.IEvidenceStorage storage)
    {
        var keep = Specs.Select(s => s.Code).ToHashSet();
        var old = await db.ActivityCategories.Where(c => c.Code == null || !keep.Contains(c.Code)).ToListAsync();
        var ids = old.Select(c => c.Id).ToList();
        if (ids.Count > 0)
        {
            await using var tx = await db.Database.BeginTransactionAsync();
            var activityIds = await db.Activities.Where(a => ids.Contains(a.CategoryId)).Select(a => a.Id).ToListAsync();
            var files = await db.ActivityAttachments.Where(f => activityIds.Contains(f.ActivityId)).Select(f => f.StoragePath).ToListAsync();
            await db.ActivityAttachments.Where(f => activityIds.Contains(f.ActivityId)).ExecuteDeleteAsync();
            await db.Set<ActivityStatusLog>().Where(h => activityIds.Contains(h.ActivityId)).ExecuteDeleteAsync();
            await db.Activities.Where(a => ids.Contains(a.CategoryId)).ExecuteDeleteAsync();
            await db.ActivityRequirements.Where(r => ids.Contains(r.CategoryId)).ExecuteDeleteAsync();
            await db.ActivityCategories.Where(c => ids.Contains(c.Id)).ExecuteDeleteAsync();
            await tx.CommitAsync();
            foreach (var path in files)
                try { await storage.DeleteAsync(path); } catch { /* file already gone */ }
            Console.WriteLine($"ลบหมวดเก่า {ids.Count} หมวด และกิจกรรม {activityIds.Count} รายการที่เกี่ยวข้อง");
        }
        else Console.WriteLine("ไม่มีหมวดเก่าให้ลบ");
        db.ChangeTracker.Clear();
        await SeedAsync(db);
        return 0;
    }

    public static async Task SeedAsync(SamaDbContext db)
    {
        var year = AcademicCalendar.Current();

        // ---- categories (adopt rows created earlier by name, add the rest) ----
        var categories = await db.ActivityCategories.ToListAsync();
        foreach (var spec in Specs)
        {
            var match = categories.FirstOrDefault(c => c.Code == spec.Code)
                        ?? categories.FirstOrDefault(c => string.IsNullOrEmpty(c.Code) && c.Name == spec.Name);
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