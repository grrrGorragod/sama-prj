using SamaApi.Common;
using SamaApi.Domain;
using SamaApi.Dtos;
using SamaApi.Repositories;

namespace SamaApi.Services;

public class FavoriteService(CurrentUser current, UserRepository users, FavoriteRepository favorites)
{
    private const int PageSize = 50;

    /// <summary>Teachers matching the search; the student's favourites come first, then A–Z.</summary>
    public async Task<PageResult<TeacherView>> SearchAsync(string? search, int page)
    {
        search ??= "";
        var student = await current.StudentAsync();
        if (page < 0 || search.Length > 200) throw BusinessException.Invalid("เงื่อนไขไม่ถูกต้อง");

        var favoriteIds = (await favorites.ListAsync(student.Id)).Select(f => f.TeacherId).ToHashSet();
        var teachers = (await users.SearchTeachersAsync(search))
            .OrderByDescending(t => favoriteIds.Contains(t.Id))
            .ThenBy(t => t.FullName, StringComparer.CurrentCulture)
            .ToList();

        var items = teachers.Skip(page * PageSize).Take(PageSize)
            .Select(t => new TeacherView(Ids.Str(t.Id), t.FullName, t.Department, favoriteIds.Contains(t.Id))).ToList();
        return new PageResult<TeacherView>(items, teachers.Count, page, (int)Math.Ceiling(teachers.Count / (double)PageSize));
    }

    public async Task<List<TeacherView>> ListAsync()
    {
        var student = await current.StudentAsync();
        return (await favorites.ListAsync(student.Id))
            .Select(f => f.Teacher!).OrderBy(t => t.FullName)
            .Select(t => new TeacherView(Ids.Str(t.Id), t.FullName, t.Department, true)).ToList();
    }

    public async Task AddAsync(long teacherId)
    {
        var student = await current.StudentAsync();
        _ = await users.GetTeacherAsync(teacherId) ?? throw BusinessException.Missing();
        if (await favorites.FindAsync(student.Id, teacherId) is null)
        {
            await favorites.AddAsync(FavoriteTeacher.Create(student.Id, teacherId));
            await favorites.SaveAsync();
        }
    }

    public async Task RemoveAsync(long teacherId)
    {
        var student = await current.StudentAsync();
        var existing = await favorites.FindAsync(student.Id, teacherId);
        if (existing is not null)
        {
            favorites.Remove(existing);
            await favorites.SaveAsync();
        }
    }
}
