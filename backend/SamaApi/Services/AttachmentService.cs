using SamaApi.Common;
using SamaApi.Domain;
using SamaApi.Dtos;
using SamaApi.Repositories;

namespace SamaApi.Services;

public record DownloadResult(string Name, string ContentType, byte[] Bytes);

public class AttachmentService(CurrentUser current, ActivityRepository activities, ActivityService activityService,
    IEvidenceStorage storage, EvidenceFilePolicy policy)
{
    public async Task<List<AttachmentInfo>> ListAsync(long activityId)
    {
        await activityService.RequireReadableAsync(activityId);
        return (await activities.AttachmentsAsync(activityId)).Select(AttachmentInfo.From).ToList();
    }

    public async Task<UploadResult> UploadAsync(long activityId, long expectedVersion, Guid clientUploadId, IFormFile file)
    {
        var student = await current.StudentAsync();
        var activity = await activities.GetAsync(activityId) ?? throw BusinessException.Missing();
        activity.RequireEditable(student.Id);
        if (file.Length > EvidenceFilePolicy.MaxBytes) throw new BusinessException(413, "ไฟล์หลักฐานต้องมีขนาดไม่เกิน 5 MB ต่อไฟล์");

        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer);
        var bytes = buffer.ToArray();
        var checkedFile = policy.Validate(file.FileName, bytes);

        // a retry of the same upload returns the stored file instead of adding a duplicate
        var previous = await activities.AttachmentByClientIdAsync(activityId, clientUploadId);
        if (previous is not null)
        {
            if (previous.Sha256 != checkedFile.Sha256 || previous.OriginalName != checkedFile.Name)
                throw BusinessException.Conflict("รหัสไฟล์นี้ถูกใช้กับหลักฐานอื่นแล้ว กรุณาเลือกไฟล์ใหม่");
            return new UploadResult(AttachmentInfo.From(previous), activity.Version);
        }

        ActivityService.CheckVersion(activity, expectedVersion);
        if (await activities.AttachmentCountAsync(activityId) >= EvidenceFilePolicy.MaxFiles)
            throw BusinessException.Invalid("แนบหลักฐานได้สูงสุด 5 ไฟล์ต่อกิจกรรม");

        var path = $"{activityId}/{Guid.NewGuid():N}{checkedFile.Extension}";
        await storage.SaveAsync(path, bytes, checkedFile.ContentType);
        try
        {
            var attachment = ActivityAttachment.Create(activityId, clientUploadId, checkedFile.Name, checkedFile.ContentType,
                bytes.Length, checkedFile.Sha256, path);
            await activities.AddAttachmentAsync(attachment);
            activity.AttachmentsChanged(student.Id, DateTime.UtcNow);
            await activities.SaveAsync();
            return new UploadResult(AttachmentInfo.From(attachment), activity.Version);
        }
        catch
        {
            try { await storage.DeleteAsync(path); } catch { /* best effort */ }
            throw;
        }
    }

    public async Task<VersionResult> RemoveAsync(long activityId, long attachmentId, long? expectedVersion)
    {
        var student = await current.StudentAsync();
        var activity = await activities.GetAsync(activityId) ?? throw BusinessException.Missing();
        activity.RequireEditable(student.Id);
        var file = await activities.AttachmentAsync(activityId, attachmentId);
        if (file is null) return new VersionResult(activity.Version);
        ActivityService.CheckVersion(activity, expectedVersion);

        activities.RemoveAttachment(file);
        activity.AttachmentsChanged(student.Id, DateTime.UtcNow);
        await activities.SaveAsync();
        try { await storage.DeleteAsync(file.StoragePath); } catch { /* the row is gone; an orphan file is harmless */ }
        return new VersionResult(activity.Version);
    }

    public async Task<DownloadResult> DownloadAsync(long activityId, long attachmentId)
    {
        await activityService.RequireReadableAsync(activityId);
        var file = await activities.AttachmentAsync(activityId, attachmentId) ?? throw BusinessException.Missing();
        return new DownloadResult(file.OriginalName, file.ContentType, await storage.ReadAsync(file.StoragePath));
    }
}
