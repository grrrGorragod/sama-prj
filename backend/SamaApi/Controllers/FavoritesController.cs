using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SamaApi.Dtos;
using SamaApi.Repositories;
using SamaApi.Services;

namespace SamaApi.Controllers;

[ApiController, Authorize(Roles = "STUDENT")]
[Route("api")]
public class FavoritesController(FavoriteService favorites) : ControllerBase
{
    [HttpGet("teachers")]
    public Task<PageResult<TeacherView>> Search([FromQuery] string? search, [FromQuery] int page = 0) =>
        favorites.SearchAsync(search, page);

    [HttpGet("me/favorite-teachers")]
    public Task<List<TeacherView>> List() => favorites.ListAsync();

    [HttpPut("me/favorite-teachers/{id:long}")]
    public async Task<IActionResult> Add(long id) { await favorites.AddAsync(id); return NoContent(); }

    [HttpDelete("me/favorite-teachers/{id:long}")]
    public async Task<IActionResult> Remove(long id) { await favorites.RemoveAsync(id); return NoContent(); }
}
