namespace Letmein.Models;

public class Room
{
    public Guid Id { get; set; }
    public Guid StudioId { get; set; }
    public string Name { get; set; } = "";
    public bool SupportsRemote { get; set; }
    public string RemoteLink { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

