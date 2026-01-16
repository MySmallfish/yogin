using Letmein.Models;
using Microsoft.EntityFrameworkCore;

namespace Letmein.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Studio> Studios => Set<Studio>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<Instructor> Instructors => Set<Instructor>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<CustomerAttachment> CustomerAttachments => Set<CustomerAttachment>();
    public DbSet<UserAttachment> UserAttachments => Set<UserAttachment>();
    public DbSet<CustomerStatus> CustomerStatuses => Set<CustomerStatus>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<InstructorPayrollEntry> InstructorPayrollEntries => Set<InstructorPayrollEntry>();
    public DbSet<EventSeries> EventSeries => Set<EventSeries>();
    public DbSet<EventInstance> EventInstances => Set<EventInstance>();
    public DbSet<Plan> Plans => Set<Plan>();
    public DbSet<Coupon> Coupons => Set<Coupon>();
    public DbSet<Membership> Memberships => Set<Membership>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<HealthDeclaration> HealthDeclarations => Set<HealthDeclaration>();
    public DbSet<Attendance> Attendance => Set<Attendance>();
    public DbSet<Job> Jobs => Set<Job>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Studio>().HasIndex(s => s.Slug).IsUnique();
        modelBuilder.Entity<AppUser>().HasIndex(u => new { u.StudioId, u.Email }).IsUnique();
        modelBuilder.Entity<Customer>().HasIndex(c => new { c.StudioId, c.UserId }).IsUnique();
        modelBuilder.Entity<CustomerStatus>().HasIndex(s => new { s.StudioId, s.Name });
        modelBuilder.Entity<CustomerAttachment>().HasIndex(a => new { a.StudioId, a.CustomerId });
        modelBuilder.Entity<UserAttachment>().HasIndex(a => new { a.StudioId, a.UserId });
        modelBuilder.Entity<AuditLog>().HasIndex(a => new { a.StudioId, a.CreatedAtUtc });
        modelBuilder.Entity<InstructorPayrollEntry>().HasIndex(p => new { p.StudioId, p.ReportedAtUtc });
        modelBuilder.Entity<Room>().HasIndex(r => new { r.StudioId, r.Name }).IsUnique();
        modelBuilder.Entity<Instructor>().HasIndex(i => new { i.StudioId, i.DisplayName });
        modelBuilder.Entity<EventSeries>().HasIndex(s => new { s.StudioId, s.Title });
        modelBuilder.Entity<EventInstance>().HasIndex(e => new { e.StudioId, e.StartUtc });
        modelBuilder.Entity<Plan>().HasIndex(p => new { p.StudioId, p.Name }).IsUnique();
        modelBuilder.Entity<Coupon>().HasIndex(c => new { c.StudioId, c.Code }).IsUnique();
        modelBuilder.Entity<Membership>().HasIndex(m => new { m.StudioId, m.CustomerId, m.Status });
        modelBuilder.Entity<Booking>().HasIndex(b => new { b.StudioId, b.CustomerId, b.EventInstanceId }).IsUnique();
    }
}

