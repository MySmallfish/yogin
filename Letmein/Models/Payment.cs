namespace Letmein.Models;

public class Payment
{
    public Guid Id { get; set; }
    public Guid StudioId { get; set; }
    public Guid CustomerId { get; set; }
    public string Provider { get; set; } = "manual";
    public int AmountCents { get; set; }
    public string Currency { get; set; } = "ILS";
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
    public string ProviderRef { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

