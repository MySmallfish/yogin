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

        if (instance.StartUtc <= DateTime.UtcNow)
        {
            return (false, "Session is in the past", null, null);
        }

        var existingBooking = await _db.Bookings
            .FirstOrDefaultAsync(b => b.StudioId == studio.Id && b.CustomerId == customer.Id && b.EventInstanceId == instance.Id, ct);
        if (existingBooking != null && existingBooking.Status != BookingStatus.Cancelled)
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

            var eligibility = await CheckMembershipEligibilityAsync(studio, customer, membership, plan, instance, isRemote, ct);
            if (!eligibility.ok)
            {
                return (false, eligibility.error, null, null);
            }
        }

        var series = await _db.EventSeries.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == instance.EventSeriesId && s.StudioId == studio.Id, ct);
        var allowedPlanIds = !string.IsNullOrWhiteSpace(instance.AllowedPlanIdsJson)
            ? ParseGuidList(instance.AllowedPlanIdsJson)
            : ParseGuidList(series?.AllowedPlanIdsJson);
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
            if (existingBooking == null || existingBooking.PaymentId == null)
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
        }
        else if (plan != null && plan.Type == PlanType.PunchCard)
        {
            membership.RemainingUses = Math.Max(0, membership.RemainingUses - 1);
            _db.Memberships.Update(membership);
        }

        Booking booking;
        if (existingBooking != null)
        {
            existingBooking.Status = BookingStatus.Confirmed;
            existingBooking.CancelledAtUtc = null;
            existingBooking.IsRemote = isRemote;
            existingBooking.MembershipId = membership?.Id;
            if (payment?.Id != null)
            {
                existingBooking.PaymentId = payment.Id;
            }
            booking = existingBooking;
            _db.Bookings.Update(existingBooking);
        }
        else
        {
            booking = new Booking
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
        }

        if (membership == null && instance.PriceCents > 0)
        {
            await EnsureBookingChargeAsync(studio, customer, booking, instance, series, ct);
        }

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

        var charge = await _db.BillingCharges
            .FirstOrDefaultAsync(c => c.StudioId == studio.Id && c.SourceType == "session_registration" && c.SourceId == booking.Id, ct);
        if (charge != null && charge.Status != BillingChargeStatus.Voided)
        {
            charge.Status = BillingChargeStatus.Voided;
            charge.VoidReason = "Cancelled booking";
            charge.VoidedAtUtc = DateTime.UtcNow;
            charge.UpdatedAtUtc = DateTime.UtcNow;
            _db.BillingCharges.Update(charge);
        }

        await _db.SaveChangesAsync(ct);
        return (true, "");
    }

    private async Task EnsureBookingChargeAsync(
        Studio studio,
        Customer customer,
        Booking booking,
        EventInstance instance,
        EventSeries? series,
        CancellationToken ct)
    {
        var amount = Math.Max(0, instance.PriceCents);
        if (amount <= 0)
        {
            return;
        }

        var description = $"{series?.Title ?? instance.Title ?? "Session"} - {instance.StartUtc:yyyy-MM-dd}";
        var existingCharge = await _db.BillingCharges
            .FirstOrDefaultAsync(c =>
                c.StudioId == studio.Id &&
                c.SourceType == "session_registration" &&
                c.SourceId == booking.Id, ct);

        if (existingCharge == null)
        {
            var charge = new BillingCharge
            {
                Id = Guid.NewGuid(),
                StudioId = studio.Id,
                CustomerId = customer.Id,
                Status = BillingChargeStatus.Posted,
                ChargeDate = DateTime.UtcNow.Date,
                DueDate = DateTime.UtcNow.Date,
                Currency = instance.Currency,
                SubtotalCents = amount,
                TaxCents = 0,
                TotalCents = amount,
                SourceType = "session_registration",
                SourceId = booking.Id,
                Note = "",
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };
            var lineItem = new BillingChargeLineItem
            {
                Id = Guid.NewGuid(),
                ChargeId = charge.Id,
                Description = description,
                Quantity = 1,
                UnitPriceCents = amount,
                LineSubtotalCents = amount,
                TaxCents = 0,
                LineTotalCents = amount
            };
            _db.BillingCharges.Add(charge);
            _db.BillingChargeLineItems.Add(lineItem);
            return;
        }

        existingCharge.Status = BillingChargeStatus.Posted;
        existingCharge.VoidReason = "";
        existingCharge.VoidedAtUtc = null;
        existingCharge.SubtotalCents = amount;
        existingCharge.TotalCents = amount;
        existingCharge.UpdatedAtUtc = DateTime.UtcNow;
        existingCharge.ChargeDate = DateTime.UtcNow.Date;
        existingCharge.DueDate = DateTime.UtcNow.Date;

        var line = await _db.BillingChargeLineItems.FirstOrDefaultAsync(i => i.ChargeId == existingCharge.Id, ct);
        if (line == null)
        {
            line = new BillingChargeLineItem
            {
                Id = Guid.NewGuid(),
                ChargeId = existingCharge.Id,
                Description = description,
                Quantity = 1,
                UnitPriceCents = amount,
                LineSubtotalCents = amount,
                TaxCents = 0,
                LineTotalCents = amount
            };
            _db.BillingChargeLineItems.Add(line);
        }
        else
        {
            line.Description = description;
            line.UnitPriceCents = amount;
            line.LineSubtotalCents = amount;
            line.LineTotalCents = amount;
            _db.BillingChargeLineItems.Update(line);
        }
        _db.BillingCharges.Update(existingCharge);
    }

    private async Task<(bool ok, string error)> CheckMembershipEligibilityAsync(
        Studio studio,
        Customer customer,
        Membership membership,
        Plan plan,
        EventInstance instance,
        bool isRemote,
        CancellationToken ct)
    {
        if (plan.RemoteOnly && !isRemote)
        {
            return (false, "Plan is limited to remote attendance");
        }

        if (membership.EndUtc.HasValue && instance.StartUtc >= membership.EndUtc.Value)
        {
            return (false, "Membership expired");
        }

        if (plan.DailyLimit.HasValue && plan.DailyLimit.Value > 0)
        {
            var (dayStartUtc, dayEndUtc) = GetDayWindowUtc(studio, instance.StartUtc);
            var count = await _db.Bookings
                .Where(b => b.StudioId == studio.Id && b.CustomerId == customer.Id && b.MembershipId == membership.Id && b.Status == BookingStatus.Confirmed)
                .Join(_db.EventInstances, b => b.EventInstanceId, i => i.Id, (b, i) => new { Booking = b, Instance = i })
                .CountAsync(x => x.Instance.StartUtc >= dayStartUtc && x.Instance.StartUtc < dayEndUtc, ct);
            if (count >= plan.DailyLimit.Value)
            {
                return (false, "Daily limit reached");
            }
        }

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

    private static (DateTime startUtc, DateTime endUtc) GetDayWindowUtc(Studio studio, DateTime instanceStartUtc)
    {
        var tz = ResolveTimeZone(studio.Timezone);
        var local = TimeZoneInfo.ConvertTimeFromUtc(instanceStartUtc, tz).Date;
        var dayStartUtc = TimeZoneInfo.ConvertTimeToUtc(local, tz);
        var dayEndUtc = TimeZoneInfo.ConvertTimeToUtc(local.AddDays(1), tz);
        return (dayStartUtc, dayEndUtc);
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

