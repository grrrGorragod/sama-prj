using Microsoft.EntityFrameworkCore;
using SamaApi.Data;
using SamaApi.Domain;

namespace SamaApi.Services;

/// <summary>
/// Test data for the teacher dashboard: gives every student of an advised classroom a different spread of
/// activities (approved / pending / returned / draft) so the progress numbers are not all the same.
/// Run once after importing the accounts:  dotnet run -- seed-demo
/// Students who already have activities this academic year are skipped, so running it twice adds nothing.
/// </summary>
public class DemoActivitySeeder(SamaDbContext db)
{
    // how far along each student is (1.0 = everything done); picked by classroom + roll number
    private static readonly double[] Levels = { 1.0, 0.85, 0.6, 0.35, 0.0, 0.7, 0.5, 0.2, 0.95, 0.45, 0.8, 0.1, 0.65, 0.3, 0.9 };

    // title + sample descriptions per category code (so the detail page reads like a real activity)
    private static readonly Dictionary<string, (string Title, string[] Details)> Content = new()
    {
        ["01_ADVISOR"] = ("พบครูที่ปรึกษา", new[] { "พูดคุยกับครูที่ปรึกษาเรื่องการเรียนและการวางแผนของตัวเอง", "ติดตามความก้าวหน้าและปรึกษาปัญหากับครูที่ปรึกษา" }),
        ["02_READING"] = ("อ่านหนังสือ", new[] { "อ่านหนังสือนอกเวลาเรียนและสรุปสิ่งที่ได้เรียนรู้", "อ่านหนังสือที่ห้องสมุดและจดบันทึกสาระสำคัญ" }),
        ["03_CAMP"] = ("เข้าค่ายวิชาการ", new[] { "เข้าร่วมค่ายวิชาการและทำกิจกรรมเรียนรู้นอกห้องเรียน" }),
        ["04_EXERCISE"] = ("ออกกำลังกาย", new[] { "ออกกำลังกายและเล่นกีฬากับเพื่อนเพื่อดูแลสุขภาพ", "วิ่งและยืดเหยียดร่างกายเพื่อเสริมความแข็งแรง" }),
        ["05_CLUB"] = ("เข้าร่วมกิจกรรมชุมนุม", new[] { "ร่วมกิจกรรมของชุมนุมที่เลือกกับเพื่อน ๆ" }),
        ["06_VOLUNTEER"] = ("บำเพ็ญประโยชน์ต่อโรงเรียน", new[] { "ช่วยดูแลความสะอาดและจัดสถานที่ในโรงเรียน", "ช่วยงานครูและกิจกรรมส่วนรวมของโรงเรียน" }),
        ["07_COMMUNITY"] = ("บำเพ็ญประโยชน์ต่อชุมชน", new[] { "ร่วมกิจกรรมจิตอาสาเพื่อชุมชนใกล้โรงเรียน", "ช่วยทำความสะอาดและพัฒนาพื้นที่ของชุมชน" }),
    };

    public async Task<int> RunAsync()
    {
        var year = AcademicCalendar.Current();
        var (firstDay, endDay) = AcademicCalendar.RangeOf(year);
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var lastDay = today < endDay ? today : endDay;
        var span = Math.Max(1, lastDay.DayNumber - firstDay.DayNumber);

        var rules = (await db.ActivityRequirements.Include(r => r.Category).Where(r => r.AcademicYear == year).ToListAsync())
            .Where(r => r.Target > 0 && r.Category != null).ToList();
        if (rules.Count == 0)
        {
            Console.WriteLine($"ยังไม่มีเกณฑ์กิจกรรมของปีการศึกษา {year}");
            return 1;
        }

        var students = await db.Students.Include(s => s.Classroom)
            .Where(s => s.Classroom != null && s.Classroom.AcademicYear == year && s.Classroom.AdvisorTeacherId != null)
            .OrderBy(s => s.ClassroomId).ThenBy(s => s.ClassNumber).ToListAsync();
        if (students.Count == 0)
        {
            Console.WriteLine("ยังไม่มีนักเรียนในห้องที่มีครูที่ปรึกษา — นำเข้าบัญชีด้วยคำสั่ง import ก่อน");
            return 1;
        }

        var teachers = await db.Teachers.ToDictionaryAsync(t => t.Id);
        var already = (await db.Activities.Where(a => a.AcademicYear == year).Select(a => a.StudentId).Distinct().ToListAsync()).ToHashSet();
        var rnd = new Random(2569);
        var created = 0;
        var covered = 0;

        foreach (var student in students)
        {
            if (already.Contains(student.Id)) continue;
            var advisor = teachers[student.Classroom!.AdvisorTeacherId!.Value];
            var level = Levels[(int)(((student.ClassroomId ?? 0) * 3 + (student.ClassNumber ?? 0)) % Levels.Length)];
            var made = 0;

            foreach (var rule in rules)
            {
                var category = rule.Category!;
                var n = 0; // numbering restarts for every category
                var fraction = level >= 1.0 ? 1.0 : level <= 0.0 ? 0.0 : Math.Clamp(level + (rnd.NextDouble() - 0.5) * 0.4, 0.05, 0.95);

                int approved, minutes;
                if (rule.Metric == RequirementMetric.Count)
                {
                    approved = (int)Math.Round(fraction * rule.Target);
                    if (level < 1.0) approved = Math.Min(approved, 10);
                    approved = Math.Min(approved, 120);
                    minutes = 60;
                }
                else
                {
                    var total = fraction * rule.Target;
                    approved = total <= 0 ? 0 : Math.Min(40, (int)Math.Ceiling(total / 300.0));
                    minutes = approved == 0 ? 60 : Math.Clamp((int)Math.Ceiling(total / approved / 15.0) * 15, 30, 480);
                }

                for (var i = 0; i < approved; i++)
                    db.Activities.Add(Make(student, category, advisor, year, RandomDay(rnd, firstDay, span), minutes, "approved", rnd, ++n));
                if (level > 0 && rnd.NextDouble() < 0.35)
                    db.Activities.Add(Make(student, category, advisor, year, RandomDay(rnd, firstDay, span), 60, "pending", rnd, ++n));
                if (level > 0 && rnd.NextDouble() < 0.15)
                    db.Activities.Add(Make(student, category, advisor, year, RandomDay(rnd, firstDay, span), 60, "rejected", rnd, ++n));
                if (rnd.NextDouble() < 0.2)
                    db.Activities.Add(Make(student, category, advisor, year, RandomDay(rnd, firstDay, span), 60, "draft", rnd, ++n));
                made += n;
            }

            await db.SaveChangesAsync();
            created += made;
            covered++;
        }

        Console.WriteLine($"สร้างกิจกรรมตัวอย่าง {created} รายการ ให้นักเรียน {covered} คน (ข้ามคนที่มีกิจกรรมอยู่แล้ว {students.Count - covered} คน)");
        return 0;
    }

    private static DateOnly RandomDay(Random rnd, DateOnly firstDay, int span) => firstDay.AddDays(rnd.Next(span + 1));

    private static Activity Make(Student student, ActivityCategory category, Teacher advisor, int year, DateOnly date,
        int minutes, string stage, Random rnd, int number)
    {
        var now = DateTime.SpecifyKind(date.ToDateTime(new TimeOnly(18, 0)).AddHours(-7), DateTimeKind.Utc);
        var start = new TimeOnly(rnd.Next(6, 15), 0);
        var end = start.AddMinutes(minutes);

        var a = Activity.Create(student, year, category, now);
        var (title, details) = Content.TryGetValue(category.Code ?? "", out var c)
            ? c : (category.Name, new[] { "ทำกิจกรรมตามเกณฑ์ของหมวดนี้" });
        a.Edit(student.Id, $"{title} ครั้งที่ {number}", details[rnd.Next(details.Length)], date, start, end, now);
        if (stage == "draft")
        {
            a.ChooseReviewer(advisor);
            return a;
        }
        a.Submit(student.Id, advisor, now);
        if (stage == "approved") a.Approve(advisor.Id, now);
        else if (stage == "rejected") a.ReturnForRevision(advisor.Id, "กรุณาแนบหลักฐานเพิ่มเติมและระบุรายละเอียดให้ชัดเจน", now);
        return a;
    }
}
