namespace Letmein.Models;

public class EventSeries
{
    public Guid Id { get; set; }
    public Guid StudioId { get; set; }
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public Guid? InstructorId { get; set; }
    public Guid? RoomId { get; set; }
    public int DayOfWeek { get; set; }
    public string DaysOfWeekJson { get; set; } = "[]";
    public TimeSpan StartTimeLocal { get; set; }
    public int DurationMinutes { get; set; } = 60;
    public int RecurrenceIntervalWeeks { get; set; } = 1;
    public bool IsActive { get; set; } = true;
    public int DefaultCapacity { get; set; } = 12;
    public int RemoteCapacity { get; set; }
    public int PriceCents { get; set; } = 2500;
    public string Currency { get; set; } = "ILS";
    public string RemoteInviteUrl { get; set; } = "";
    public string Icon { get; set; } = "";
    public string Color { get; set; } = "";
    public Guid? PlanCategoryId { get; set; }
    public string AllowedPlanIdsJson { get; set; } = "[]";
    public int CancellationWindowHours { get; set; } = 6;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

