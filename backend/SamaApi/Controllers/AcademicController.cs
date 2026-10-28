using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SamaApi.Dtos;
using SamaApi.Services;

namespace SamaApi.Controllers;

[ApiController]
[Route("api")]
public class AcademicController(AcademicService academic) : ControllerBase
{
    [HttpGet("terms")]
    public Task<List<TermDto>> Terms() => academic.TermsAsync();

    [Authorize(Roles = "TEACHER"), HttpGet("classrooms")]
    public Task<List<RoomDto>> Classrooms([FromQuery] string termId) => academic.ClassroomsAsync(termId);

    [HttpGet("activity-categories")]
    public Task<List<CategoryDto>> Categories([FromQuery] string termId) => academic.CategoriesAsync(termId);
}
