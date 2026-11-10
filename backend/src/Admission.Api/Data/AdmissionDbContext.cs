using Admission.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Admission.Api.Data;

public class AdmissionDbContext(DbContextOptions<AdmissionDbContext> options) : DbContext(options)
{
    public DbSet<SchoolClass> Classes => Set<SchoolClass>();
    public DbSet<Hold> Holds => Set<Hold>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<SchoolClass>(e =>
        {
            e.ToTable("classes", t => t.HasCheckConstraint("ck_classes_total_seats_positive", "total_seats > 0"));
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
            e.Property(x => x.TotalSeats).HasColumnName("total_seats");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
        });

        model.Entity<Hold>(e =>
        {
            e.ToTable("holds", t => t.HasCheckConstraint(
                "ck_holds_status", "status IN ('HELD','CONFIRMED','EXPIRED','CANCELLED')"));
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.ClassId).HasColumnName("class_id");
            e.Property(x => x.StudentId).HasColumnName("student_id").HasColumnType("char(17)").IsRequired();
            e.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(16);
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            e.Property(x => x.ExpiresAt).HasColumnName("expires_at");
            e.Property(x => x.ConfirmedAt).HasColumnName("confirmed_at");
            e.Property(x => x.CancelledAt).HasColumnName("cancelled_at");
            e.HasOne(x => x.Class).WithMany().HasForeignKey(x => x.ClassId).OnDelete(DeleteBehavior.Restrict);

            // Second line of defence for rule 3: at most one active (HELD/CONFIRMED) hold per student per class.
            e.HasIndex(x => new { x.ClassId, x.StudentId })
                .IsUnique()
                .HasFilter("status IN ('HELD','CONFIRMED')")
                .HasDatabaseName("ux_holds_active_class_student");
            e.HasIndex(x => new { x.ClassId, x.Status }).HasDatabaseName("ix_holds_class_status");
            e.HasIndex(x => x.StudentId).HasDatabaseName("ix_holds_student");
            e.HasIndex(x => x.ExpiresAt).HasFilter("status = 'HELD'").HasDatabaseName("ix_holds_expiring");
        });
    }
}
