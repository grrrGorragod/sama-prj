using SamaApi.Common;
using SamaApi.Domain;
using SamaApi.Dtos;
using SamaApi.Repositories;

namespace SamaApi.Services;

public class AcademicService(AcademicRepository academic, CurrentUser current)
{
    public static int ParseYear(string? termId)
    {
        var year = Ids.Parse(termId);
        if (year is < 2500 or > 2700) throw BusinessException.Invalid("ปีการศึกษาไม่ถูกต้อง");
        return (int)year;
    }

    public async Task<List<TermDto>> TermsAsync()
    {
        var thisYear = AcademicCalendar.Current();
        var years = (await academic.GetYearsAsync()).OrderBy(y => y == thisYear ? 0 : 1).ThenByDescending(y => y).ToList();
        var list = new List<TermDto>();
        foreach (var y in years)
        {
            var (from, to) = AcademicCalendar.RangeOf(y);
            var d = await academic.GetDeadlineAsync(y);
            var date = d?.Date ?? to;
            var time = d?.Time ?? new TimeOnly(23, 59);
            // deadlines are entered in Thai time (UTC+7)
            var instant = DateTime.SpecifyKind(date.ToDateTime(time).AddHours(-7), DateTimeKind.Utc);
            list.Add(new TermDto(y.ToString(), AcademicCalendar.Label(y), from, to, instant));
        }
        return list;
    }

    public async Task<List<RoomDto>> ClassroomsAsync(string termId)
    {
        var teacher = await current.TeacherAsync();
        return (await academic.GetAdvisedAsync(teacher.Id, ParseYear(termId)))
            .Select(c => new RoomDto(Ids.Str(c.Id), c.Name)).ToList();
    }

    public async Task<List<CategoryDto>> CategoriesAsync(string termId)
    {
        var year = ParseYear(termId);
        if (await current.GetAsync() is Student)
            return (await academic.GetRequirementsAsync(year)).Select(r => new CategoryDto(
                Ids.Str(r.CategoryId), r.Category!.Code ?? "", r.Category.Name, r.Category.Description, r.Category.Color,
                r.Metric, r.Target)).ToList();
        return (await academic.GetCategoriesAsync()).Select(c => new CategoryDto(
            Ids.Str(c.Id), c.Code ?? "", c.Name, c.Description, c.Color, null, null)).ToList();
    }
}
