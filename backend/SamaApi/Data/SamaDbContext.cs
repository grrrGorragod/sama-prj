using Microsoft.EntityFrameworkCore;
using SamaApi.Domain;

namespace SamaApi.Data;

/// <summary>
/// Maps the domain onto the existing Supabase tables (quoted PascalCase table names, snake_case columns).
/// Table-per-type: "User" ← "Student" / "Teacher" (shared primary key).
/// </summary>
public class SamaDbContext(DbContextOptions<SamaDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Student> Students => Set<Student>();
    public DbSet<Teacher> Teachers => Set<Teacher>();
    public DbSet<Classroom> Classrooms => Set<Classroom>();
    public DbSet<FavoriteTeacher> FavoriteTeachers => Set<FavoriteTeacher>();
    public DbSet<ActivityCategory> ActivityCategories => Set<ActivityCategory>();
    public DbSet<ActivityRequirement> ActivityRequirements => Set<ActivityRequirement>();
    public DbSet<AcademicDeadline> AcademicDeadlines => Set<AcademicDeadline>();
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<ActivityStatusLog> ActivityStatusLogs => Set<ActivityStatusLog>();
    public DbSet<ActivityAttachment> ActivityAttachments => Set<ActivityAttachment>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        // "DRAFT" / "PENDING" / ... in the database
        var status = new Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<ActivityStatus, string>(
            v => v.ToString().ToUpper(), s => Enum.Parse<ActivityStatus>(s, true));

        mb.Entity<User>(e =>
        {
            e.ToTable("User");
            e.HasKey(u => u.Id);
            e.Property(u => u.Id).HasColumnName("user_id").ValueGeneratedOnAdd();
            e.Property(u => u.PasswordHash).HasColumnName("password");
            e.Property(u => u.Role).HasColumnName("role").HasConversion(
                v => v.ToString().ToLower(), s => Enum.Parse<UserRole>(s, true));
            e.OwnsOne(u => u.Profile, p =>
            {
                p.Property(x => x.Phone).HasColumnName("phone");
                p.Property(x => x.Address).HasColumnName("address");
                p.Property(x => x.Photo).HasColumnName("photo");
            });
        });

        mb.Entity<Student>(e =>
        {
            e.ToTable("Student", t => t.Property(s => s.Id).HasColumnName("student_id"));
            e.HasOne(s => s.Classroom).WithMany().HasForeignKey(s => s.ClassroomId);
        });

        mb.Entity<Teacher>(e => e.ToTable("Teacher", t => t.Property(x => x.Id).HasColumnName("teacher_id")));

        mb.Entity<Classroom>(e =>
        {
            e.ToTable("Classroom");
            e.HasKey(c => c.Id);
            e.Property(c => c.Id).HasColumnName("classroom_id").ValueGeneratedOnAdd();
            e.Property(c => c.Name).HasColumnName("classroom_name");
            e.HasOne(c => c.Advisor).WithMany().HasForeignKey(c => c.AdvisorTeacherId);
        });

        mb.Entity<FavoriteTeacher>(e =>
        {
            e.ToTable("Favorite_Teacher");
            e.HasKey(f => new { f.StudentId, f.TeacherId });
            e.Property(f => f.StudentId).ValueGeneratedNever();
            e.Property(f => f.TeacherId).ValueGeneratedNever();
            e.HasOne(f => f.Student).WithMany().HasForeignKey(f => f.StudentId);
            e.HasOne(f => f.Teacher).WithMany().HasForeignKey(f => f.TeacherId);
        });

        mb.Entity<ActivityCategory>(e =>
        {
            e.ToTable("Activites_Catagories");
            e.HasKey(c => c.Id);
            e.Property(c => c.Id).HasColumnName("catagory_id").ValueGeneratedOnAdd();
            e.Property(c => c.Name).HasColumnName("catagory_name");
        });

        mb.Entity<ActivityRequirement>(e =>
        {
            e.ToTable("Activites_Requirement");
            e.HasKey(r => r.Id);
            e.Property(r => r.Id).HasColumnName("requirement_id").ValueGeneratedOnAdd();
            e.Property(r => r.CategoryId).HasColumnName("catagory_id");
            e.Ignore(r => r.Metric);
            e.Ignore(r => r.Target);
            e.HasOne(r => r.Category).WithMany().HasForeignKey(r => r.CategoryId);
        });

        mb.Entity<AcademicDeadline>(e =>
        {
            e.ToTable("Activites_Deadlines");
            e.HasKey(d => d.Id);
            e.Property(d => d.Id).HasColumnName("deadline_id").ValueGeneratedOnAdd();
            e.Property(d => d.Date).HasColumnName("deadline_date");
            e.Property(d => d.Time).HasColumnName("deadline_time");
        });

        mb.Entity<Activity>(e =>
        {
            e.ToTable("Activities");
            e.HasKey(a => a.Id);
            e.Property(a => a.Id).HasColumnName("activity_id").ValueGeneratedOnAdd();
            e.Property(a => a.ReviewerId).HasColumnName("review_teacher_id");
            e.Property(a => a.CategoryId).HasColumnName("catagory_id");
            e.Property(a => a.Title).HasColumnName("activity_name");
            e.Property(a => a.ActivityDate).HasColumnName("activity_date");
            e.Property(a => a.Status).HasColumnName("status").HasConversion(status);
            e.Property(a => a.Version).IsConcurrencyToken();
            e.Ignore(a => a.LastRejectReason);
            e.HasOne(a => a.Student).WithMany().HasForeignKey(a => a.StudentId);
            e.HasOne(a => a.Category).WithMany().HasForeignKey(a => a.CategoryId);
            e.HasOne(a => a.Reviewer).WithMany().HasForeignKey(a => a.ReviewerId);
            e.HasMany(a => a.History).WithOne().HasForeignKey(h => h.ActivityId);
            e.Navigation(a => a.History).UsePropertyAccessMode(PropertyAccessMode.Field);
        });

        mb.Entity<ActivityStatusLog>(e =>
        {
            e.ToTable("Activities_History");
            e.HasKey(h => h.Id);
            e.Property(h => h.Id).HasColumnName("history_id").ValueGeneratedOnAdd();
            e.Property(h => h.ActorId).HasColumnName("changer_id");
            e.Property(h => h.OccurredAt).HasColumnName("change_at");
            e.Property(h => h.Reason).HasColumnName("comment");
            e.Property(h => h.ToStatus).HasColumnName("status").HasConversion(status);
            e.Property(h => h.FromStatus).HasColumnName("from_status").HasConversion(status);
        });

        mb.Entity<ActivityAttachment>(e =>
        {
            e.ToTable("Activity_Attachments");
            e.HasKey(a => a.Id);
            e.Property(a => a.Id).HasColumnName("attachment_id").ValueGeneratedOnAdd();
            e.Property(a => a.Sha256).HasColumnName("sha256");
        });
    }
}
