namespace Letmein.Models;

public class BillingChargeLineItem
{
    public Guid Id { get; set; }
    public Guid ChargeId { get; set; }
    public Guid? BillableItemId { get; set; }
    public string Description { get; set; } = "";
    public int Quantity { get; set; } = 1;
    public int UnitPriceCents { get; set; }
    public int LineSubtotalCents { get; set; }
    public int TaxCents { get; set; }
    public int LineTotalCents { get; set; }
    public string MetadataJson { get; set; } = "{}";
}
