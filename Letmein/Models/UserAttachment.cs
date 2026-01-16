namespace Letmein.Models;

public class UserAttachment
{
    public Guid Id { get; set; }
    public Guid StudioId { get; set; }
    public Guid UserId { get; set; }
    public string FileName { get; set; } = "";
    public string ContentType { get; set; } = "";
    public string StoragePath { get; set; } = "";
    public DateTime UploadedAtUtc { get; set; } = DateTime.UtcNow;
}
