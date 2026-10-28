using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SamaApi.Domain;
using SamaApi.Dtos;
using SamaApi.Repositories;
using SamaApi.Services;

namespace SamaApi.Controllers;

[ApiController, Authorize(Roles = "TEACHER")]
[Route("api/reviews")]
public class ReviewsController(ActivityService activities, ReviewService reviews) : ControllerBase
{
    [HttpGet]
    public Task<PageResult<ActivityItem>> List([FromQuery] string? termId, [FromQuery] ActivityStatus? status,
        [FromQuery] string? categoryId, [FromQuery] DateOnly? fromDate, [FromQuery] DateOnly? toDate,
        [FromQuery] string? search, [FromQuery] int page = 0, [FromQuery] int size = 12) =>
        activities.ListAsync(true, termId, status, categoryId, fromDate, toDate, search, page, size);

    [HttpPost("bulk")]
    public Task<Dictionary<string, int>> Bulk(BulkReviewRequest body) => reviews.ReviewAsync(body);
}
