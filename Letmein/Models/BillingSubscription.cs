namespace Letmein.Models;

public class BillingSubscription
{
    public Guid Id { get; set; }
    public Guid StudioId { get; set; }
    public Guid CustomerId { get; set; }
    public Guid BillableItemId { get; set; }
    public BillingSubscriptionStatus Status { get; set; } = BillingSubscriptionStatus.Active;
    public DateTime StartDate { get; set; } = DateTime.UtcNow.Date;
    public DateTime? EndDate { get; set; }
    public BillingInterval BillingInterval { get; set; } = BillingInterval.Monthly;
    public int BillingAnchorDay { get; set; } = 1;
    public DateTime NextChargeDate { get; set; } = DateTime.UtcNow.Date;
    public int? PriceOverrideCents { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? CanceledAtUtc { get; set; }
    public DateTime? PausedAtUtc { get; set; }
    public DateTime? ResumedAtUtc { get; set; }
}
