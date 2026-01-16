namespace Letmein.Models;

public class CustomerAttachment
{
    public Guid Id { get; set; }
    public Guid StudioId { get; set; }
    public Guid CustomerId { get; set; }
    public string FileName { get; set; } = "";
    public string ContentType { get; set; } = "";
    public string StoragePath { get; set; } = "";
    public DateTime UploadedAtUtc { get; set; } = DateTime.UtcNow;
}
