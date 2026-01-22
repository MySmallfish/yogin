using System.Text.Json;
using Letmein.Data;
using Letmein.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Letmein.Services;

public class SeedService
{
    private readonly AppDbContext _db;
    private readonly ScheduleService _schedule;
    private readonly ILogger<SeedService> _logger;

    public SeedService(AppDbContext db, ScheduleService schedule, ILogger<SeedService> logger)
    {
        _db = db;
        _schedule = schedule;
        _logger = logger;
    }

    public async Task SeedAsync(CancellationToken ct)
    {
        if (await _db.Studios.AnyAsync(ct))
        {
            return;
        }

        var studio = new Studio
        {
            Id = Guid.NewGuid(),
            Slug = "demo",
            Name = "Yogin Demo Studio",
            Timezone = "UTC",
            WeekStartsOn = 1,
            ThemeJson = "{\"primary\":\"#647FBC\",\"secondary\":\"#9CB4CE\",\"accent\":\"#B9E0D9\",\"background\":\"#F8FAD2\"}",
            DefaultLocale = "en"
        };

        var hasher = new PasswordHasher<AppUser>();
        var admin = new AppUser
        {
            Id = Guid.NewGuid(),
            StudioId = studio.Id,
            Email = "admin@letmein.local",
            Role = UserRole.Admin,
            Roles = UserRole.Admin.ToString(),
            DisplayName = "Studio Admin",
            PasswordHash = ""
        };
        admin.PasswordHash = hasher.HashPassword(admin, "admin123");

        var instructorUser = new AppUser
        {
            Id = Guid.NewGuid(),
            StudioId = studio.Id,
            Email = "instructor@letmein.local",
            Role = UserRole.Instructor,
            Roles = UserRole.Instructor.ToString(),
            DisplayName = "Lead Instructor",
            PasswordHash = ""
        };
        instructorUser.PasswordHash = hasher.HashPassword(instructorUser, "teach123");

        var guestUser = new AppUser
        {
            Id = Guid.NewGuid(),
            StudioId = studio.Id,
            Email = "guest@letmein.local",
            Role = UserRole.Guest,
            Roles = UserRole.Guest.ToString(),
            DisplayName = "Guest Viewer",
            PasswordHash = ""
        };
        guestUser.PasswordHash = hasher.HashPassword(guestUser, "guest123");

        var customerUser = new AppUser
        {
            Id = Guid.NewGuid(),
            StudioId = studio.Id,
            Email = "member@letmein.local",
            Role = UserRole.Customer,
            Roles = UserRole.Customer.ToString(),
            DisplayName = "Demo Member",
            PasswordHash = ""
        };
        customerUser.PasswordHash = hasher.HashPassword(customerUser, "member123");

        var room = new Room
        {
            Id = Guid.NewGuid(),
            StudioId = studio.Id,
            Name = "Main Room"
        };

        var instructor = new Instructor
        {
            Id = Guid.NewGuid(),
            StudioId = studio.Id,
            UserId = instructorUser.Id,
            DisplayName = "Avery Cole",
            Bio = "Power flow + mobility",
            RateCents = 15000,
            RateUnit = PayrollRateUnit.Session,
            RateCurrency = "ILS"
        };

        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            StudioId = studio.Id,
            UserId = customerUser.Id,
            FullName = "Jordan Lee",
            Phone = "+1 555-0134",
            TagsJson = "[\"founder\",\"weekly\"]"
        };

        var plan = new Plan
        {
            Id = Guid.NewGuid(),
            StudioId = studio.Id,
            Name = "2x Weekly Pass",
            Type = PlanType.WeeklyLimit,
            WeeklyLimit = 2,
            PriceCents = 12000,
            Currency = "ILS",
            Active = true
        };

        var membership = new Membership
        {
            Id = Guid.NewGuid(),
            StudioId = studio.Id,
            CustomerId = customer.Id,
            PlanId = plan.Id,
            RemainingUses = 0,
            Status = MembershipStatus.Active,
            StartUtc = DateTime.UtcNow
        };

        var series = new EventSeries
        {
            Id = Guid.NewGuid(),
            StudioId = studio.Id,
            Title = "Studio Flow",
            Description = "Full body flow with core focus",
            InstructorId = instructor.Id,
            RoomId = room.Id,
            DayOfWeek = (int)DayOfWeek.Tuesday,
            DaysOfWeekJson = JsonSerializer.Serialize(new[] { (int)DayOfWeek.Tuesday }),
            StartTimeLocal = new TimeSpan(18, 0, 0),
            DurationMinutes = 60,
            RecurrenceIntervalWeeks = 1,
            DefaultCapacity = 14,
            PriceCents = 2500,
            Currency = "ILS",
            Icon = "flow",
            Color = "#647FBC",
            CancellationWindowHours = 6,
            IsActive = true
        };

        var health = new HealthDeclaration
        {
            Id = Guid.NewGuid(),
            StudioId = studio.Id,
            CustomerId = customer.Id,
            PayloadJson = "{\"acknowledged\":true}",
            SignatureType = "typed",
            SignatureName = customer.FullName
        };

        _db.Studios.Add(studio);
        _db.Users.AddRange(admin, instructorUser, guestUser, customerUser);
        _db.Rooms.Add(room);
        _db.Instructors.Add(instructor);
        _db.Customers.Add(customer);
        _db.Plans.Add(plan);
        _db.Memberships.Add(membership);
        _db.EventSeries.Add(series);
        _db.HealthDeclarations.Add(health);

        await _db.SaveChangesAsync(ct);

        await _schedule.GenerateInstancesForStudioAsync(studio, DateOnly.FromDateTime(DateTime.UtcNow), DateOnly.FromDateTime(DateTime.UtcNow.AddDays(60)), ct);
        _logger.LogInformation("Seeded demo studio with admin login admin@letmein.local / admin123");
    }
}


