using Letmein.Models;

namespace Letmein.Contracts;

public record LoginRequest(string Email, string Password, string Role, string StudioSlug);
public record RegisterRequest(string Email, string Password, string StudioSlug, string FullName, string Phone);

public record StudioUpdateRequest(string Name, string Timezone, int WeekStartsOn, string ThemeJson, string? DefaultLocale, string? HolidayCalendarsJson);

public record RoomRequest(string Name);

public record InstructorRequest(
    string DisplayName,
    string Bio,
    Guid? UserId,
    int RateCents,
    PayrollRateUnit RateUnit,
    string RateCurrency);

public record EventSeriesRequest(
    string Title,
    string Description,
    Guid? InstructorId,
    Guid? RoomId,
    int DayOfWeek,
    TimeSpan StartTimeLocal,
    int DurationMinutes,
    int RecurrenceIntervalWeeks,
    int DefaultCapacity,
    int RemoteCapacity,
    int PriceCents,
    string Currency,
    string RemoteInviteUrl,
    string Icon,
    string Color,
    string? AllowedPlanIdsJson,
    int CancellationWindowHours,
    bool IsActive);

public record EventInstanceUpdateRequest(
    Guid? InstructorId,
    Guid? RoomId,
    DateTime? StartUtc,
    DateTime? EndUtc,
    int? Capacity,
    int? RemoteCapacity,
    int? PriceCents,
    string? Currency,
    string? RemoteInviteUrl,
    int? CancellationWindowHours,
    string? Notes,
    EventStatus? Status);

public record EventInstanceCreateRequest(
    string Title,
    string Description,
    DateOnly Date,
    TimeSpan StartTimeLocal,
    int DurationMinutes,
    Guid? InstructorId,
    Guid? RoomId,
    int Capacity,
    int RemoteCapacity,
    int PriceCents,
    string Currency,
    string RemoteInviteUrl,
    string Icon,
    string Color,
    string? AllowedPlanIdsJson,
    int CancellationWindowHours,
    string? Notes,
    EventStatus Status);

public record PlanRequest(string Name, PlanType Type, int WeeklyLimit, int PunchCardUses, int PriceCents, string Currency, bool Active);

public record CouponRequest(string Code, DiscountType DiscountType, int DiscountValue, int MaxUses, DateTime? ValidFromUtc, DateTime? ValidToUtc, bool Active);

public record ProfileUpdateRequest(
    string FullName,
    string Phone,
    string? PreferredLocale,
    string? FirstName,
    string? LastName,
    string? Gender,
    string? City,
    string? Address,
    DateOnly? DateOfBirth,
    string? Occupation,
    string? IdNumber,
    string? Email);

public record CustomerCreateRequest(
    string FullName,
    string Email,
    string Phone,
    string? FirstName,
    string? LastName,
    string? Gender,
    string? City,
    string? Address,
    DateOnly? DateOfBirth,
    string? Occupation,
    Guid? StatusId,
    string? IdNumber,
    bool SignedHealthView,
    string? Tags,
    string? TagsJson,
    string? Password);

public record CustomerUpdateRequest(
    string FullName,
    string Email,
    string Phone,
    string? FirstName,
    string? LastName,
    string? Gender,
    string? City,
    string? Address,
    DateOnly? DateOfBirth,
    string? Occupation,
    Guid? StatusId,
    string? IdNumber,
    bool SignedHealthView,
    string? Tags,
    string? TagsJson,
    bool IsArchived);

public record CustomerStatusRequest(string Name, bool IsDefault, bool IsActive);

public record UserCreateRequest(
    string Email,
    string DisplayName,
    string Role,
    string? Phone,
    string? Address,
    string? Gender,
    string? IdNumber,
    DateOnly? DateOfBirth,
    string? Password,
    string? InstructorDisplayName,
    string? InstructorBio,
    string[]? Roles = null,
    int? InstructorRateCents = null,
    PayrollRateUnit? InstructorRateUnit = null,
    string? InstructorRateCurrency = null);

public record UserUpdateRequest(
    string Email,
    string DisplayName,
    string Role,
    bool IsActive,
    string? Phone,
    string? Address,
    string? Gender,
    string? IdNumber,
    DateOnly? DateOfBirth,
    string? Password,
    string? InstructorDisplayName,
    string? InstructorBio,
    string[]? Roles = null,
    int? InstructorRateCents = null,
    PayrollRateUnit? InstructorRateUnit = null,
    string? InstructorRateCurrency = null);

public record InviteRequest(bool? SendEmail);

public record AdminProfileUpdateRequest(
    string DisplayName,
    string Email,
    string? Password,
    string? AvatarUrl,
    string? PreferredLocale);

public record InstructorInstanceUpdateRequest(
    Guid? RoomId,
    DateOnly? Date,
    TimeSpan? StartTimeLocal,
    int? DurationMinutes,
    string? Notes,
    EventStatus? Status);

public record HealthDeclarationRequest(
    string FirstName,
    string LastName,
    string Email,
    string Phone,
    DateOnly? DateOfBirth,
    string IdNumber,
    string Gender,
    string City,
    string Address,
    string Occupation,
    string HeardAbout,
    bool MarketingConsent,
    bool HighBloodPressure,
    bool Diabetes,
    bool Headaches,
    bool Asthma,
    bool BalanceIssues,
    bool NeckBackShoulderIssues,
    bool JointProblems,
    bool SpineProblems,
    bool DigestiveProblems,
    bool EarProblems,
    bool EyeProblems,
    bool ChronicDisease,
    bool Surgeries,
    bool MenstrualProblems,
    bool Smoker,
    bool Pregnant,
    string? OtherNotes,
    bool Acknowledged,
    bool AgreeToTerms,
    string SignatureName,
    string SignatureType,
    string SignatureDataUrl,
    string? Password);

public record BookingRequest(Guid EventInstanceId, Guid? MembershipId, bool IsRemote);

public record AdminRegistrationRequest(
    Guid? CustomerId,
    string FullName,
    string Email,
    string Phone,
    Guid? MembershipId,
    bool IsRemote,
    bool OverrideHealthWaiver);

public record CheckoutRequest(Guid PlanId, string? CouponCode);

public record AttendanceUpdateRequest(Guid CustomerId, AttendanceStatus Status);

public record PayrollReportRequest(Guid EventInstanceId);

