using System.Globalization;

namespace Letmein.Services;

public record HolidayCalendarEntry(DateOnly Date, string Title, string CalendarId);

public class HolidayService
{
    private static readonly HebrewCalendar HebrewCalendar = new();

    public IReadOnlyList<HolidayCalendarEntry> GetHolidays(
        DateOnly from,
        DateOnly to,
        IEnumerable<string> calendarIds,
        string locale)
    {
        var calendars = new HashSet<string>(
            calendarIds.Where(id => !string.IsNullOrWhiteSpace(id))
                .Select(id => id.Trim().ToLowerInvariant()));
        if (calendars.Count == 0)
        {
            return Array.Empty<HolidayCalendarEntry>();
        }

        var results = new List<HolidayCalendarEntry>();
        var useHebrew = IsHebrewLocale(locale);
        for (var date = from; date < to; date = date.AddDays(1))
        {
            if (calendars.Contains("hebrew"))
            {
                var holidayName = GetHebrewHolidayName(date, useHebrew);
                if (!string.IsNullOrWhiteSpace(holidayName))
                {
                    results.Add(new HolidayCalendarEntry(date, holidayName, "hebrew"));
                }
            }
        }

        return results;
    }

    private static bool IsHebrewLocale(string? locale)
    {
        if (string.IsNullOrWhiteSpace(locale)) return false;
        return locale.Trim().StartsWith("he", StringComparison.OrdinalIgnoreCase);
    }

    private static string? GetHebrewHolidayName(DateOnly date, bool useHebrew)
    {
        var dateTime = date.ToDateTime(new TimeOnly(12, 0));
        var hebrewYear = HebrewCalendar.GetYear(dateTime);
        var isLeap = HebrewCalendar.IsLeapYear(hebrewYear);
        var month = HebrewCalendar.GetMonth(dateTime);
        var day = HebrewCalendar.GetDayOfMonth(dateTime);
        var hebrewMonth = ResolveHebrewMonth(month, isLeap);

        return hebrewMonth switch
        {
            HebrewMonth.Tishrei when day is 1 or 2 => Localize("Rosh Hashanah", "ראש השנה", useHebrew),
            HebrewMonth.Tishrei when day == 10 => Localize("Yom Kippur", "יום כיפור", useHebrew),
            HebrewMonth.Tishrei when day is >= 15 and <= 21 => Localize("Sukkot", "סוכות", useHebrew),
            HebrewMonth.Tishrei when day == 22 => Localize("Shemini Atzeret / Simchat Torah", "שמיני עצרת / שמחת תורה", useHebrew),
            HebrewMonth.Kislev when day >= 25 => Localize("Hanukkah", "חנוכה", useHebrew),
            HebrewMonth.Tevet when day <= 2 => Localize("Hanukkah", "חנוכה", useHebrew),
            HebrewMonth.Adar when !isLeap && day == 14 => Localize("Purim", "פורים", useHebrew),
            HebrewMonth.AdarII when day == 14 => Localize("Purim", "פורים", useHebrew),
            HebrewMonth.Nisan when day is >= 15 and <= 21 => Localize("Passover", "פסח", useHebrew),
            HebrewMonth.Sivan when day == 6 => Localize("Shavuot", "שבועות", useHebrew),
            _ => null
        };
    }

    private static string Localize(string english, string hebrew, bool useHebrew)
    {
        return useHebrew ? hebrew : english;
    }

    private static HebrewMonth ResolveHebrewMonth(int month, bool isLeap)
    {
        if (!isLeap)
        {
            return month switch
            {
                1 => HebrewMonth.Tishrei,
                2 => HebrewMonth.Cheshvan,
                3 => HebrewMonth.Kislev,
                4 => HebrewMonth.Tevet,
                5 => HebrewMonth.Shevat,
                6 => HebrewMonth.Adar,
                7 => HebrewMonth.Nisan,
                8 => HebrewMonth.Iyar,
                9 => HebrewMonth.Sivan,
                10 => HebrewMonth.Tammuz,
                11 => HebrewMonth.Av,
                12 => HebrewMonth.Elul,
                _ => HebrewMonth.Tishrei
            };
        }

        return month switch
        {
            1 => HebrewMonth.Tishrei,
            2 => HebrewMonth.Cheshvan,
            3 => HebrewMonth.Kislev,
            4 => HebrewMonth.Tevet,
            5 => HebrewMonth.Shevat,
            6 => HebrewMonth.Adar,
            7 => HebrewMonth.AdarII,
            8 => HebrewMonth.Nisan,
            9 => HebrewMonth.Iyar,
            10 => HebrewMonth.Sivan,
            11 => HebrewMonth.Tammuz,
            12 => HebrewMonth.Av,
            13 => HebrewMonth.Elul,
            _ => HebrewMonth.Tishrei
        };
    }

    private enum HebrewMonth
    {
        Tishrei = 1,
        Cheshvan = 2,
        Kislev = 3,
        Tevet = 4,
        Shevat = 5,
        Adar = 6,
        AdarII = 7,
        Nisan = 8,
        Iyar = 9,
        Sivan = 10,
        Tammuz = 11,
        Av = 12,
        Elul = 13
    }
}
