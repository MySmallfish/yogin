namespace Letmein.Models;

public class InstructorPayrollEntry
{
    public Guid Id { get; set; }
    public Guid StudioId { get; set; }
    public Guid InstructorId { get; set; }
    public Guid EventInstanceId { get; set; }
    public Guid? ReportedByUserId { get; set; }
    public int DurationMinutes { get; set; }
    public int BookedCount { get; set; }
    public int PresentCount { get; set; }
    public double Units { get; set; }
    public int RateCents { get; set; }
    public PayrollRateUnit RateUnit { get; set; } = PayrollRateUnit.Session;
    public int AmountCents { get; set; }
    public string Currency { get; set; } = "ILS";
    public DateTime ReportedAtUtc { get; set; } = DateTime.UtcNow;
}
