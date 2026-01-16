namespace Letmein.Models;

public class Instructor
{
    public Guid Id { get; set; }
    public Guid StudioId { get; set; }
    public Guid? UserId { get; set; }
    public string DisplayName { get; set; } = "";
    public string Bio { get; set; } = "";
    public int RateCents { get; set; }
    public PayrollRateUnit RateUnit { get; set; } = PayrollRateUnit.Session;
    public string RateCurrency { get; set; } = "ILS";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

