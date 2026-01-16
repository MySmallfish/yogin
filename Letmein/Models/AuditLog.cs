namespace Letmein.Models;

public class AuditLog
{
    public Guid Id { get; set; }
    public Guid StudioId { get; set; }
    public Guid? ActorUserId { get; set; }
    public string ActorRole { get; set; } = "";
    public string Action { get; set; } = "";
    public string EntityType { get; set; } = "";
    public string EntityId { get; set; } = "";
    public string Summary { get; set; } = "";
    public string DataJson { get; set; } = "{}";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
