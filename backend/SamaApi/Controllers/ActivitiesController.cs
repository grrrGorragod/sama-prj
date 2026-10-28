using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SamaApi.Domain;
using SamaApi.Dtos;
using SamaApi.Repositories;
using SamaApi.Services;

namespace SamaApi.Controllers;

[ApiController]
[Route("api/activities")]
public class ActivitiesController(ActivityService activities, AttachmentService attachments) : ControllerBase
{
    [Authorize(Roles = "STUDENT"), HttpGet]
    public Task<PageResult<ActivityItem>> List([FromQuery] string? termId, [FromQuery] ActivityStatus? status,
        [FromQuery] string? categoryId, [FromQuery] DateOnly? fromDate, [FromQuery] DateOnly? toDate,
        [FromQuery] string? search, [FromQuery] int page = 0, [FromQuery] int size = 12) =>
        activities.ListAsync(false, termId, status, categoryId, fromDate, toDate, search, page, size);

    [Authorize(Roles = "STUDENT"), HttpPost]
    public Task<ActivityItem> Create(SaveRequest body) => activities.CreateAsync(body);

    [HttpGet("{id:long}")]
    public Task<ActivityDetail> Detail(long id) => activities.DetailAsync(id);

    [Authorize(Roles = "STUDENT"), HttpPatch("{id:long}")]
    public Task<ActivityItem> Edit(long id, SaveRequest body) => activities.EditAsync(id, body);

    [Authorize(Roles = "STUDENT"), HttpPost("{id:long}/submit")]
    public Task<ActivityItem> Submit(long id, SubmitRequest body) => activities.SubmitAsync(id, body);

    // ----- evidence files -----
    [HttpGet("{id:long}/attachments")]
    public Task<List<AttachmentInfo>> Attachments(long id) => attachments.ListAsync(id);

    [Authorize(Roles = "STUDENT"), HttpPost("{id:long}/attachments")]
    [RequestSizeLimit(7 * 1024 * 1024)]
    public Task<UploadResult> Upload(long id, [FromForm] long expectedVersion, [FromForm] Guid clientUploadId, IFormFile file) =>
        attachments.UploadAsync(id, expectedVersion, clientUploadId, file);

    [Authorize(Roles = "STUDENT"), HttpDelete("{id:long}/attachments/{attachmentId:long}")]
    public Task<VersionResult> Remove(long id, long attachmentId, RemoveAttachmentRequest body) =>
        attachments.RemoveAsync(id, attachmentId, body.ExpectedVersion);

    [HttpGet("{id:long}/attachments/{attachmentId:long}")]
    public async Task<IActionResult> Download(long id, long attachmentId)
    {
        var file = await attachments.DownloadAsync(id, attachmentId);
        Response.Headers.CacheControl = "no-store";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return File(file.Bytes, file.ContentType, file.Name);
    }
}
