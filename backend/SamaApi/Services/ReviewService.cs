using SamaApi.Common;
using SamaApi.Domain;
using SamaApi.Dtos;
using SamaApi.Repositories;

namespace SamaApi.Services;

public class ReviewService(CurrentUser current, ActivityRepository activities)
{
    /// <summary>Approve or return up to 50 activities at once. All-or-nothing; returning needs a reason.</summary>
    public async Task<Dictionary<string, int>> ReviewAsync(BulkReviewRequest p)
    {
        var teacher = await current.TeacherAsync();
        if (p.Items is null || p.Items.Count == 0) throw BusinessException.Invalid("กรุณาเลือกรายการ");
        if (p.Items.Count > 50) throw BusinessException.Invalid("เลือกได้สูงสุด 50 รายการ");
        if (p.Reason is { Length: > 1000 }) throw BusinessException.Invalid("เหตุผลยาวเกินไป");

        var ids = p.Items.Select(i => Ids.Parse(i.ActivityId)).ToList();
        if (ids.Distinct().Count() != ids.Count) throw BusinessException.Invalid("รายการที่เลือกต้องไม่ซ้ำ");
        var wanted = p.Items.ToDictionary(i => Ids.Parse(i.ActivityId), i => i.ExpectedVersion);

        var found = await activities.GetManyAsync(wanted.Keys);
        if (found.Count != wanted.Count) throw BusinessException.Missing();

        var now = DateTime.UtcNow;
        foreach (var a in found)
        {
            ActivityService.CheckVersion(a, wanted[a.Id]);
            if (p.Decision == ReviewDecision.Approve) a.Approve(teacher.Id, now);
            else a.ReturnForRevision(teacher.Id, p.Reason, now);
        }
        await activities.SaveAsync();
        return new Dictionary<string, int> { ["updated"] = found.Count };
    }
}
