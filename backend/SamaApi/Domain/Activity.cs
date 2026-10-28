using SamaApi.Common;
using static SamaApi.Domain.ActivityStatus;

namespace SamaApi.Domain;

public class ActivityStatusLog
{
    private ActivityStatusLog() { }
    public static ActivityStatusLog Create(ActivityStatus? from, ActivityStatus to, long actorId, int sequence, DateTime at, string? reason) =>
        new() { FromStatus = from, ToStatus = to, ActorId = actorId, Sequence = sequence, OccurredAt = at, Reason = reason };

    public long Id { get; private set; }
    public long ActivityId { get; private set; }
    public ActivityStatus? FromStatus { get; private set; }
    public ActivityStatus ToStatus { get; private set; }
    public long ActorId { get; private set; }
    public int Sequence { get; private set; }
    public DateTime OccurredAt { get; private set; }
    public string? Reason { get; private set; }
}

public class ActivityAttachment
{
    private ActivityAttachment() { }
    public static ActivityAttachment Create(long activityId, Guid clientUploadId, string name, string contentType,
        long size, string sha256, string storagePath) =>
        new()
        {
            ActivityId = activityId, ClientUploadId = clientUploadId, OriginalName = name, ContentType = contentType,
            SizeBytes = size, Sha256 = sha256, StoragePath = storagePath, UploadedAt = DateTime.UtcNow
        };

    public long Id { get; private set; }
    public long ActivityId { get; private set; }
    public Guid ClientUploadId { get; private set; }
    public string OriginalName { get; private set; } = "";
    public string ContentType { get; private set; } = "";
    public long SizeBytes { get; private set; }
    public string Sha256 { get; private set; } = "";
    public string StoragePath { get; private set; } = "";
    public DateTime UploadedAt { get; private set; }
}

/// <summary>
/// One student's activity. Status can only change through the methods below.
/// <see cref="Version"/> is bumped on every change and used as an optimistic-lock token.
/// </summary>
public class Activity
{
    private readonly List<ActivityStatusLog> _history = new();
    private Activity() { }

    public long Id { get; private set; }
    public long StudentId { get; private set; }
    public Student? Student { get; private set; }
    public long CategoryId { get; private set; }
    public ActivityCategory? Category { get; private set; }
    public long? ReviewerId { get; private set; }
    public Teacher? Reviewer { get; private set; }
    public int AcademicYear { get; private set; }

    public string? Title { get; private set; }
    public string? Description { get; private set; }
    public DateOnly? ActivityDate { get; private set; }
    public TimeOnly? StartTime { get; private set; }
    public TimeOnly? EndTime { get; private set; }
    public int DurationMinutes { get; private set; }
    public ActivityStatus Status { get; private set; }
    public long Version { get; private set; }
    public int EvidenceRevision { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public DateTime? SubmittedAt { get; private set; }
    public DateTime? ReviewedAt { get; private set; }

    public IReadOnlyCollection<ActivityStatusLog> History => _history;

    public static Activity Create(Student student, int academicYear, ActivityCategory category, DateTime now)
    {
        var a = new Activity
        {
            Student = student, StudentId = student.Id, AcademicYear = academicYear,
            Category = category, CategoryId = category.Id, CreatedAt = now, UpdatedAt = now
        };
        a.Record(null, Draft, student.Id, now, null);
        return a;
    }

    public void Edit(long actorId, string? title, string? description, DateOnly? date, TimeOnly? start, TimeOnly? end, DateTime now)
    {
        RequireEditable(actorId);
        if (start.HasValue && end.HasValue && start.Value >= end.Value)
            throw BusinessException.Invalid("เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น");
        Title = title?.Trim() ?? "";
        Description = description?.Trim() ?? "";
        ActivityDate = date;
        StartTime = start;
        EndTime = end;
        DurationMinutes = start.HasValue && end.HasValue ? (int)(end.Value - start.Value).TotalMinutes : 0;
        Touch(now);
    }

    public void Submit(long actorId, Teacher? reviewer, DateTime now)
    {
        if (StudentId != actorId) throw BusinessException.Missing();
        if (Status is not (Draft or Rejected)) throw BusinessException.Conflict("กิจกรรมนี้ถูกส่งตรวจแล้ว");
        if (string.IsNullOrWhiteSpace(Title) || string.IsNullOrWhiteSpace(Description) || ActivityDate is null
            || StartTime is null || EndTime is null || DurationMinutes <= 0)
            throw BusinessException.Invalid("กรุณากรอกชื่อ รายละเอียด วันที่ และเวลาให้ครบก่อนส่งตรวจ");
        var (from, to) = AcademicCalendar.RangeOf(AcademicYear);
        if (ActivityDate < from || ActivityDate > to)
            throw BusinessException.Invalid("วันที่ทำกิจกรรมต้องอยู่ในปีการศึกษาที่เลือก");
        if (reviewer is null) throw BusinessException.Invalid("กรุณาเลือกครูผู้ตรวจ");
        Reviewer = reviewer;
        ReviewerId = reviewer.Id;
        SubmittedAt = now;
        ReviewedAt = null;
        Record(Status, Pending, actorId, now, null);
    }

    public void Approve(long actorId, DateTime now)
    {
        RequireReviewer(actorId);
        ReviewedAt = now;
        Record(Status, Approved, actorId, now, null);
    }

    public void ReturnForRevision(long actorId, string? reason, DateTime now)
    {
        RequireReviewer(actorId);
        if (string.IsNullOrWhiteSpace(reason)) throw BusinessException.Invalid("กรุณาระบุเหตุผลที่ส่งคืน");
        ReviewedAt = now;
        Record(Status, Rejected, actorId, now, reason.Trim());
    }

    public void AttachmentsChanged(long actorId, DateTime now)
    {
        RequireEditable(actorId);
        EvidenceRevision++;
        Touch(now);
    }

    public void RequireEditable(long actorId)
    {
        if (StudentId != actorId) throw BusinessException.Missing();
        if (Status is not (Draft or Rejected)) throw BusinessException.Conflict("แก้ไขได้เฉพาะแบบร่างหรือกิจกรรมที่ส่งคืน");
    }

    /// <summary>The teacher's reason from the latest return, shown to the student.</summary>
    public string? LastRejectReason =>
        _history.Where(h => h.ToStatus == Rejected).OrderByDescending(h => h.Sequence).FirstOrDefault()?.Reason;

    private void RequireReviewer(long actorId)
    {
        if (ReviewerId != actorId) throw BusinessException.Missing();
        if (Status != Pending) throw BusinessException.Conflict("กิจกรรมถูกตรวจหรือเปลี่ยนสถานะแล้ว กรุณาโหลดใหม่");
    }

    private void Record(ActivityStatus? from, ActivityStatus to, long actorId, DateTime now, string? reason)
    {
        _history.Add(ActivityStatusLog.Create(from, to, actorId, _history.Count + 1, now, reason));
        Status = to;
        Touch(now);
    }

    private void Touch(DateTime now)
    {
        UpdatedAt = now;
        Version++;
    }
}
