namespace Letmein.Models;

public class Job
{
    public Guid Id { get; set; }
    public Guid StudioId { get; set; }
    public string Type { get; set; } = "";
    public string PayloadJson { get; set; } = "{}";
    public DateTime RunAtUtc { get; set; }
    public JobStatus Status { get; set; } = JobStatus.Pending;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAtUtc { get; set; }
    public string LastError { get; set; } = "";
}

