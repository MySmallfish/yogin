namespace Letmein.Models;

public class Studio
{
    public Guid Id { get; set; }
    public string Slug { get; set; } = "";
    public string Name { get; set; } = "";
    public string Timezone { get; set; } = "UTC";
    public string ThemeJson { get; set; } = "{}";
    public string DefaultLocale { get; set; } = "en";
    public string HolidayCalendarsJson { get; set; } = "[\"hebrew\"]";
    public int WeekStartsOn { get; set; } = 0;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

