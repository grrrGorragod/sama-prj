using SamaApi.Common;
using SamaApi.Domain;
using SamaApi.Dtos;
using SamaApi.Repositories;

namespace SamaApi.Services;

public class ActivityService(CurrentUser current, ActivityRepository activities, AcademicRepository academic, UserRepository users)
{
    public async Task<ActivityItem> CreateAsync(SaveRequest p)
    {
        var student = await current.StudentAsync();
        var year = AcademicService.ParseYear(p.TermId);
        if (student.ClassroomId is null) throw BusinessException.Invalid("ไม่พบข้อมูลการลงทะเบียนในเทอมนี้");
        var category = await academic.GetCategoryAsync(Ids.Parse(p.CategoryId)) ?? throw BusinessException.Missing();
        var allowed = await academic.GetRequirementsAsync(year);
        if (allowed.All(r => r.CategoryId != category.Id))
            throw BusinessException.Invalid("หมวดกิจกรรมนี้ไม่ได้อยู่ในเกณฑ์ของคุณ");

        var now = DateTime.UtcNow;
        var a = Activity.Create(student, year, category, now);
        a.Edit(student.Id, p.Title, p.Description, p.ActivityDate, p.StartTime, p.EndTime, now);
        await activities.AddAsync(a);
        await activities.SaveAsync();
        return ActivityItem.From(a);
    }

    public async Task<ActivityItem> EditAsync(long id, SaveRequest p)
    {
        var a = await OwnedAsync(id);
        CheckVersion(a, p.ExpectedVersion);
        if (a.AcademicYear != AcademicService.ParseYear(p.TermId) || a.CategoryId != Ids.Parse(p.CategoryId))
            throw BusinessException.Invalid("เปลี่ยนหมวดหรือเทอมของกิจกรรมเดิมไม่ได้");
        a.Edit(a.StudentId, p.Title, p.Description, p.ActivityDate, p.StartTime, p.EndTime, DateTime.UtcNow);
        await activities.SaveAsync();
        return ActivityItem.From(a);
    }

    public async Task<ActivityItem> SubmitAsync(long id, SubmitRequest p)
    {
        var a = await OwnedAsync(id);
        CheckVersion(a, p.ExpectedVersion);
        var reviewer = await users.GetTeacherAsync(Ids.Parse(p.ReviewerId)) ?? throw BusinessException.Missing();
        a.Submit(a.StudentId, reviewer, DateTime.UtcNow);
        await activities.SaveAsync();
        return ActivityItem.From(a);
    }

    public async Task<ActivityDetail> DetailAsync(long id)
    {
        var a = await RequireReadableAsync(id);
        var actors = (await users.GetManyAsync(a.History.Select(h => h.ActorId))).ToDictionary(u => u.Id, u => u.FullName);
        var history = a.History.OrderBy(h => h.Sequence).Select(h => new ActivityEvent(
            h.Sequence, h.FromStatus, h.ToStatus, Ids.Str(h.ActorId), actors.GetValueOrDefault(h.ActorId, "ผู้ใช้เดิม"),
            h.OccurredAt, h.Reason)).ToList();
        return new ActivityDetail(ActivityItem.From(a), history);
    }

    /// <summary>The student who owns it, or the teacher it was sent to. Anyone else gets 404.</summary>
    public async Task<Activity> RequireReadableAsync(long id)
    {
        var a = await activities.GetAsync(id) ?? throw BusinessException.Missing();
        var user = await current.GetAsync();
        var allowed = (user is Student && a.StudentId == user.Id) || (user is Teacher && a.ReviewerId == user.Id);
        return allowed ? a : throw BusinessException.Missing();
    }

    public async Task<PageResult<ActivityItem>> ListAsync(bool review, string? termId, ActivityStatus? status,
        string? categoryId, DateOnly? from, DateOnly? to, string? search, int page, int size)
    {
        search ??= "";
        if (page < 0 || size < 1 || size > 50 || search.Length > 200) throw BusinessException.Invalid("เงื่อนไขการค้นหาไม่ถูกต้อง");
        if (from > to) throw BusinessException.Invalid("วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด");
        var ownerId = review ? (await current.TeacherAsync()).Id : (await current.StudentAsync()).Id;
        int? year = string.IsNullOrWhiteSpace(termId) ? null : AcademicService.ParseYear(termId);
        long? category = string.IsNullOrWhiteSpace(categoryId) ? null : Ids.Parse(categoryId);

        var result = await activities.SearchAsync(ownerId, review, new ActivityFilter(year, status, category, from, to, search), page, size);
        return new PageResult<ActivityItem>(result.Items.Select(ActivityItem.From).ToList(), result.Total, result.Page, result.TotalPages);
    }

    public static void CheckVersion(Activity a, long? expected)
    {
        if (expected is null || a.Version != expected)
            throw BusinessException.Conflict("ข้อมูลเปลี่ยนแปลงแล้ว กรุณาโหลดใหม่ก่อนดำเนินการ");
    }

    private async Task<Activity> OwnedAsync(long id)
    {
        var student = await current.StudentAsync();
        var a = await activities.GetAsync(id) ?? throw BusinessException.Missing();
        return a.StudentId == student.Id ? a : throw BusinessException.Missing();
    }
}
