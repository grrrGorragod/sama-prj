using SamaApi.Common;
using SamaApi.Domain;
using SamaApi.Dtos;
using SamaApi.Repositories;

namespace SamaApi.Services;

/// <summary>
/// The "advisor teacher" page: the advisor of the student's classroom (shown first, flagged) and a teacher search.
/// Stars were removed — the advisor is simply the teacher linked to the classroom (Classroom.AdvisorTeacherId).
/// </summary>
public class FavoriteService(CurrentUser current, UserRepository users, AcademicRepository academic)
{
    private const int PageSize = 50;

    private async Task<long?> AdvisorIdAsync(Student student) =>
        student.ClassroomId is { } roomId ? (await academic.GetClassroomAsync(roomId))?.AdvisorTeacherId : null;

    /// <summary>Teachers matching the search; the classroom advisor first, then A–Z.</summary>
    public async Task<PageResult<TeacherView>> SearchAsync(string? search, int page)
    {
        search ??= "";
        var student = await current.StudentAsync();
        if (page < 0 || search.Length > 200) throw BusinessException.Invalid("เงื่อนไขไม่ถูกต้อง");

        var advisorId = await AdvisorIdAsync(student);
        var teachers = (await users.SearchTeachersAsync(search))
            .OrderByDescending(t => t.Id == advisorId)
            .ThenBy(t => t.FullName, StringComparer.CurrentCulture)
            .ToList();

        var items = teachers.Skip(page * PageSize).Take(PageSize)
            .Select(t => new TeacherView(Ids.Str(t.Id), t.FullName, t.Department, t.Id == advisorId, t.Id == advisorId)).ToList();
        return new PageResult<TeacherView>(items, teachers.Count, page, (int)Math.Ceiling(teachers.Count / (double)PageSize));
    }

    /// <summary>The student's classroom advisor (an empty list when the classroom has none).</summary>
    public async Task<List<TeacherView>> ListAsync()
    {
        var student = await current.StudentAsync();
        var advisorId = await AdvisorIdAsync(student);
        if (advisorId is null) return new List<TeacherView>();
        var advisor = await users.GetTeacherAsync(advisorId.Value);
        return advisor is null
            ? new List<TeacherView>()
            : new List<TeacherView> { new(Ids.Str(advisor.Id), advisor.FullName, advisor.Department, true, true) };
    }
}
