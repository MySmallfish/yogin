namespace Letmein.Models;

public class BillingCharge
{
    public Guid Id { get; set; }
    public Guid StudioId { get; set; }
    public Guid CustomerId { get; set; }
    public BillingChargeStatus Status { get; set; } = BillingChargeStatus.Posted;
    public DateTime ChargeDate { get; set; } = DateTime.UtcNow.Date;
    public DateTime? DueDate { get; set; }
    public string Currency { get; set; } = "ILS";
    public int SubtotalCents { get; set; }
    public int TaxCents { get; set; }
    public int TotalCents { get; set; }
    public string SourceType { get; set; } = "";
    public Guid? SourceId { get; set; }
    public DateTime? BillingPeriodStart { get; set; }
    public DateTime? BillingPeriodEnd { get; set; }
    public string Note { get; set; } = "";
    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? VoidedAtUtc { get; set; }
    public string VoidReason { get; set; } = "";
    public Guid? OriginalChargeId { get; set; }
}
