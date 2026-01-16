namespace Letmein.Models;

public enum UserRole
{
    Admin = 0,
    Staff = 1,
    Instructor = 2,
    Customer = 3,
    Guest = 4
}

public enum PayrollRateUnit
{
    Session = 0,
    Hour = 1,
    Day = 2,
    Week = 3,
    Month = 4
}

public enum EventStatus
{
    Scheduled = 0,
    Cancelled = 1
}

public enum BookingStatus
{
    Pending = 0,
    Confirmed = 1,
    Cancelled = 2
}

public enum PaymentStatus
{
    Pending = 0,
    Paid = 1,
    Failed = 2,
    Refunded = 3
}

public enum PlanType
{
    WeeklyLimit = 0,
    PunchCard = 1,
    Unlimited = 2
}

public enum DiscountType
{
    Percent = 0,
    Amount = 1
}

public enum MembershipStatus
{
    Active = 0,
    Cancelled = 1,
    Expired = 2
}

public enum AttendanceStatus
{
    Present = 0,
    NoShow = 1
}

public enum JobStatus
{
    Pending = 0,
    Running = 1,
    Completed = 2,
    Failed = 3
}

