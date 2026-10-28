using SamaApi.Common;
using SamaApi.Domain;

namespace SamaApi.Dtos;

// All ids are strings on the wire (the web client treats them as opaque).

public record LoginRequest(string Email, string Password);
public record ProfileRequest(string FullName, string Email, string? Phone, string? Address);

public record Me(string Id, string Email, string FullName, string Role, string? StudentCode, string? Department,
    string? Phone, string? Address, bool EmailEditable)
{
    public static Me From(User u) => new(Ids.Str(u.Id), u.Email, u.FullName, u.Role.ToString().ToUpperInvariant(),
        (u as Student)?.StudentCode, (u as Teacher)?.Department, u.Profile?.Phone ?? "", u.Profile?.Address ?? "", true);
}

public record TermDto(string Id, string Label, DateOnly StartsOn, DateOnly EndsOn, DateTime SubmissionDeadline);
public record RoomDto(string Id, string Label);
public record CategoryDto(string Id, string Code, string Name, string? Description, string? Color,
    RequirementMetric? Metric, int? Target);

public record SaveRequest(string TermId, string CategoryId, string? Title, string? Description,
    DateOnly? ActivityDate, TimeOnly? StartTime, TimeOnly? EndTime, long? ExpectedVersion);
public record SubmitRequest(string ReviewerId, long? ExpectedVersion);

public record ActivityItem(string Id, string Title, string Description, string CategoryId, string CategoryCode,
    string CategoryName, string Color, string TermId, string TermLabel, DateOnly? ActivityDate, TimeOnly? StartTime,
    TimeOnly? EndTime, int DurationMinutes, ActivityStatus Status, long Version, DateTime CreatedAt,
    DateTime? SubmittedAt, string StudentId, string StudentName, string? ReviewerId, string? ReviewerName)
{
    public static ActivityItem From(Activity a) => new(
        Ids.Str(a.Id), a.Title ?? "", a.Description ?? "", Ids.Str(a.CategoryId), a.Category?.Code ?? "",
        a.Category?.Name ?? "", a.Category?.Color ?? "purple", a.AcademicYear.ToString(), AcademicCalendar.Label(a.AcademicYear),
        a.ActivityDate, a.StartTime, a.EndTime, a.DurationMinutes, a.Status, a.Version, a.CreatedAt, a.SubmittedAt,
        Ids.Str(a.StudentId), a.Student?.FullName ?? "", Ids.Str(a.ReviewerId), a.Reviewer?.FullName);
}

public record ActivityEvent(int Sequence, ActivityStatus? FromStatus, ActivityStatus ToStatus, string ActorId,
    string ActorName, DateTime OccurredAt, string? Reason);
public record ActivityDetail(ActivityItem Activity, IReadOnlyList<ActivityEvent> History);

public record AttachmentInfo(string Id, string ClientUploadId, string OriginalName, string ContentType, long SizeBytes,
    DateTime UploadedAt)
{
    public static AttachmentInfo From(ActivityAttachment a) => new(Ids.Str(a.Id), a.ClientUploadId.ToString(),
        a.OriginalName, a.ContentType, a.SizeBytes, a.UploadedAt);
}
public record UploadResult(AttachmentInfo Attachment, long ActivityVersion);
public record VersionResult(long ActivityVersion);
public record RemoveAttachmentRequest(long? ExpectedVersion);

public record BulkSelection(string ActivityId, long? ExpectedVersion);
public record BulkReviewRequest(List<BulkSelection> Items, ReviewDecision Decision, string? Reason);

public record TeacherView(string Id, string FullName, string Department, bool Favorite);

public record CategoryProgressDto(string CategoryId, string Code, string Name, string? Description, string? Color,
    RequirementMetric Metric, int Target, long ApprovedValue, long Remaining, double Percent, long ApprovedCount,
    long PendingCount, long RejectedCount, long DraftCount);

public record SummaryDto(string StudentId, string StudentName, string StudentCode, string Classroom, int RollNumber,
    string TermId, string TermLabel, bool Configured, bool Completed, double Percent, long TotalActivities,
    long Approved, long Pending, long Rejected, long Draft, int TotalApprovedMinutes,
    IReadOnlyList<CategoryProgressDto> Categories);

public record ClassroomSummaryDto(string ClassroomId, string Classroom, string TermId, int TotalStudents,
    long CompletedStudents, long IncompleteStudents, IReadOnlyList<SummaryDto> Students);
