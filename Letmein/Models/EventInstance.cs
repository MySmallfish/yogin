namespace Letmein.Models;

public class EventInstance
{
    public Guid Id { get; set; }
    public Guid StudioId { get; set; }
    public Guid EventSeriesId { get; set; }
    public Guid? InstructorId { get; set; }
    public Guid? RoomId { get; set; }
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public int Capacity { get; set; }
    public int RemoteCapacity { get; set; }
    public int PriceCents { get; set; }
    public string Currency { get; set; } = "ILS";
    public string RemoteInviteUrl { get; set; } = "";
    public int CancellationWindowHours { get; set; }
    public string Notes { get; set; } = "";
    public EventStatus Status { get; set; } = EventStatus.Scheduled;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

