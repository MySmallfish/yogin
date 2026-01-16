using Letmein.Data;
using Letmein.Models;
using Microsoft.EntityFrameworkCore;

namespace Letmein.Services;

public class ScheduleService
{
    private readonly AppDbContext _db;
    private readonly ILogger<ScheduleService> _logger;

    public ScheduleService(AppDbContext db, ILogger<ScheduleService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<int> GenerateInstancesForStudioAsync(Studio studio, DateOnly from, DateOnly to, CancellationToken ct)
    {
        var series = await _db.EventSeries
            .Where(s => s.StudioId == studio.Id && s.IsActive)
            .ToListAsync(ct);

        var total = 0;
        foreach (var item in series)
        {
            total += await GenerateInstancesForSeriesAsync(studio, item, from, to, ct);
        }

        return total;
    }

    public async Task<int> GenerateInstancesForSeriesAsync(Studio studio, EventSeries series, DateOnly from, DateOnly to, CancellationToken ct)
    {
        var tz = ResolveTimeZone(studio.Timezone);
        var fromLocal = from.ToDateTime(TimeOnly.MinValue);
        var toLocal = to.ToDateTime(TimeOnly.MinValue);
        var occurrences = new List<EventInstance>();

        var current = NextOccurrence(fromLocal, (DayOfWeek)series.DayOfWeek, series.StartTimeLocal, series.RecurrenceIntervalWeeks);
        while (current < toLocal)
        {
            var startLocal = current;
            var endLocal = startLocal.AddMinutes(series.DurationMinutes);
            var startUtc = TimeZoneInfo.ConvertTimeToUtc(startLocal, tz);
            var endUtc = TimeZoneInfo.ConvertTimeToUtc(endLocal, tz);

            var exists = await _db.EventInstances
                .AnyAsync(i => i.EventSeriesId == series.Id && i.StartUtc == startUtc, ct);
            var conflicts = !exists && await HasOverlapAsync(studio.Id, startUtc, endUtc, series.RoomId, series.InstructorId, ct);
            if (!exists && !conflicts)
            {
                occurrences.Add(new EventInstance
                {
                    Id = Guid.NewGuid(),
                    StudioId = studio.Id,
                    EventSeriesId = series.Id,
                    InstructorId = series.InstructorId,
                    RoomId = series.RoomId,
                    StartUtc = startUtc,
                    EndUtc = endUtc,
                    Capacity = series.DefaultCapacity,
                    RemoteCapacity = series.RemoteCapacity,
                    PriceCents = series.PriceCents,
                    Currency = series.Currency,
                    RemoteInviteUrl = series.RemoteInviteUrl,
                    CancellationWindowHours = series.CancellationWindowHours,
                    Status = EventStatus.Scheduled
                });
            }
            else if (conflicts)
            {
                _logger.LogInformation("Skipped session for series {SeriesId} at {StartUtc} due to overlap.", series.Id, startUtc);
            }

            current = current.AddDays(7 * Math.Max(series.RecurrenceIntervalWeeks, 1));
        }

        if (occurrences.Count > 0)
        {
            _db.EventInstances.AddRange(occurrences);
            await _db.SaveChangesAsync(ct);
        }

        return occurrences.Count;
    }

    private async Task<bool> HasOverlapAsync(
        Guid studioId,
        DateTime startUtc,
        DateTime endUtc,
        Guid? roomId,
        Guid? instructorId,
        CancellationToken ct)
    {
        if (!roomId.HasValue && !instructorId.HasValue)
        {
            return false;
        }

        var query = _db.EventInstances.AsNoTracking()
            .Where(i => i.StudioId == studioId && i.Status != EventStatus.Cancelled)
            .Where(i => i.StartUtc < endUtc && i.EndUtc > startUtc);

        if (roomId.HasValue && instructorId.HasValue)
        {
            query = query.Where(i => i.RoomId == roomId || i.InstructorId == instructorId);
        }
        else if (roomId.HasValue)
        {
            query = query.Where(i => i.RoomId == roomId);
        }
        else
        {
            query = query.Where(i => i.InstructorId == instructorId);
        }

        return await query.AnyAsync(ct);
    }

    private static DateTime NextOccurrence(DateTime fromLocal, DayOfWeek targetDay, TimeSpan timeOfDay, int intervalWeeks)
    {
        var start = fromLocal.Date.Add(timeOfDay);
        var diff = ((int)targetDay - (int)fromLocal.DayOfWeek + 7) % 7;
        var candidate = fromLocal.Date.AddDays(diff).Add(timeOfDay);
        if (candidate < fromLocal)
        {
            candidate = candidate.AddDays(7 * Math.Max(intervalWeeks, 1));
        }

        return candidate;
    }

    private static TimeZoneInfo ResolveTimeZone(string timeZoneId)
    {
        return TimeZoneInfo.Local;
    }
}

