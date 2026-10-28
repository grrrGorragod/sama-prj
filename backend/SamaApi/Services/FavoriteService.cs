using SamaApi.Common;
using SamaApi.Domain;
using SamaApi.Dtos;
using SamaApi.Repositories;

namespace SamaApi.Services;

/// <summary>
/// Teachers a student has starred. The advisor of the student's classroom is always starred (locked, listed first)
/// but the star gives no extra rights: classroom dashboards are tied to Classroom.AdvisorTeacherId, not to stars.
/// </summary>
public class FavoriteService(CurrentUser current, UserRepository users, FavoriteRepository favorites, AcademicRepository academic)
{
    private const int PageSize = 50;

    private async Task<long?> AdvisorIdAsync(Student student) =>
        student.ClassroomId is { } roomId ? (await academic.GetClassroomAsync(roomId))?.AdvisorTeacherId : null;

    /// <summary>Teachers matching the search; the classroom advisor first, then the student's favourites, then A–Z.</summary>
    public async Task<PageResult<TeacherView>> SearchAsync(string? search, int page)
    {
        search ??= "";
        var student = await current.StudentAsync();
        if (page < 0 || search.Length > 200) throw BusinessException.Invalid("เงื่อนไขไม่ถูกต้อง");

        var advisorId = await AdvisorIdAsync(student);
        var favoriteIds = (await favorites.ListAsync(student.Id)).Select(f => f.TeacherId).ToHashSet();
        var teachers = (await users.SearchTeachersAsync(search))
            .OrderByDescending(t => t.Id == advisorId)
            .ThenByDescending(t => favoriteIds.Contains(t.Id))
            .ThenBy(t => t.FullName, StringComparer.CurrentCulture)
            .ToList();

        var items = teachers.Skip(page * PageSize).Take(PageSize)
            .Select(t => new TeacherView(Ids.Str(t.Id), t.FullName, t.Department,
                t.Id == advisorId || favoriteIds.Contains(t.Id), t.Id == advisorId)).ToList();
        return new PageResult<TeacherView>(items, teachers.Count, page, (int)Math.Ceiling(teachers.Count / (double)PageSize));
    }

    public async Task<List<TeacherView>> ListAsync()
    {
        var student = await current.StudentAsync();
        var advisorId = await AdvisorIdAsync(student);
        var starred = (await favorites.ListAsync(student.Id)).Select(f => f.Teacher!).ToList();
        if (advisorId is { } id && starred.All(t => t.Id != id) && await users.GetTeacherAsync(id) is { } advisor)
            starred.Add(advisor);
        return starred
            .OrderByDescending(t => t.Id == advisorId).ThenBy(t => t.FullName)
            .Select(t => new TeacherView(Ids.Str(t.Id), t.FullName, t.Department, true, t.Id == advisorId)).ToList();
    }

    public async Task AddAsync(long teacherId)
    {
        var student = await current.StudentAsync();
        _ = await users.GetTeacherAsync(teacherId) ?? throw BusinessException.Missing();
        if (teacherId == await AdvisorIdAsync(student)) return; // already starred automatically
        if (await favorites.FindAsync(student.Id, teacherId) is null)
        {
            await favorites.AddAsync(FavoriteTeacher.Create(student.Id, teacherId));
            await favorites.SaveAsync();
        }
    }

    public async Task RemoveAsync(long teacherId)
    {
        var student = await current.StudentAsync();
        if (teacherId == await AdvisorIdAsync(student))
            throw BusinessException.Invalid("นำครูที่ปรึกษาประจำห้องออกไม่ได้");
        var existing = await favorites.FindAsync(student.Id, teacherId);
        if (existing is not null)
        {
            favorites.Remove(existing);
            await favorites.SaveAsync();
        }
    }
}
