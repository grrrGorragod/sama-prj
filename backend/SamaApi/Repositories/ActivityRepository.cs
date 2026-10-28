using Microsoft.EntityFrameworkCore;
using SamaApi.Data;
using SamaApi.Domain;

namespace SamaApi.Repositories;

public record ActivityFilter(int? Year, ActivityStatus? Status, long? CategoryId, DateOnly? From, DateOnly? To, string Search);
public record PageResult<T>(IReadOnlyList<T> Items, long Total, int Page, int TotalPages);
public record ActivityRow(long StudentId, long CategoryId, ActivityStatus Status, int DurationMinutes);

public class ActivityRepository(SamaDbContext db)
{
    private IQueryable<Activity> Full() =>
        db.Activities.Include(a => a.Category).Include(a => a.Student).Include(a => a.Reviewer).Include(a => a.History);

    public Task<Activity?> GetAsync(long id) => Full().FirstOrDefaultAsync(a => a.Id == id);

    public Task<List<Activity>> GetManyAsync(IEnumerable<long> ids)
    {
        var list = ids.Distinct().ToList();
        return Full().Where(a => list.Contains(a.Id)).ToListAsync();
    }

    /// <summary>Student view (owner = student) or reviewer view (owner = teacher), filtered and paged.</summary>
    public async Task<PageResult<Activity>> SearchAsync(long ownerId, bool reviewerView, ActivityFilter f, int page, int size)
    {
        var q = db.Activities.Include(a => a.Category).Include(a => a.Student).Include(a => a.Reviewer).AsQueryable();
        q = reviewerView ? q.Where(a => a.ReviewerId == ownerId) : q.Where(a => a.StudentId == ownerId);
        if (f.Year is { } y) q = q.Where(a => a.AcademicYear == y);
        if (f.Status is { } s) q = q.Where(a => a.Status == s);
        if (f.CategoryId is { } c) q = q.Where(a => a.CategoryId == c);
        if (f.From is { } from) q = q.Where(a => a.ActivityDate >= from);
        if (f.To is { } to) q = q.Where(a => a.ActivityDate <= to);
        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            var like = "%" + f.Search.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
            q = q.Where(a => EF.Functions.ILike(a.Title ?? "", like) || EF.Functions.ILike(a.Student!.FullName, like));
        }

        var total = await q.LongCountAsync();
        q = reviewerView
            ? q.OrderByDescending(a => a.SubmittedAt).ThenBy(a => a.Id)
            : q.OrderByDescending(a => a.CreatedAt).ThenBy(a => a.Id);
        var items = await q.Skip(page * size).Take(size).ToListAsync();
        return new PageResult<Activity>(items, total, page, (int)Math.Ceiling(total / (double)size));
    }

    /// <summary>Light rows used for progress calculation.</summary>
    public async Task<List<ActivityRow>> RowsAsync(IReadOnlyCollection<long> studentIds, int year)
    {
        var ids = studentIds.ToList();
        var rows = await db.Activities.Where(a => ids.Contains(a.StudentId) && a.AcademicYear == year)
            .Select(a => new { a.StudentId, a.CategoryId, a.Status, a.DurationMinutes }).ToListAsync();
        return rows.Select(r => new ActivityRow(r.StudentId, r.CategoryId, r.Status, r.DurationMinutes)).ToList();
    }

    public async Task AddAsync(Activity a) => await db.Activities.AddAsync(a);
    public Task SaveAsync() => db.SaveChangesAsync();

    // ----- attachments -----
    public Task<List<ActivityAttachment>> AttachmentsAsync(long activityId) =>
        db.ActivityAttachments.Where(x => x.ActivityId == activityId).OrderBy(x => x.UploadedAt).ThenBy(x => x.Id).ToListAsync();

    public Task<ActivityAttachment?> AttachmentByClientIdAsync(long activityId, Guid clientId) =>
        db.ActivityAttachments.FirstOrDefaultAsync(x => x.ActivityId == activityId && x.ClientUploadId == clientId);

    public Task<ActivityAttachment?> AttachmentAsync(long activityId, long id) =>
        db.ActivityAttachments.FirstOrDefaultAsync(x => x.ActivityId == activityId && x.Id == id);

    public Task<int> AttachmentCountAsync(long activityId) => db.ActivityAttachments.CountAsync(x => x.ActivityId == activityId);
    public async Task AddAttachmentAsync(ActivityAttachment a) => await db.ActivityAttachments.AddAsync(a);
    public void RemoveAttachment(ActivityAttachment a) => db.ActivityAttachments.Remove(a);
}
