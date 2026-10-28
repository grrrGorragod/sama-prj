using Microsoft.EntityFrameworkCore;
using SamaApi.Data;
using SamaApi.Domain;

namespace SamaApi.Repositories;

public class FavoriteRepository(SamaDbContext db)
{
    public Task<List<FavoriteTeacher>> ListAsync(long studentId) =>
        db.FavoriteTeachers.Include(f => f.Teacher).Where(f => f.StudentId == studentId).ToListAsync();

    public Task<FavoriteTeacher?> FindAsync(long studentId, long teacherId) =>
        db.FavoriteTeachers.FirstOrDefaultAsync(f => f.StudentId == studentId && f.TeacherId == teacherId);

    public async Task AddAsync(FavoriteTeacher f) => await db.FavoriteTeachers.AddAsync(f);
    public void Remove(FavoriteTeacher f) => db.FavoriteTeachers.Remove(f);
    public Task SaveAsync() => db.SaveChangesAsync();
}
