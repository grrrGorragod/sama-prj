using SamaApi.Common;
using SamaApi.Domain;
using SamaApi.Dtos;
using SamaApi.Repositories;

namespace SamaApi.Services;

public class ProgressService(CurrentUser current, UserRepository users, AcademicRepository academic, ActivityRepository activities)
{
    public async Task<SummaryDto> MineAsync(string termId)
    {
        var year = AcademicService.ParseYear(termId);
        var student = await users.GetStudentAsync((await current.StudentAsync()).Id) ?? throw BusinessException.Missing();
        var rules = await academic.GetRequirementsAsync(year);
        return Summarize(student, year, rules, await activities.RowsAsync(new[] { student.Id }, year));
    }

    public async Task<SummaryDto> IndividualAsync(long studentId, string termId)
    {
        var teacher = await current.TeacherAsync();
        var year = AcademicService.ParseYear(termId);
        var student = await users.GetStudentAsync(studentId) ?? throw BusinessException.Missing();
        if (student.Classroom?.AdvisorTeacherId != teacher.Id) throw BusinessException.Missing();
        var rules = await academic.GetRequirementsAsync(year);
        return Summarize(student, year, rules, await activities.RowsAsync(new[] { student.Id }, year));
    }

    public async Task<ClassroomSummaryDto> ClassroomAsync(long classroomId, string termId)
    {
        var teacher = await current.TeacherAsync();
        var year = AcademicService.ParseYear(termId);
        var room = await academic.GetClassroomAsync(classroomId) ?? throw BusinessException.Missing();
        if (room.AdvisorTeacherId != teacher.Id) throw BusinessException.Missing();

        var students = await users.GetStudentsByClassroomAsync(classroomId);
        var rules = await academic.GetRequirementsAsync(year);
        var rows = students.Count == 0 ? new List<ActivityRow>() : await activities.RowsAsync(students.Select(s => s.Id).ToList(), year);
        var summaries = students.Select(s => Summarize(s, year, rules, rows)).ToList();
        var completed = summaries.Count(s => s.Completed);
        return new ClassroomSummaryDto(Ids.Str(room.Id), room.Name, year.ToString(), students.Count, completed,
            students.Count - completed, summaries);
    }

    private static SummaryDto Summarize(Student s, int year, List<ActivityRequirement> rules, List<ActivityRow> all)
    {
        var mine = all.Where(r => r.StudentId == s.Id).ToList();
        var categories = new List<CategoryProgressDto>();
        foreach (var rule in rules)
        {
            var c = rule.Category!;
            var rows = mine.Where(r => r.CategoryId == c.Id).ToList();
            long Count(ActivityStatus st) => rows.Count(r => r.Status == st);
            long approved = Count(ActivityStatus.Approved);
            long minutes = rows.Where(r => r.Status == ActivityStatus.Approved).Sum(r => (long)r.DurationMinutes);
            var value = rule.Metric == RequirementMetric.Count ? approved : minutes;
            var percent = Math.Round(Math.Min(100, 100.0 * value / rule.Target) * 10) / 10.0;
            categories.Add(new CategoryProgressDto(Ids.Str(c.Id), c.Code ?? "", c.Name, c.Description, c.Color, rule.Metric,
                rule.Target, value, Math.Max(0, rule.Target - value), percent, approved,
                Count(ActivityStatus.Pending), Count(ActivityStatus.Rejected), Count(ActivityStatus.Draft)));
        }

        long Total(ActivityStatus st) => mine.Count(r => r.Status == st);
        var configured = categories.Count > 0;
        var completed = configured && categories.All(c => c.ApprovedValue >= c.Target);
        var overall = configured ? Math.Round(categories.Average(c => c.Percent) * 10) / 10.0 : 0;
        var approvedAll = Total(ActivityStatus.Approved);
        var pending = Total(ActivityStatus.Pending);
        var rejected = Total(ActivityStatus.Rejected);
        var draft = Total(ActivityStatus.Draft);
        var minutesAll = mine.Where(r => r.Status == ActivityStatus.Approved).Sum(r => r.DurationMinutes);

        return new SummaryDto(Ids.Str(s.Id), s.FullName, s.StudentCode, s.Classroom?.Name ?? "", s.ClassNumber ?? 0,
            year.ToString(), AcademicCalendar.Label(year), configured, completed, overall,
            approvedAll + pending + rejected + draft, approvedAll, pending, rejected, draft, minutesAll, categories);
    }
}
