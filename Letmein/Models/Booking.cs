namespace Letmein.Models;

public class Booking
{
    public Guid Id { get; set; }
    public Guid StudioId { get; set; }
    public Guid CustomerId { get; set; }
    public Guid EventInstanceId { get; set; }
    public Guid? MembershipId { get; set; }
    public BookingStatus Status { get; set; } = BookingStatus.Pending;
    public bool IsRemote { get; set; }
    public Guid? PaymentId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? CancelledAtUtc { get; set; }
}

