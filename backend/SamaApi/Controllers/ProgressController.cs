using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SamaApi.Dtos;
using SamaApi.Services;

namespace SamaApi.Controllers;

[ApiController]
[Route("api")]
public class ProgressController(ProgressService progress, CsvReportExporter exporter) : ControllerBase
{
    [Authorize(Roles = "STUDENT"), HttpGet("me/progress")]
    public Task<SummaryDto> Mine([FromQuery] string termId) => progress.MineAsync(termId);

    [Authorize(Roles = "TEACHER"), HttpGet("students/{id:long}/progress")]
    public Task<SummaryDto> Student(long id, [FromQuery] string termId) => progress.IndividualAsync(id, termId);

    [Authorize(Roles = "TEACHER"), HttpGet("classrooms/{id:long}/statistics")]
    public Task<ClassroomSummaryDto> Classroom(long id, [FromQuery] string termId) => progress.ClassroomAsync(id, termId);

    [Authorize(Roles = "TEACHER"), HttpGet("classrooms/{id:long}/statistics.csv")]
    public async Task<IActionResult> Export(long id, [FromQuery] string termId)
    {
        var summary = await progress.ClassroomAsync(id, termId);
        return File(exporter.Export(summary), "text/csv;charset=UTF-8", "sama-classroom.csv");
    }
}
