namespace Letmein.Models;

public class Coupon
{
    public Guid Id { get; set; }
    public Guid StudioId { get; set; }
    public string Code { get; set; } = "";
    public DiscountType DiscountType { get; set; } = DiscountType.Percent;
    public int DiscountValue { get; set; }
    public int MaxUses { get; set; } = 0;
    public int TimesUsed { get; set; } = 0;
    public DateTime? ValidFromUtc { get; set; }
    public DateTime? ValidToUtc { get; set; }
    public bool Active { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

