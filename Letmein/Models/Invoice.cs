namespace Letmein.Models;

public class Invoice
{
    public Guid Id { get; set; }
    public Guid StudioId { get; set; }
    public Guid? CustomerId { get; set; }
    public string InvoiceNo { get; set; } = "";
    public DateTime IssuedAtUtc { get; set; } = DateTime.UtcNow;
    public int TotalCents { get; set; }
    public string Currency { get; set; } = "ILS";
    public string Url { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
