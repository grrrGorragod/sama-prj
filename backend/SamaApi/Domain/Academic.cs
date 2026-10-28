namespace SamaApi.Domain;

public class Classroom
{
    private Classroom() { }
    public static Classroom Create(string name, int academicYear) => new() { Name = name, AcademicYear = academicYear };

    public long Id { get; private set; }
    public string Name { get; private set; } = "";
    public int AcademicYear { get; private set; }
    public long? AdvisorTeacherId { get; private set; }
    public Teacher? Advisor { get; private set; }

    public void AssignAdvisor(long teacherId) => AdvisorTeacherId = teacherId;
}

public class ActivityCategory
{
    private ActivityCategory() { }
    public static ActivityCategory Create(string code, string name, string description, string color) =>
        new() { Code = code, Name = name, Description = description, Color = color };

    public long Id { get; private set; }
    public string? Code { get; private set; }
    public string Name { get; private set; } = "";
    public string? Description { get; private set; }
    public string? Color { get; private set; }

    public void Describe(string code, string name, string description, string color)
    {
        Code = code; Name = name; Description = description; Color = color;
    }
}

/// <summary>What a category requires in one academic year (same for every grade).</summary>
public class ActivityRequirement
{
    private ActivityRequirement() { }
    public static ActivityRequirement Create(long categoryId, int academicYear, long count, float hours) =>
        new() { CategoryId = categoryId, AcademicYear = academicYear, RequireCount = count, RequireTime = hours };

    public void Configure(long count, float hours) { RequireCount = count; RequireTime = hours; }

    public long Id { get; private set; }
    public long CategoryId { get; private set; }
    public ActivityCategory? Category { get; private set; }
    public int AcademicYear { get; private set; }
    public long RequireCount { get; private set; }
    public float RequireTime { get; private set; }

    /// <summary>Hours required → measured in minutes; otherwise measured by number of approved activities.</summary>
    public RequirementMetric Metric => RequireTime > 0 ? RequirementMetric.DurationMinutes : RequirementMetric.Count;
    public int Target => Metric == RequirementMetric.DurationMinutes ? (int)Math.Round(RequireTime * 60) : (int)RequireCount;
}

public class AcademicDeadline
{
    private AcademicDeadline() { }
    public static AcademicDeadline Create(int academicYear, DateOnly date, TimeOnly? time) =>
        new() { AcademicYear = academicYear, Date = date, Time = time };

    public long Id { get; private set; }
    public int AcademicYear { get; private set; }
    public DateOnly? Date { get; private set; }
    public TimeOnly? Time { get; private set; }
}

public class FavoriteTeacher
{
    private FavoriteTeacher() { }
    public static FavoriteTeacher Create(long studentId, long teacherId) =>
        new() { StudentId = studentId, TeacherId = teacherId, CreatedAt = DateTime.UtcNow };

    public long StudentId { get; private set; }
    public Student? Student { get; private set; }
    public long TeacherId { get; private set; }
    public Teacher? Teacher { get; private set; }
    public DateTime CreatedAt { get; private set; }
}
