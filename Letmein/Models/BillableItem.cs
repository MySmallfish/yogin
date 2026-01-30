namespace Letmein.Models;

public class BillableItem
{
    public Guid Id { get; set; }
    public Guid StudioId { get; set; }
    public string Name { get; set; } = "";
    public BillableItemType Type { get; set; } = BillableItemType.Custom;
    public int DefaultPriceCents { get; set; }
    public string Currency { get; set; } = "ILS";
    public string TaxBehavior { get; set; } = "none";
    public string MetadataJson { get; set; } = "{}";
    public bool Active { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
