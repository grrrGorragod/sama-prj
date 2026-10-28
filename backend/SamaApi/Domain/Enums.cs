namespace SamaApi.Domain;

public enum UserRole { Student, Teacher }
public enum ActivityStatus { Draft, Pending, Approved, Rejected }
public enum RequirementMetric { Count, DurationMinutes }
public enum ReviewDecision { Approve, Reject }

/// <summary>Thai academic year (term = whole year): 1 May – 30 Apr, e.g. 2569 = 1 May 2026 – 30 Apr 2027.</summary>
public static class AcademicCalendar
{
    public static int YearOf(DateOnly d) => (d.Month >= 5 ? d.Year : d.Year - 1) + 543;
    public static int Current() => YearOf(DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)));
    public static (DateOnly From, DateOnly To) RangeOf(int thaiYear)
    {
        var g = thaiYear - 543;
        return (new DateOnly(g, 5, 1), new DateOnly(g + 1, 4, 30));
    }
    public static string Label(int thaiYear) => $"ปีการศึกษา {thaiYear}";
}
