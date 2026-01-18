namespace Letmein.Models;

public class AppUser
{
    public Guid Id { get; set; }
    public Guid StudioId { get; set; }
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public UserRole Role { get; set; } = UserRole.Customer;
    public string Roles { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string AvatarUrl { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Address { get; set; } = "";
    public string Gender { get; set; } = "";
    public string IdNumber { get; set; } = "";
    public DateOnly? DateOfBirth { get; set; }
    public string? PreferredLocale { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

