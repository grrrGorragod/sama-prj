using Microsoft.EntityFrameworkCore;
using SamaApi.Data;
using SamaApi.Domain;

namespace SamaApi.Repositories;

public class UserRepository(SamaDbContext db)
{
    public Task<User?> FindByEmailAsync(string email)
    {
        var e = email.Trim().ToLower();
        return db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == e || u.Username.ToLower() == e);
    }

    public Task<User?> GetAsync(long id) => db.Users.FirstOrDefaultAsync(u => u.Id == id);
    public Task<Student?> GetStudentAsync(long id) => db.Students.Include(s => s.Classroom).FirstOrDefaultAsync(s => s.Id == id);
    public Task<Teacher?> GetTeacherAsync(long id) => db.Teachers.FirstOrDefaultAsync(t => t.Id == id);

    public Task<List<User>> GetManyAsync(IEnumerable<long> ids)
    {
        var list = ids.Distinct().ToList();
        return db.Users.Where(u => list.Contains(u.Id)).ToListAsync();
    }

    public Task<bool> EmailTakenAsync(string email, long exceptId)
    {
        var e = email.Trim().ToLower();
        return db.Users.AnyAsync(u => u.Id != exceptId && (u.Email.ToLower() == e || u.Username.ToLower() == e));
    }

    public Task<List<Teacher>> SearchTeachersAsync(string search)
    {
        var q = db.Teachers.AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            q = q.Where(t => t.FullName.ToLower().Contains(s));
        }
        return q.ToListAsync();
    }

    public Task<List<Student>> GetStudentsByClassroomAsync(long classroomId) =>
        db.Students.Include(s => s.Classroom).Where(s => s.ClassroomId == classroomId)
            .OrderBy(s => s.ClassNumber).ToListAsync();

    public async Task AddAsync(User user) => await db.Users.AddAsync(user);
    public Task SaveAsync() => db.SaveChangesAsync();
}
