using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace SamaApi.Data;

/// <summary>Stores the cookie-encryption keys (table data_protection_keys, see database/003_data_protection_keys.sql).</summary>
public class KeyDbContext(DbContextOptions<KeyDbContext> options) : DbContext(options), IDataProtectionKeyContext
{
    public DbSet<DataProtectionKey> DataProtectionKeys { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder mb) =>
        mb.Entity<DataProtectionKey>(e =>
        {
            e.ToTable("data_protection_keys");
            e.Property(k => k.Id).HasColumnName("id");
            e.Property(k => k.FriendlyName).HasColumnName("friendly_name");
            e.Property(k => k.Xml).HasColumnName("xml");
        });
}
