namespace Letmein.Models;

public class Customer
{
    public Guid Id { get; set; }
    public Guid StudioId { get; set; }
    public Guid UserId { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string FullName { get; set; } = "";
    public string Phone { get; set; } = "";
    public DateOnly? DateOfBirth { get; set; }
    public string IdNumber { get; set; } = "";
    public string Gender { get; set; } = "";
    public string City { get; set; } = "";
    public string Address { get; set; } = "";
    public string Occupation { get; set; } = "";
    public bool SignedHealthView { get; set; }
    public Guid? StatusId { get; set; }
    public string TagsJson { get; set; } = "[]";
    public bool IsArchived { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

