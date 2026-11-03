using Microsoft.EntityFrameworkCore;
using SamaApi.Data;
using SamaApi.Domain;

namespace SamaApi.Repositories;

public class AcademicRepository(SamaDbContext db)
{
    /// <summary>Academic years that have any configuration, plus the current one.</summary>
    public async Task<List<int>> GetYearsAsync()
    {
        var a = await db.ActivityRequirements.Select(r => r.AcademicYear).Distinct().ToListAsync();
        var b = await db.AcademicDeadlines.Select(d => d.AcademicYear).Distinct().ToListAsync();
        var c = await db.Classrooms.Select(r => r.AcademicYear).Distinct().ToListAsync();
        return a.Concat(b).Concat(c).Append(AcademicCalendar.Current()).Distinct().ToList();
    }

    public Task<AcademicDeadline?> GetDeadlineAsync(int year) =>
        db.AcademicDeadlines.FirstOrDefaultAsync(d => d.AcademicYear == year);

    public Task<Classroom?> GetClassroomAsync(long id) => db.Classrooms.FirstOrDefaultAsync(c => c.Id == id);

    public Task<List<Classroom>> GetAdvisedAsync(long teacherId, int year) =>
        db.Classrooms.Where(c => c.AdvisorTeacherId == teacherId && c.AcademicYear == year).OrderBy(c => c.Name).ToListAsync();

    public Task<List<ActivityCategory>> GetCategoriesAsync() =>
        db.ActivityCategories.OrderBy(c => c.Code).ToListAsync();

    public Task<ActivityCategory?> GetCategoryAsync(long id) => db.ActivityCategories.FirstOrDefaultAsync(c => c.Id == id);

    /// <summary>Requirements of a year that actually have a target.</summary>
    public async Task<List<ActivityRequirement>> GetRequirementsAsync(int year) =>
        (await db.ActivityRequirements.Include(r => r.Category).Where(r => r.AcademicYear == year).ToListAsync())
            .Where(r => r.Target > 0 && r.Category != null)
            .OrderBy(r => r.Category!.Code).ToList();
}
