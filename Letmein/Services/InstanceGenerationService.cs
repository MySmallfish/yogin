using Letmein.Data;
using Microsoft.EntityFrameworkCore;

namespace Letmein.Services;

public class InstanceGenerationService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<InstanceGenerationService> _logger;

    public InstanceGenerationService(IServiceScopeFactory scopeFactory, ILogger<InstanceGenerationService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var schedule = scope.ServiceProvider.GetRequiredService<ScheduleService>();

                var studios = await db.Studios.AsNoTracking().ToListAsync(stoppingToken);
                var from = DateOnly.FromDateTime(DateTime.UtcNow);
                var to = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(56));
                foreach (var studio in studios)
                {
                    await schedule.GenerateInstancesForStudioAsync(studio, from, to, stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Instance generation failed");
            }

            await Task.Delay(TimeSpan.FromHours(6), stoppingToken);
        }
    }
}

