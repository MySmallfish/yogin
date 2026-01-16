namespace Letmein.Models;

public class Attendance
{
    public Guid Id { get; set; }
    public Guid StudioId { get; set; }
    public Guid EventInstanceId { get; set; }
    public Guid CustomerId { get; set; }
    public AttendanceStatus Status { get; set; } = AttendanceStatus.Present;
    public DateTime RecordedAtUtc { get; set; } = DateTime.UtcNow;
}

