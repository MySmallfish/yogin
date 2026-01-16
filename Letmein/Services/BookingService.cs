using Letmein.Data;
using Letmein.Models;
using Microsoft.EntityFrameworkCore;

namespace Letmein.Services;

public class BookingService
{
    private readonly AppDbContext _db;
    private readonly ILogger<BookingService> _logger;

    public BookingService(AppDbContext db, ILogger<BookingService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<(bool ok, string error, Booking? booking, Payment? payment)> CreateBookingAsync(
        Studio studio,
        Customer customer,
        EventInstance instance,
        Guid? membershipId,
        CancellationToken ct,
        bool skipHealthCheck = false,
        bool isRemote = false)
    {
        if (instance.Status != EventStatus.Scheduled)
        {
            return (false, "Event is not available", null, null);
        }

        var existing = await _db.Bookings
            .AnyAsync(b => b.StudioId == studio.Id && b.CustomerId == customer.Id && b.EventInstanceId == instance.Id && b.Status != BookingStatus.Cancelled, ct);
        if (existing)
        {
            return (false, "Already booked", null, null);
        }

        if (!skipHealthCheck)
        {
            if (!customer.SignedHealthView)
            {
                var hasHealth = await _db.HealthDeclarations
                    .AnyAsync(h => h.StudioId == studio.Id && h.CustomerId == customer.Id, ct);
                if (!hasHealth)
                {
                    return (false, "Health declaration required", null, null);
                }

                customer.SignedHealthView = true;
                _db.Customers.Update(customer);
                await _db.SaveChangesAsync(ct);
            }
        }

        var confirmedCount = await _db.Bookings
            .CountAsync(b => b.StudioId == studio.Id && b.EventInstanceId == instance.Id && b.Status == BookingStatus.Confirmed && b.IsRemote == isRemote, ct);
        if (isRemote)
        {
            if (instance.RemoteCapacity <= 0)
            {
                return (false, "Remote attendance unavailable", null, null);
            }
            if (confirmedCount >= instance.RemoteCapacity)
            {
                return (false, "Remote spots are full", null, null);
            }
        }
        else if (confirmedCount >= instance.Capacity)
        {
            return (false, "Class is full", null, null);
        }

        Membership? membership = null;
        Plan? plan = null;
        if (membershipId.HasValue)
        {
            membership = await _db.Memberships.FirstOrDefaultAsync(m => m.Id == membershipId && m.CustomerId == customer.Id && m.StudioId == studio.Id, ct);
            if (membership == null || membership.Status != MembershipStatus.Active)
            {
                return (false, "Membership not active", null, null);
            }

            plan = await _db.Plans.FirstOrDefaultAsync(p => p.Id == membership.PlanId && p.StudioId == studio.Id, ct);
            if (plan == null || !plan.Active)
            {
                return (false, "Plan not available", null, null);
            }

            var eligibility = await CheckMembershipEligibilityAsync(studio, customer, membership, plan, instance, ct);
            if (!eligibility.ok)
            {
                return (false, eligibility.error, null, null);
            }
        }

        var series = await _db.EventSeries.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == instance.EventSeriesId && s.StudioId == studio.Id, ct);
        var allowedPlanIds = ParseGuidList(series?.AllowedPlanIdsJson);
        if (allowedPlanIds.Count > 0)
        {
            if (plan == null)
            {
                return (false, "Plan required for this class", null, null);
            }
            if (!allowedPlanIds.Contains(plan.Id))
            {
                return (false, "Plan not eligible for this class", null, null);
            }
        }

        using var tx = await _db.Database.BeginTransactionAsync(ct);
        var payment = default(Payment);

        if (membership == null)
        {
            payment = new Payment
            {
                Id = Guid.NewGuid(),
                StudioId = studio.Id,
                CustomerId = customer.Id,
                AmountCents = instance.PriceCents,
                Currency = instance.Currency,
                Status = PaymentStatus.Paid,
                Provider = "manual",
                ProviderRef = $"manual-{Guid.NewGuid():N}"
            };
            _db.Payments.Add(payment);
        }
        else if (plan != null && plan.Type == PlanType.PunchCard)
        {
            membership.RemainingUses = Math.Max(0, membership.RemainingUses - 1);
            _db.Memberships.Update(membership);
        }

        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            StudioId = studio.Id,
            CustomerId = customer.Id,
            EventInstanceId = instance.Id,
            MembershipId = membership?.Id,
            PaymentId = payment?.Id,
            Status = BookingStatus.Confirmed,
            IsRemote = isRemote
        };

        _db.Bookings.Add(booking);
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return (true, "", booking, payment);
    }

    public async Task<(bool ok, string error)> CancelBookingAsync(Studio studio, Customer customer, Booking booking, CancellationToken ct)
    {
        if (booking.Status == BookingStatus.Cancelled)
        {
            return (false, "Already cancelled");
        }

        var instance = await _db.EventInstances.FirstOrDefaultAsync(i => i.Id == booking.EventInstanceId && i.StudioId == studio.Id, ct);
        if (instance == null)
        {
            return (false, "Event not found");
        }

        var deadline = instance.StartUtc.AddHours(-instance.CancellationWindowHours);
        if (DateTime.UtcNow > deadline)
        {
            return (false, "Cancellation window closed");
        }

        booking.Status = BookingStatus.Cancelled;
        booking.CancelledAtUtc = DateTime.UtcNow;

        if (booking.MembershipId.HasValue)
        {
            var membership = await _db.Memberships.FirstOrDefaultAsync(m => m.Id == booking.MembershipId && m.CustomerId == customer.Id, ct);
            if (membership != null)
            {
                var plan = await _db.Plans.FirstOrDefaultAsync(p => p.Id == membership.PlanId, ct);
                if (plan?.Type == PlanType.PunchCard)
                {
                    membership.RemainingUses += 1;
                    _db.Memberships.Update(membership);
                }
            }
        }

        _db.Bookings.Update(booking);
        await _db.SaveChangesAsync(ct);
        return (true, "");
    }

    private async Task<(bool ok, string error)> CheckMembershipEligibilityAsync(
        Studio studio,
        Customer customer,
        Membership membership,
        Plan plan,
        EventInstance instance,
        CancellationToken ct)
    {
        switch (plan.Type)
        {
            case PlanType.Unlimited:
                return (true, "");
            case PlanType.PunchCard:
                if (membership.RemainingUses <= 0)
                {
                    return (false, "No remaining uses");
                }
                return (true, "");
            case PlanType.WeeklyLimit:
                var (weekStartUtc, weekEndUtc) = GetWeekWindowUtc(studio, instance.StartUtc);
                var count = await _db.Bookings
                    .Where(b => b.StudioId == studio.Id && b.CustomerId == customer.Id && b.MembershipId == membership.Id && b.Status == BookingStatus.Confirmed)
                    .Join(_db.EventInstances, b => b.EventInstanceId, i => i.Id, (b, i) => new { Booking = b, Instance = i })
                    .CountAsync(x => x.Instance.StartUtc >= weekStartUtc && x.Instance.StartUtc < weekEndUtc, ct);
                if (count >= plan.WeeklyLimit)
                {
                    return (false, "Weekly limit reached");
                }
                return (true, "");
            default:
                return (true, "");
        }
    }

    private static (DateTime startUtc, DateTime endUtc) GetWeekWindowUtc(Studio studio, DateTime instanceStartUtc)
    {
        var tz = ResolveTimeZone(studio.Timezone);
        var local = TimeZoneInfo.ConvertTimeFromUtc(instanceStartUtc, tz).Date;
        var weekStartDay = (DayOfWeek)studio.WeekStartsOn;
        var diff = (7 + (local.DayOfWeek - weekStartDay)) % 7;
        var weekStartLocal = local.AddDays(-diff);
        var weekEndLocal = weekStartLocal.AddDays(7);
        var startUtc = TimeZoneInfo.ConvertTimeToUtc(weekStartLocal, tz);
        var endUtc = TimeZoneInfo.ConvertTimeToUtc(weekEndLocal, tz);
        return (startUtc, endUtc);
    }

    private static TimeZoneInfo ResolveTimeZone(string timeZoneId)
    {
        return TimeZoneInfo.Local;
    }

    private static List<Guid> ParseGuidList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new List<Guid>();
        }
        try
        {
            var parsed = System.Text.Json.JsonSerializer.Deserialize<List<Guid>>(json);
            return parsed?.Where(id => id != Guid.Empty).Distinct().ToList() ?? new List<Guid>();
        }
        catch
        {
            return new List<Guid>();
        }
    }
}

