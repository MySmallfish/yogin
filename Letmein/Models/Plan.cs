namespace Letmein.Models;

public class Plan
{
    public Guid Id { get; set; }
    public Guid StudioId { get; set; }
    public string Name { get; set; } = "";
    public PlanType Type { get; set; } = PlanType.WeeklyLimit;
    public int WeeklyLimit { get; set; } = 2;
    public int PunchCardUses { get; set; } = 0;
    public int PriceCents { get; set; } = 12000;
    public string Currency { get; set; } = "ILS";
    public bool Active { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

