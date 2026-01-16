namespace Letmein.Models;

public class HealthDeclaration
{
    public Guid Id { get; set; }
    public Guid StudioId { get; set; }
    public Guid CustomerId { get; set; }
    public DateTime SubmittedAtUtc { get; set; } = DateTime.UtcNow;
    public string PayloadJson { get; set; } = "{}";
    public string SignatureType { get; set; } = "typed";
    public string SignatureName { get; set; } = "";
}

