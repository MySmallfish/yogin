
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Letmein.Contracts;
using Letmein.Data;
using Letmein.Models;
using Letmein.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Default") ?? "Data Source=letmein.db";
var homePath = Environment.GetEnvironmentVariable("HOME");
if (!string.IsNullOrWhiteSpace(homePath) &&
    connectionString.Contains("Data Source=letmein.db", StringComparison.OrdinalIgnoreCase))
{
    var dbPath = Path.Combine(homePath, "letmein.db");
    connectionString = $"Data Source={dbPath}";
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(connectionString));

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "letmein.auth";
        options.LoginPath = "/admin/#/login";
        options.SlidingExpiration = true;
        options.Events = new CookieAuthenticationEvents
        {
            OnRedirectToLogin = context =>
            {
                if (context.Request.Path.StartsWithSegments("/api"))
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                }

                context.Response.Redirect(context.RedirectUri);
                return Task.CompletedTask;
            },
            OnRedirectToAccessDenied = context =>
            {
                if (context.Request.Path.StartsWithSegments("/api"))
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return Task.CompletedTask;
                }

                context.Response.Redirect(context.RedirectUri);
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("admin", policy =>
        policy.RequireAssertion(ctx => ctx.User.IsInRole(UserRole.Admin.ToString()) || ctx.User.IsInRole(UserRole.Staff.ToString())));
    options.AddPolicy("instructor", policy =>
        policy.RequireAssertion(ctx => ctx.User.IsInRole(UserRole.Instructor.ToString()) || ctx.User.IsInRole(UserRole.Admin.ToString())));
    options.AddPolicy("customer", policy =>
        policy.RequireRole(UserRole.Customer.ToString()));
    options.AddPolicy("guest", policy =>
        policy.RequireAssertion(ctx => ctx.User.IsInRole(UserRole.Guest.ToString()) || ctx.User.IsInRole(UserRole.Admin.ToString())));
});

builder.Services.AddScoped<ScheduleService>();
builder.Services.AddScoped<BookingService>();
builder.Services.AddScoped<SeedService>();
builder.Services.AddSingleton<HolidayService>();
builder.Services.AddSingleton<IFileStorageProvider, LocalFileStorageProvider>();
builder.Services.AddHostedService<InstanceGenerationService>();
builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection("Email"));
builder.Services.AddSingleton<IEmailService, SmtpEmailService>();

builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();


app.MapGet("/", (IWebHostEnvironment env) =>
    Results.File(Path.Combine(env.WebRootPath, "marketing/index.html"), "text/html"));
app.MapGet("/marketing", (IWebHostEnvironment env) =>
    Results.File(Path.Combine(env.WebRootPath, "marketing/index.html"), "text/html"));
app.MapGet("/terms", (IWebHostEnvironment env) =>
    Results.File(Path.Combine(env.WebRootPath, "public/terms.html"), "text/html"));
app.MapGet("/privacy", (IWebHostEnvironment env) =>
    Results.File(Path.Combine(env.WebRootPath, "public/privacy.html"), "text/html"));
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

app.MapPost("/api/auth/login", async (LoginRequest request, AppDbContext db, HttpContext httpContext) =>
{
    if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
    {
        return Results.BadRequest(new { error = "Email and password required" });
    }

    if (!Enum.TryParse<UserRole>(request.Role, true, out var requestedRole))
    {
        return Results.BadRequest(new { error = "Invalid role" });
    }

    var studio = await db.Studios.FirstOrDefaultAsync(s => s.Slug == request.StudioSlug);
    if (studio == null)
    {
        return Results.NotFound(new { error = "Studio not found" });
    }

    var email = request.Email.Trim().ToLowerInvariant();
    var user = await db.Users.FirstOrDefaultAsync(u => u.StudioId == studio.Id && u.Email == email && u.IsActive);
    if (user == null || !UserHasRole(user, requestedRole))
    {
        return Results.Unauthorized();
    }

    var hasher = new PasswordHasher<AppUser>();
    var verified = hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
    if (verified == PasswordVerificationResult.Failed)
    {
        return Results.Unauthorized();
    }

    var userRoles = GetUserRoles(user);
    var claims = new List<Claim>
    {
        new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new Claim(ClaimTypes.Email, user.Email),
        new Claim("active_role", requestedRole.ToString()),
        new Claim("studio_id", studio.Id.ToString()),
        new Claim("studio_slug", studio.Slug),
        new Claim("display_name", user.DisplayName)
    };
    foreach (var userRole in userRoles)
    {
        claims.Add(new Claim(ClaimTypes.Role, userRole.ToString()));
    }

    Guid? customerId = null;
    var signedHealthView = false;
    if (requestedRole == UserRole.Customer)
    {
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.UserId == user.Id && c.StudioId == studio.Id);
        if (customer == null)
        {
            return Results.BadRequest(new { error = "Customer profile missing" });
        }

        signedHealthView = customer.SignedHealthView;
        customerId = customer.Id;
        claims.Add(new Claim("customer_id", customer.Id.ToString()));
    }

    var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
    await httpContext.SignInAsync(new ClaimsPrincipal(identity));

    return Results.Ok(new
    {
        user = new
        {
            id = user.Id,
            email = user.Email,
            role = requestedRole.ToString(),
            roles = userRoles.Select(r => r.ToString()).ToList(),
            displayName = user.DisplayName,
            avatarUrl = user.AvatarUrl,
            preferredLocale = user.PreferredLocale,
            signedHealthView
        },
        studio = new { studio.Id, studio.Name, studio.Slug, studio.DefaultLocale },
        customerId
    });
});

app.MapPost("/api/auth/register", async (RegisterRequest request, AppDbContext db, HttpContext httpContext) =>
{
    if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
    {
        return Results.BadRequest(new { error = "Email and password required" });
    }

    if (string.IsNullOrWhiteSpace(request.FullName))
    {
        return Results.BadRequest(new { error = "Full name required" });
    }

    var studio = await db.Studios.FirstOrDefaultAsync(s => s.Slug == request.StudioSlug);
    if (studio == null)
    {
        return Results.NotFound(new { error = "Studio not found" });
    }

    var email = request.Email.Trim().ToLowerInvariant();
    var existing = await db.Users.AnyAsync(u => u.StudioId == studio.Id && u.Email == email);
    if (existing)
    {
        return Results.Conflict(new { error = "Email already registered" });
    }

    var user = new AppUser
    {
        Id = Guid.NewGuid(),
        StudioId = studio.Id,
        Email = email,
        Role = UserRole.Customer,
        DisplayName = request.FullName.Trim(),
        IsActive = true
    };
    SetUserRoles(user, new[] { UserRole.Customer });

    var hasher = new PasswordHasher<AppUser>();
    user.PasswordHash = hasher.HashPassword(user, request.Password);

    var defaultStatusId = await ResolveCustomerStatusIdAsync(db, studio.Id, null);
    var (firstName, lastName) = ResolveNameParts(request.FullName, null, null);
    var customer = new Customer
    {
        Id = Guid.NewGuid(),
        StudioId = studio.Id,
        UserId = user.Id,
        FirstName = firstName,
        LastName = lastName,
        FullName = request.FullName.Trim(),
        Phone = request.Phone?.Trim() ?? "",
        StatusId = defaultStatusId
    };

    db.Users.Add(user);
    db.Customers.Add(customer);
    await db.SaveChangesAsync();
    await LogAuditRecordAsync(db, studio.Id, user.Id, UserRole.Customer.ToString(), "Register", "Customer", customer.Id.ToString(), $"Customer registered {customer.FullName}", new { customerId = customer.Id, user.Email });

    var claims = new List<Claim>
    {
        new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new Claim(ClaimTypes.Email, user.Email),
        new Claim("active_role", UserRole.Customer.ToString()),
        new Claim("studio_id", studio.Id.ToString()),
        new Claim("studio_slug", studio.Slug),
        new Claim("display_name", user.DisplayName),
        new Claim("customer_id", customer.Id.ToString())
    };
    foreach (var roleValue in GetUserRoles(user))
    {
        claims.Add(new Claim(ClaimTypes.Role, roleValue.ToString()));
    }

    var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
    await httpContext.SignInAsync(new ClaimsPrincipal(identity));

    return Results.Ok(new
    {
        user = new
        {
            id = user.Id,
            email = user.Email,
            role = UserRole.Customer.ToString(),
            roles = GetUserRoles(user).Select(r => r.ToString()).ToList(),
            displayName = user.DisplayName,
            avatarUrl = user.AvatarUrl,
            preferredLocale = user.PreferredLocale,
            signedHealthView = customer.SignedHealthView
        },
        studio = new { studio.Id, studio.Name, studio.Slug, studio.DefaultLocale },
        customerId = customer.Id
    });
});

app.MapPost("/api/auth/logout", async (HttpContext httpContext) =>
{
    await httpContext.SignOutAsync();
    return Results.Ok(new { status = "signed_out" });
});

app.MapGet("/api/auth/me", async (ClaimsPrincipal user, AppDbContext db) =>
{
    if (!user.Identity?.IsAuthenticated ?? true)
    {
        return Results.Unauthorized();
    }

    var userId = GetUserId(user);
    var studioId = GetStudioId(user);
    var currentUser = await db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.StudioId == studioId);
    if (currentUser == null)
    {
        return Results.Unauthorized();
    }
    var studio = await db.Studios.AsNoTracking().FirstOrDefaultAsync(s => s.Id == studioId);
    var customerId = GetCustomerId(user);
    Customer? customer = null;
    if (customerId.HasValue)
    {
        customer = await db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == customerId.Value && c.StudioId == studioId);
    }

    return Results.Ok(new
    {
        user = new
        {
            id = currentUser.Id,
            email = currentUser.Email,
            role = GetActiveRole(user),
            roles = GetUserRoles(currentUser).Select(r => r.ToString()).ToList(),
            displayName = currentUser.DisplayName,
            avatarUrl = currentUser.AvatarUrl,
            preferredLocale = currentUser.PreferredLocale,
            signedHealthView = customer?.SignedHealthView ?? false
        },
        studio = studio == null
            ? null
            : new { studio.Id, studio.Name, studio.Slug, studio.DefaultLocale },
        studioId,
        customerId
    });
});
var publicApi = app.MapGroup("/api/public");

publicApi.MapGet("/studios/{slug}", async (string slug, AppDbContext db) =>
{
    var studio = await db.Studios.AsNoTracking().FirstOrDefaultAsync(s => s.Slug == slug);
    if (studio == null)
    {
        return Results.NotFound();
    }

    return Results.Ok(new
    {
        studio.Id,
        studio.Name,
        studio.Slug,
        studio.Timezone,
        studio.ThemeJson,
        studio.WeekStartsOn,
        studio.DefaultLocale
    });
});

publicApi.MapGet("/studios/{slug}/plans", async (string slug, AppDbContext db) =>
{
    var studio = await db.Studios.AsNoTracking().FirstOrDefaultAsync(s => s.Slug == slug);
    if (studio == null)
    {
        return Results.NotFound();
    }

    var plans = await db.Plans.AsNoTracking()
        .Where(p => p.StudioId == studio.Id && p.Active)
        .OrderBy(p => p.PriceCents)
        .ToListAsync();

    return Results.Ok(plans);
});

publicApi.MapGet("/studios/{slug}/schedule", async (string slug, DateOnly? from, DateOnly? to, AppDbContext db) =>
{
    var studio = await db.Studios.AsNoTracking().FirstOrDefaultAsync(s => s.Slug == slug);
    if (studio == null)
    {
        return Results.NotFound();
    }

    var fromDate = from ?? DateOnly.FromDateTime(DateTime.UtcNow);
    var toDate = to ?? fromDate.AddDays(14);

    var tz = ResolveTimeZone(studio.Timezone);
    var fromUtc = TimeZoneInfo.ConvertTimeToUtc(fromDate.ToDateTime(TimeOnly.MinValue), tz);
    var toUtc = TimeZoneInfo.ConvertTimeToUtc(toDate.ToDateTime(TimeOnly.MinValue), tz);

    var instances = await db.EventInstances.AsNoTracking()
        .Where(i => i.StudioId == studio.Id && i.StartUtc >= fromUtc && i.StartUtc < toUtc && i.Status == EventStatus.Scheduled)
        .OrderBy(i => i.StartUtc)
        .ToListAsync();

    var seriesIds = instances.Select(i => i.EventSeriesId).Distinct().ToList();
    var series = await db.EventSeries.AsNoTracking().Where(s => seriesIds.Contains(s.Id)).ToListAsync();
    var instructors = await db.Instructors.AsNoTracking().Where(i => i.StudioId == studio.Id).ToListAsync();
    var rooms = await db.Rooms.AsNoTracking().Where(r => r.StudioId == studio.Id).ToListAsync();

    var counts = await db.Bookings.AsNoTracking()
        .Where(b => b.StudioId == studio.Id && b.Status == BookingStatus.Confirmed && instances.Select(i => i.Id).Contains(b.EventInstanceId))
        .GroupBy(b => new { b.EventInstanceId, b.IsRemote })
        .Select(g => new { g.Key.EventInstanceId, g.Key.IsRemote, Count = g.Count() })
        .ToListAsync();

    var inPersonMap = counts.Where(x => !x.IsRemote).ToDictionary(x => x.EventInstanceId, x => x.Count);
    var remoteMap = counts.Where(x => x.IsRemote).ToDictionary(x => x.EventInstanceId, x => x.Count);

    var response = instances.Select(instance =>
    {
        var seriesItem = series.FirstOrDefault(s => s.Id == instance.EventSeriesId);
        var instructor = instructors.FirstOrDefault(i => i.Id == instance.InstructorId);
        var room = rooms.FirstOrDefault(r => r.Id == instance.RoomId);
        var booked = inPersonMap.TryGetValue(instance.Id, out var count) ? count : 0;
        var remoteBooked = remoteMap.TryGetValue(instance.Id, out var remoteCount) ? remoteCount : 0;
        var remoteCapacity = instance.RemoteCapacity;

        return (object)new
        {
            instance.Id,
            instance.EventSeriesId,
            instance.StartUtc,
            instance.EndUtc,
            instance.Capacity,
            remoteCapacity,
            remoteInviteUrl = instance.RemoteInviteUrl,
            instance.PriceCents,
            instance.Currency,
            instance.Status,
            booked,
            available = Math.Max(0, instance.Capacity - booked),
            remoteBooked,
            remoteAvailable = Math.Max(0, remoteCapacity - remoteBooked),
            seriesTitle = seriesItem?.Title ?? "",
            seriesIcon = seriesItem?.Icon ?? "",
            seriesColor = seriesItem?.Color ?? "",
            instructorName = instructor?.DisplayName ?? "",
            roomName = room?.Name ?? ""
        };
    });

    return Results.Ok(response);
});

publicApi.MapGet("/studios/{slug}/event-instances/{id:guid}", async (string slug, Guid id, AppDbContext db) =>
{
    var studio = await db.Studios.AsNoTracking().FirstOrDefaultAsync(s => s.Slug == slug);
    if (studio == null)
    {
        return Results.NotFound();
    }

    var instance = await db.EventInstances.AsNoTracking().FirstOrDefaultAsync(i => i.Id == id && i.StudioId == studio.Id);
    if (instance == null)
    {
        return Results.NotFound();
    }

    var series = await db.EventSeries.AsNoTracking().FirstOrDefaultAsync(s => s.Id == instance.EventSeriesId);
    var instructor = await db.Instructors.AsNoTracking().FirstOrDefaultAsync(i => i.Id == instance.InstructorId);
    var room = await db.Rooms.AsNoTracking().FirstOrDefaultAsync(r => r.Id == instance.RoomId);
    var booked = await db.Bookings.AsNoTracking()
        .Where(b => b.EventInstanceId == instance.Id && b.Status == BookingStatus.Confirmed && !b.IsRemote)
        .CountAsync();
    var remoteBooked = await db.Bookings.AsNoTracking()
        .Where(b => b.EventInstanceId == instance.Id && b.Status == BookingStatus.Confirmed && b.IsRemote)
        .CountAsync();
    var available = Math.Max(0, instance.Capacity - booked);
    var remoteCapacity = instance.RemoteCapacity;
    var remoteAvailable = Math.Max(0, remoteCapacity - remoteBooked);
    var allowedPlanIds = ParseGuidList(series?.AllowedPlanIdsJson);

    return Results.Ok(new
    {
        instance.Id,
        instance.EventSeriesId,
        instance.StartUtc,
        instance.EndUtc,
        instance.Capacity,
        remoteCapacity,
        instance.PriceCents,
        instance.Currency,
        remoteInviteUrl = instance.RemoteInviteUrl,
        instance.CancellationWindowHours,
        instance.Status,
        booked,
        available,
        remoteBooked,
        remoteAvailable,
        seriesTitle = series?.Title ?? "",
        seriesIcon = series?.Icon ?? "",
        seriesColor = series?.Color ?? "",
        description = series?.Description ?? "",
        instructorName = instructor?.DisplayName ?? "",
        roomName = room?.Name ?? "",
        allowedPlanIds
    });
});
var adminApi = app.MapGroup("/api/admin").RequireAuthorization("admin");

adminApi.MapGet("/studio", async (ClaimsPrincipal user, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var studio = await db.Studios.AsNoTracking().FirstOrDefaultAsync(s => s.Id == studioId);
    return studio == null ? Results.NotFound() : Results.Ok(studio);
});

adminApi.MapPut("/studio", async (ClaimsPrincipal user, StudioUpdateRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var studio = await db.Studios.FirstOrDefaultAsync(s => s.Id == studioId);
    if (studio == null)
    {
        return Results.NotFound();
    }

    studio.Name = request.Name;
    studio.Timezone = request.Timezone;
    studio.WeekStartsOn = request.WeekStartsOn;
    studio.ThemeJson = request.ThemeJson;
    if (!string.IsNullOrWhiteSpace(request.DefaultLocale))
    {
        studio.DefaultLocale = request.DefaultLocale;
    }
    if (request.HolidayCalendarsJson != null)
    {
        studio.HolidayCalendarsJson = NormalizeStringListJson(request.HolidayCalendarsJson);
    }

    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Update", "Studio", studio.Id.ToString(), $"Updated studio settings for {studio.Name}");
    return Results.Ok(studio);
});

adminApi.MapGet("/rooms", async (ClaimsPrincipal user, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var rooms = await db.Rooms.AsNoTracking().Where(r => r.StudioId == studioId).OrderBy(r => r.Name).ToListAsync();
    return Results.Ok(rooms);
});

adminApi.MapPost("/rooms", async (ClaimsPrincipal user, RoomRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var room = new Room { Id = Guid.NewGuid(), StudioId = studioId, Name = request.Name };
    db.Rooms.Add(room);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Create", "Room", room.Id.ToString(), $"Created room {room.Name}");
    return Results.Created($"/api/admin/rooms/{room.Id}", room);
});

adminApi.MapPut("/rooms/{id:guid}", async (ClaimsPrincipal user, Guid id, RoomRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var room = await db.Rooms.FirstOrDefaultAsync(r => r.Id == id && r.StudioId == studioId);
    if (room == null)
    {
        return Results.NotFound();
    }

    room.Name = request.Name;
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Update", "Room", room.Id.ToString(), $"Updated room {room.Name}");
    return Results.Ok(room);
});

adminApi.MapDelete("/rooms/{id:guid}", async (ClaimsPrincipal user, Guid id, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var room = await db.Rooms.FirstOrDefaultAsync(r => r.Id == id && r.StudioId == studioId);
    if (room == null)
    {
        return Results.NotFound();
    }

    db.Rooms.Remove(room);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Delete", "Room", room.Id.ToString(), $"Deleted room {room.Name}");
    return Results.NoContent();
});

adminApi.MapGet("/instructors", async (ClaimsPrincipal user, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var users = await db.Users.AsNoTracking()
        .Where(u => u.StudioId == studioId)
        .ToListAsync();
    var instructorUsers = users
        .Where(u => GetUserRoles(u).Contains(UserRole.Instructor))
        .OrderBy(u => u.DisplayName)
        .ToList();

    var instructorMap = await db.Instructors
        .Where(i => i.StudioId == studioId && i.UserId != null)
        .ToDictionaryAsync(i => i.UserId!.Value, i => i);

    var missing = instructorUsers.Where(u => !instructorMap.ContainsKey(u.Id)).ToList();
    if (missing.Count > 0)
    {
        foreach (var userRow in missing)
        {
            var instructor = new Instructor
            {
                Id = Guid.NewGuid(),
                StudioId = studioId,
                UserId = userRow.Id,
                DisplayName = userRow.DisplayName,
                Bio = "",
                RateCents = 0,
                RateUnit = PayrollRateUnit.Session,
                RateCurrency = "ILS"
            };
            db.Instructors.Add(instructor);
            instructorMap[userRow.Id] = instructor;
        }
        await db.SaveChangesAsync();
    }

    var response = instructorUsers.Select(userRow =>
    {
        instructorMap.TryGetValue(userRow.Id, out var instructor);
        return (object)new
        {
            Id = instructor?.Id ?? Guid.Empty,
            DisplayName = instructor?.DisplayName ?? userRow.DisplayName,
            Bio = instructor?.Bio ?? "",
            UserId = userRow.Id,
            RateCents = instructor?.RateCents ?? 0,
            RateUnit = instructor?.RateUnit ?? PayrollRateUnit.Session,
            RateCurrency = instructor?.RateCurrency ?? "ILS",
            email = userRow.Email ?? "",
            phone = userRow.Phone ?? "",
            avatarUrl = userRow.AvatarUrl ?? "",
            dateOfBirth = userRow.DateOfBirth
        };
    });
    return Results.Ok(response);
});

adminApi.MapPost("/instructors", async (ClaimsPrincipal user, InstructorRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var instructor = new Instructor
    {
        Id = Guid.NewGuid(),
        StudioId = studioId,
        DisplayName = request.DisplayName,
        Bio = request.Bio,
        UserId = request.UserId,
        RateCents = request.RateCents,
        RateUnit = request.RateUnit,
        RateCurrency = string.IsNullOrWhiteSpace(request.RateCurrency) ? "ILS" : request.RateCurrency.Trim()
    };

    db.Instructors.Add(instructor);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Create", "Instructor", instructor.Id.ToString(), $"Created instructor {instructor.DisplayName}");
    return Results.Created($"/api/admin/instructors/{instructor.Id}", instructor);
});

adminApi.MapPut("/instructors/{id:guid}", async (ClaimsPrincipal user, Guid id, InstructorRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var instructor = await db.Instructors.FirstOrDefaultAsync(i => i.Id == id && i.StudioId == studioId);
    if (instructor == null)
    {
        return Results.NotFound();
    }

    instructor.DisplayName = request.DisplayName;
    instructor.Bio = request.Bio;
    instructor.UserId = request.UserId;
    instructor.RateCents = request.RateCents;
    instructor.RateUnit = request.RateUnit;
    instructor.RateCurrency = string.IsNullOrWhiteSpace(request.RateCurrency) ? "ILS" : request.RateCurrency.Trim();
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Update", "Instructor", instructor.Id.ToString(), $"Updated instructor {instructor.DisplayName}");
    return Results.Ok(instructor);
});

adminApi.MapDelete("/instructors/{id:guid}", async (ClaimsPrincipal user, Guid id, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var instructor = await db.Instructors.FirstOrDefaultAsync(i => i.Id == id && i.StudioId == studioId);
    if (instructor == null)
    {
        return Results.NotFound();
    }

    db.Instructors.Remove(instructor);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Delete", "Instructor", instructor.Id.ToString(), $"Deleted instructor {instructor.DisplayName}");
    return Results.NoContent();
});
adminApi.MapGet("/calendar", async (ClaimsPrincipal user, DateOnly? from, DateOnly? to, AppDbContext db, HolidayService holidayService) =>
{
    var studioId = GetStudioId(user);
    var studio = await db.Studios.AsNoTracking().FirstOrDefaultAsync(s => s.Id == studioId);
    if (studio == null)
    {
        return Results.NotFound();
    }

    var fromDate = from ?? DateOnly.FromDateTime(DateTime.UtcNow);
    var toDate = to ?? fromDate.AddDays(14);
    var tz = ResolveTimeZone(studio.Timezone);
    var fromUtc = TimeZoneInfo.ConvertTimeToUtc(fromDate.ToDateTime(TimeOnly.MinValue), tz);
    var toUtc = TimeZoneInfo.ConvertTimeToUtc(toDate.ToDateTime(TimeOnly.MinValue), tz);

    var instances = await db.EventInstances.AsNoTracking()
        .Where(i => i.StudioId == studioId && i.StartUtc >= fromUtc && i.StartUtc < toUtc)
        .OrderBy(i => i.StartUtc)
        .ToListAsync();

    var seriesMap = await db.EventSeries.AsNoTracking().Where(s => s.StudioId == studioId).ToDictionaryAsync(s => s.Id, s => s);
    var instructorMap = await db.Instructors.AsNoTracking().Where(i => i.StudioId == studioId).ToDictionaryAsync(i => i.Id, i => i);
    var roomMap = await db.Rooms.AsNoTracking().Where(r => r.StudioId == studioId).ToDictionaryAsync(r => r.Id, r => r);

    var counts = await db.Bookings.AsNoTracking()
        .Where(b => b.StudioId == studioId && b.Status == BookingStatus.Confirmed && instances.Select(i => i.Id).Contains(b.EventInstanceId))
        .GroupBy(b => new { b.EventInstanceId, b.IsRemote })
        .Select(g => new { g.Key.EventInstanceId, g.Key.IsRemote, Count = g.Count() })
        .ToListAsync();

    var inPersonMap = counts.Where(x => !x.IsRemote).ToDictionary(x => x.EventInstanceId, x => x.Count);
    var remoteMap = counts.Where(x => x.IsRemote).ToDictionary(x => x.EventInstanceId, x => x.Count);

    var response = instances.Select(instance =>
    {
        seriesMap.TryGetValue(instance.EventSeriesId, out var series);
        instructorMap.TryGetValue(instance.InstructorId ?? Guid.Empty, out var instructor);
        roomMap.TryGetValue(instance.RoomId ?? Guid.Empty, out var room);
        var booked = inPersonMap.TryGetValue(instance.Id, out var count) ? count : 0;
        var remoteBooked = remoteMap.TryGetValue(instance.Id, out var remoteCount) ? remoteCount : 0;

        return (object)new
        {
            instance.Id,
            instance.EventSeriesId,
            instance.InstructorId,
            instance.RoomId,
            instance.StartUtc,
            instance.EndUtc,
            instance.Capacity,
            remoteCapacity = instance.RemoteCapacity,
            instance.Status,
            instance.PriceCents,
            instance.Currency,
            notes = instance.Notes,
            booked,
            remoteBooked,
            remoteInviteUrl = instance.RemoteInviteUrl,
            seriesTitle = series?.Title ?? "",
            seriesIcon = series?.Icon ?? "",
            seriesColor = series?.Color ?? "",
            seriesDescription = series?.Description ?? "",
            instructorName = instructor?.DisplayName ?? "",
            roomName = room?.Name ?? "",
            isHoliday = false,
            isBirthday = false
        };
    }).ToList();

    var holidayCalendars = ParseStringListJson(studio.HolidayCalendarsJson);
    if (holidayCalendars.Count == 0)
    {
        holidayCalendars = new List<string> { "hebrew" };
    }
    if (holidayCalendars.Count > 0)
    {
        var locale = studio.DefaultLocale ?? "en";
        var holidays = holidayService.GetHolidays(fromDate, toDate, holidayCalendars, locale);
        var holidayColor = "#facc15";
        response.AddRange(holidays.Select(holiday =>
        {
            var start = holiday.Date.ToDateTime(new TimeOnly(12, 0));
            return (object)new
            {
                Id = Guid.NewGuid(),
                EventSeriesId = Guid.Empty,
                InstructorId = (Guid?)null,
                RoomId = (Guid?)null,
                StartUtc = start,
                EndUtc = start,
                Capacity = 0,
                remoteCapacity = 0,
                Status = EventStatus.Scheduled,
                PriceCents = 0,
                Currency = "ILS",
                notes = "",
                booked = 0,
                remoteBooked = 0,
                remoteInviteUrl = "",
                seriesTitle = holiday.Title,
                seriesIcon = "",
                seriesColor = holidayColor,
                seriesDescription = "",
                instructorName = "",
                roomName = "",
                isHoliday = true,
                isBirthday = false
            };
        }));
    }

    var birthdayUsers = await db.Users.AsNoTracking()
        .Where(u => u.StudioId == studioId && u.DateOfBirth != null && u.Role != UserRole.Customer)
        .ToListAsync();
    if (birthdayUsers.Count > 0)
    {
        response.AddRange(BuildBirthdayEvents(birthdayUsers, fromDate, toDate, tz, "#fde68a"));
    }

    return Results.Ok(response);
});

adminApi.MapGet("/calendar/export/ics", async (ClaimsPrincipal user, DateOnly? from, DateOnly? to, bool? mine, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var mineOnly = mine == true || (!user.IsInRole(UserRole.Admin.ToString()) && user.IsInRole(UserRole.Instructor.ToString()));
    var instructorId = mineOnly ? await ResolveInstructorIdAsync(db, studioId, GetUserId(user)) : null;
    var (studio, rows) = await LoadCalendarExportRowsAsync(db, studioId, from, to, instructorId);
    if (studio == null)
    {
        return Results.NotFound();
    }
    var payload = BuildCalendarIcs(rows, studio.Name);
    return Results.File(Encoding.UTF8.GetBytes(payload), "text/calendar", "letmein-calendar.ics");
});

adminApi.MapGet("/calendar/export/csv", async (ClaimsPrincipal user, DateOnly? from, DateOnly? to, bool? mine, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var mineOnly = mine == true || (!user.IsInRole(UserRole.Admin.ToString()) && user.IsInRole(UserRole.Instructor.ToString()));
    var instructorId = mineOnly ? await ResolveInstructorIdAsync(db, studioId, GetUserId(user)) : null;
    var (studio, rows) = await LoadCalendarExportRowsAsync(db, studioId, from, to, instructorId);
    if (studio == null)
    {
        return Results.NotFound();
    }
    var tz = ResolveTimeZone(studio.Timezone);
    var payload = BuildCalendarCsv(rows, tz);
    var encoding = new UTF8Encoding(true);
    var bytes = encoding.GetPreamble().Concat(encoding.GetBytes(payload)).ToArray();
    return Results.File(bytes, "text/csv; charset=utf-8", "letmein-calendar.csv");
});

adminApi.MapPost("/event-instances", async (ClaimsPrincipal user, EventInstanceCreateRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var studio = await db.Studios.FirstOrDefaultAsync(s => s.Id == studioId);
    if (studio == null)
    {
        return Results.NotFound();
    }

    if (string.IsNullOrWhiteSpace(request.Title) || request.DurationMinutes <= 0)
    {
        return Results.BadRequest(new { error = "Title and duration required" });
    }

    var tz = ResolveTimeZone(studio.Timezone);
    var startLocal = request.Date.ToDateTime(TimeOnly.FromTimeSpan(request.StartTimeLocal));
    var startUtc = TimeZoneInfo.ConvertTimeToUtc(startLocal, tz);
    var endUtc = startUtc.AddMinutes(request.DurationMinutes);
    var normalizedRoomId = request.RoomId == Guid.Empty ? null : request.RoomId;
    var normalizedInstructorId = request.InstructorId == Guid.Empty ? null : request.InstructorId;
    var overlap = await HasSessionConflictAsync(db, studioId, startUtc, endUtc, normalizedRoomId, normalizedInstructorId, null);
    if (overlap)
    {
        return Results.BadRequest(new { error = "Session overlaps with another scheduled session." });
    }

    var series = new EventSeries
    {
        Id = Guid.NewGuid(),
        StudioId = studioId,
        Title = request.Title,
        Description = request.Description ?? "",
        InstructorId = normalizedInstructorId,
        RoomId = normalizedRoomId,
        DayOfWeek = (int)request.Date.DayOfWeek,
        StartTimeLocal = request.StartTimeLocal,
        DurationMinutes = request.DurationMinutes,
        RecurrenceIntervalWeeks = 1,
        DefaultCapacity = request.Capacity,
        RemoteCapacity = request.RemoteCapacity,
        PriceCents = request.PriceCents,
        Currency = string.IsNullOrWhiteSpace(request.Currency) ? "ILS" : request.Currency,
        RemoteInviteUrl = string.IsNullOrWhiteSpace(request.RemoteInviteUrl) ? "" : request.RemoteInviteUrl,
        Icon = request.Icon ?? "",
        Color = request.Color ?? "",
        AllowedPlanIdsJson = NormalizeGuidListJson(request.AllowedPlanIdsJson),
        CancellationWindowHours = request.CancellationWindowHours,
        IsActive = false
    };

    var instance = new EventInstance
    {
        Id = Guid.NewGuid(),
        StudioId = studioId,
        EventSeriesId = series.Id,
        InstructorId = normalizedInstructorId,
        RoomId = normalizedRoomId,
        StartUtc = startUtc,
        EndUtc = endUtc,
        Capacity = request.Capacity,
        RemoteCapacity = request.RemoteCapacity,
        PriceCents = request.PriceCents,
        Currency = string.IsNullOrWhiteSpace(request.Currency) ? "ILS" : request.Currency,
        RemoteInviteUrl = string.IsNullOrWhiteSpace(request.RemoteInviteUrl) ? "" : request.RemoteInviteUrl,
        CancellationWindowHours = request.CancellationWindowHours,
        Notes = request.Notes ?? "",
        Status = request.Status
    };

    db.EventSeries.Add(series);
    db.EventInstances.Add(instance);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Create", "EventInstance", instance.Id.ToString(), $"Created session {series.Title}", new { seriesId = series.Id, instanceId = instance.Id });

    return Results.Created($"/api/admin/event-instances/{instance.Id}", instance);
});

adminApi.MapPost("/event-instances/{id:guid}/registrations", async (ClaimsPrincipal user, Guid id, AdminRegistrationRequest request, AppDbContext db, BookingService bookingService) =>
{
    var studioId = GetStudioId(user);
    var studio = await db.Studios.FirstOrDefaultAsync(s => s.Id == studioId);
    var instance = await db.EventInstances.FirstOrDefaultAsync(i => i.Id == id && i.StudioId == studioId);
    if (studio == null || instance == null)
    {
        return Results.NotFound();
    }

    Customer? customer = null;
    AppUser? userRow = null;
    var createdCustomer = false;

    if (request.CustomerId.HasValue)
    {
        customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId && c.StudioId == studioId);
        if (customer != null)
        {
            userRow = await db.Users.FirstOrDefaultAsync(u => u.Id == customer.UserId && u.StudioId == studioId);
        }
    }
    else
    {
        if (string.IsNullOrWhiteSpace(request.FullName) || string.IsNullOrWhiteSpace(request.Email))
        {
            return Results.BadRequest(new { error = "Full name and email required" });
        }

        var email = request.Email.Trim().ToLowerInvariant();
        userRow = await db.Users.FirstOrDefaultAsync(u => u.StudioId == studioId && u.Email == email);
        if (userRow != null && !UserHasRole(userRow, UserRole.Customer))
        {
            return Results.Conflict(new { error = "Email belongs to a non-customer account" });
        }

        if (userRow == null)
        {
            createdCustomer = true;
            userRow = new AppUser
            {
                Id = Guid.NewGuid(),
                StudioId = studioId,
                Email = email,
                Role = UserRole.Customer,
                DisplayName = request.FullName.Trim(),
                IsActive = true
            };
            SetUserRoles(userRow, new[] { UserRole.Customer });

            var hasher = new PasswordHasher<AppUser>();
            userRow.PasswordHash = hasher.HashPassword(userRow, GenerateTempPassword());
            db.Users.Add(userRow);
        }
        else
        {
            userRow.DisplayName = request.FullName.Trim();
            userRow.IsActive = true;
            db.Users.Update(userRow);
        }

        customer = await db.Customers.FirstOrDefaultAsync(c => c.UserId == userRow.Id && c.StudioId == studioId);
        if (customer == null)
        {
            var defaultStatusId = await ResolveCustomerStatusIdAsync(db, studioId, null);
            customer = new Customer
            {
                Id = Guid.NewGuid(),
                StudioId = studioId,
                UserId = userRow.Id,
                FullName = request.FullName.Trim(),
                Phone = request.Phone?.Trim() ?? "",
                StatusId = defaultStatusId,
                TagsJson = "[]",
                IsArchived = false
            };
            db.Customers.Add(customer);
        }
        else
        {
            customer.FullName = request.FullName.Trim();
            customer.Phone = request.Phone?.Trim() ?? customer.Phone;
            customer.IsArchived = false;
            db.Customers.Update(customer);
        }

        await db.SaveChangesAsync();
        if (customer != null)
        {
            var action = createdCustomer ? "Create" : "Update";
            var summary = createdCustomer
                ? $"Created customer {customer.FullName}"
                : $"Updated customer {customer.FullName}";
            await LogAuditAsync(db, user, action, "Customer", customer.Id.ToString(), summary);
        }
    }

    if (customer == null || userRow == null)
    {
        return Results.NotFound(new { error = "Customer not found" });
    }

    if (customer.IsArchived || !userRow.IsActive)
    {
        return Results.BadRequest(new { error = "Customer is archived" });
    }

    if (!customer.SignedHealthView)
    {
        if (!request.OverrideHealthWaiver)
        {
            return Results.BadRequest(new { error = "Health declaration required" });
        }

        if (!user.IsInRole(UserRole.Admin.ToString()))
        {
            return Results.Forbid();
        }

        customer.SignedHealthView = true;
        var overridePayload = JsonSerializer.Serialize(new
        {
            overrideWaiver = true,
            confirmedByUserId = GetUserId(user),
            confirmedAtUtc = DateTime.UtcNow
        });
        var overrideDeclaration = new HealthDeclaration
        {
            Id = Guid.NewGuid(),
            StudioId = studioId,
            CustomerId = customer.Id,
            PayloadJson = overridePayload,
            SignatureName = user.FindFirst("display_name")?.Value ?? "Admin",
            SignatureType = "override"
        };
        db.HealthDeclarations.Add(overrideDeclaration);
        db.Customers.Update(customer);
        await db.SaveChangesAsync();
        await LogAuditAsync(db, user, "Override", "HealthDeclaration", overrideDeclaration.Id.ToString(),
            $"Health waiver override for {customer.FullName}");
    }

    var result = await bookingService.CreateBookingAsync(
        studio,
        customer,
        instance,
        request.MembershipId,
        CancellationToken.None,
        isRemote: request.IsRemote);
    if (!result.ok)
    {
        return Results.BadRequest(new { error = result.error });
    }

    var booking = result.booking!;
    await LogAuditAsync(db, user, "Register", "Booking", booking.Id.ToString(), $"Registered {customer.FullName} for session", new { instanceId = instance.Id, customerId = customer.Id, request.IsRemote });
    return Results.Ok(new
    {
        booking,
        customer = new { customer.Id, customer.FullName, customer.Phone, email = userRow!.Email }
    });
});

adminApi.MapGet("/event-instances/{id:guid}/roster", async (ClaimsPrincipal user, Guid id, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var instance = await db.EventInstances.AsNoTracking().FirstOrDefaultAsync(i => i.Id == id && i.StudioId == studioId);
    if (instance == null)
    {
        return Results.NotFound();
    }

    var bookings = await db.Bookings.AsNoTracking()
        .Where(b => b.StudioId == studioId && b.EventInstanceId == id)
        .OrderBy(b => b.CreatedAtUtc)
        .ToListAsync();

    var customerIds = bookings.Select(b => b.CustomerId).Distinct().ToList();
    var customers = await db.Customers.AsNoTracking()
        .Where(c => c.StudioId == studioId && customerIds.Contains(c.Id))
        .ToDictionaryAsync(c => c.Id, c => c);

    var userIds = customers.Values.Select(c => c.UserId).Distinct().ToList();
    var users = await db.Users.AsNoTracking()
        .Where(u => u.StudioId == studioId && userIds.Contains(u.Id))
        .ToDictionaryAsync(u => u.Id, u => u);

    var attendance = await db.Attendance.AsNoTracking()
        .Where(a => a.StudioId == studioId && a.EventInstanceId == id)
        .ToListAsync();
    var attendanceMap = attendance.ToDictionary(a => a.CustomerId, a => a);

    var response = bookings.Select(b =>
    {
        customers.TryGetValue(b.CustomerId, out var customer);
        AppUser? userRow = null;
        if (customer != null)
        {
            users.TryGetValue(customer.UserId, out userRow);
        }
        attendanceMap.TryGetValue(b.CustomerId, out var attendanceRow);

        return (object)new
        {
            bookingId = b.Id,
            customerId = b.CustomerId,
            bookingStatus = b.Status,
            bookedAtUtc = b.CreatedAtUtc,
            isRemote = b.IsRemote,
            customerName = customer?.FullName ?? "",
            phone = customer?.Phone ?? "",
            dateOfBirth = customer?.DateOfBirth,
            email = userRow?.Email ?? "",
            attendanceStatus = attendanceRow?.Status
        };
    });

    return Results.Ok(response);
});

adminApi.MapPost("/event-instances/{id:guid}/attendance", async (ClaimsPrincipal user, Guid id, AttendanceUpdateRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var booking = await db.Bookings.AsNoTracking()
        .FirstOrDefaultAsync(b => b.EventInstanceId == id && b.CustomerId == request.CustomerId && b.StudioId == studioId);
    if (booking == null)
    {
        return Results.NotFound(new { error = "Booking not found" });
    }

    var attendance = await db.Attendance.FirstOrDefaultAsync(a => a.EventInstanceId == id && a.CustomerId == request.CustomerId);
    if (attendance == null)
    {
        attendance = new Attendance
        {
            Id = Guid.NewGuid(),
            StudioId = studioId,
            EventInstanceId = id,
            CustomerId = request.CustomerId,
            Status = request.Status,
            RecordedAtUtc = DateTime.UtcNow
        };
        db.Attendance.Add(attendance);
    }
    else
    {
        attendance.Status = request.Status;
        attendance.RecordedAtUtc = DateTime.UtcNow;
        db.Attendance.Update(attendance);
    }

    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Update", "Attendance", attendance.Id.ToString(), $"Recorded attendance for customer {request.CustomerId}", new { instanceId = id, request.Status });
    return Results.Ok(attendance);
});

adminApi.MapDelete("/event-instances/{id:guid}/attendance/{customerId:guid}", async (ClaimsPrincipal user, Guid id, Guid customerId, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var attendance = await db.Attendance.FirstOrDefaultAsync(a => a.EventInstanceId == id && a.CustomerId == customerId && a.StudioId == studioId);
    if (attendance == null)
    {
        return Results.NoContent();
    }

    db.Attendance.Remove(attendance);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Delete", "Attendance", attendance.Id.ToString(), $"Removed attendance for customer {customerId}", new { instanceId = id });
    return Results.NoContent();
});

adminApi.MapPut("/event-instances/{id:guid}", async (ClaimsPrincipal user, Guid id, EventInstanceUpdateRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var instance = await db.EventInstances.FirstOrDefaultAsync(i => i.Id == id && i.StudioId == studioId);
    if (instance == null)
    {
        return Results.NotFound();
    }

    var nextStartUtc = request.StartUtc ?? instance.StartUtc;
    var nextEndUtc = request.EndUtc ?? instance.EndUtc;
    var requestedRoomId = request.RoomId == Guid.Empty ? null : request.RoomId;
    var requestedInstructorId = request.InstructorId == Guid.Empty ? null : request.InstructorId;
    var roomProvided = request.RoomId.HasValue;
    var instructorProvided = request.InstructorId.HasValue;
    var nextRoomId = roomProvided ? requestedRoomId : instance.RoomId;
    var nextInstructorId = instructorProvided ? requestedInstructorId : instance.InstructorId;
    var nextStatus = request.Status ?? instance.Status;
    var scheduleChanged = nextStartUtc != instance.StartUtc ||
        nextEndUtc != instance.EndUtc ||
        nextRoomId != instance.RoomId ||
        nextInstructorId != instance.InstructorId;
    if (scheduleChanged && nextStatus != EventStatus.Cancelled)
    {
        var overlap = await HasSessionConflictAsync(db, studioId, nextStartUtc, nextEndUtc, nextRoomId, nextInstructorId, instance.Id);
        if (overlap)
        {
            return Results.BadRequest(new { error = "Session overlaps with another scheduled session." });
        }
    }

    if (instructorProvided)
    {
        instance.InstructorId = requestedInstructorId;
    }
    if (roomProvided)
    {
        instance.RoomId = requestedRoomId;
    }

    if (request.StartUtc.HasValue)
    {
        instance.StartUtc = request.StartUtc.Value;
    }

    if (request.EndUtc.HasValue)
    {
        instance.EndUtc = request.EndUtc.Value;
    }

    if (request.Capacity.HasValue)
    {
        instance.Capacity = request.Capacity.Value;
    }
    if (request.RemoteCapacity.HasValue)
    {
        instance.RemoteCapacity = request.RemoteCapacity.Value;
    }

    if (request.PriceCents.HasValue)
    {
        instance.PriceCents = request.PriceCents.Value;
    }

    if (!string.IsNullOrWhiteSpace(request.Currency))
    {
        instance.Currency = request.Currency;
    }
    if (request.RemoteInviteUrl != null)
    {
        instance.RemoteInviteUrl = request.RemoteInviteUrl;
    }

    if (request.CancellationWindowHours.HasValue)
    {
        instance.CancellationWindowHours = request.CancellationWindowHours.Value;
    }
    if (request.Notes != null)
    {
        instance.Notes = request.Notes;
    }

    if (request.Status.HasValue)
    {
        instance.Status = request.Status.Value;
    }

    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Update", "EventInstance", instance.Id.ToString(), "Updated session details", new { instance.Id });
    return Results.Ok(instance);
});

adminApi.MapDelete("/event-instances/{id:guid}", async (ClaimsPrincipal user, Guid id, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var instance = await db.EventInstances.FirstOrDefaultAsync(i => i.Id == id && i.StudioId == studioId);
    if (instance == null)
    {
        return Results.NotFound();
    }

    var bookings = await db.Bookings.Where(b => b.StudioId == studioId && b.EventInstanceId == id).ToListAsync();
    if (bookings.Count > 0)
    {
        db.Bookings.RemoveRange(bookings);
    }

    var attendance = await db.Attendance.Where(a => a.StudioId == studioId && a.EventInstanceId == id).ToListAsync();
    if (attendance.Count > 0)
    {
        db.Attendance.RemoveRange(attendance);
    }

    db.EventInstances.Remove(instance);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Delete", "EventInstance", instance.Id.ToString(), "Deleted session", new { instance.Id });
    return Results.NoContent();
});

adminApi.MapPost("/event-series", async (ClaimsPrincipal user, EventSeriesRequest request, AppDbContext db, ScheduleService scheduleService) =>
{
    var studioId = GetStudioId(user);
    var series = new EventSeries
    {
        Id = Guid.NewGuid(),
        StudioId = studioId,
        Title = request.Title,
        Description = request.Description,
        InstructorId = request.InstructorId,
        RoomId = request.RoomId,
        DayOfWeek = request.DayOfWeek,
        StartTimeLocal = request.StartTimeLocal,
        DurationMinutes = request.DurationMinutes,
        RecurrenceIntervalWeeks = request.RecurrenceIntervalWeeks,
        DefaultCapacity = request.DefaultCapacity,
        RemoteCapacity = request.RemoteCapacity,
        PriceCents = request.PriceCents,
        Currency = string.IsNullOrWhiteSpace(request.Currency) ? "ILS" : request.Currency,
        RemoteInviteUrl = string.IsNullOrWhiteSpace(request.RemoteInviteUrl) ? "" : request.RemoteInviteUrl,
        Icon = request.Icon ?? "",
        Color = request.Color ?? "",
        AllowedPlanIdsJson = NormalizeGuidListJson(request.AllowedPlanIdsJson),
        CancellationWindowHours = request.CancellationWindowHours,
        IsActive = request.IsActive
    };

    db.EventSeries.Add(series);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Create", "EventSeries", series.Id.ToString(), $"Created event series {series.Title}");

    var studio = await db.Studios.AsNoTracking().FirstAsync(s => s.Id == studioId);
    await scheduleService.GenerateInstancesForSeriesAsync(studio, series, DateOnly.FromDateTime(DateTime.UtcNow), DateOnly.FromDateTime(DateTime.UtcNow.AddDays(56)), CancellationToken.None);

    return Results.Created($"/api/admin/event-series/{series.Id}", series);
});

adminApi.MapGet("/event-series", async (ClaimsPrincipal user, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var series = await db.EventSeries.AsNoTracking()
        .Where(s => s.StudioId == studioId)
        .OrderBy(s => s.Title)
        .ToListAsync();
    return Results.Ok(series);
});

adminApi.MapGet("/event-series/{id:guid}", async (ClaimsPrincipal user, Guid id, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var series = await db.EventSeries.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id && s.StudioId == studioId);
    return series == null ? Results.NotFound() : Results.Ok(series);
});

adminApi.MapPut("/event-series/{id:guid}", async (ClaimsPrincipal user, Guid id, EventSeriesRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var series = await db.EventSeries.FirstOrDefaultAsync(s => s.Id == id && s.StudioId == studioId);
    if (series == null)
    {
        return Results.NotFound();
    }

    series.Title = request.Title;
    series.Description = request.Description;
    series.InstructorId = request.InstructorId;
    series.RoomId = request.RoomId;
    series.DayOfWeek = request.DayOfWeek;
    series.StartTimeLocal = request.StartTimeLocal;
    series.DurationMinutes = request.DurationMinutes;
    series.RecurrenceIntervalWeeks = request.RecurrenceIntervalWeeks;
    series.DefaultCapacity = request.DefaultCapacity;
    series.RemoteCapacity = request.RemoteCapacity;
    series.PriceCents = request.PriceCents;
    series.Currency = string.IsNullOrWhiteSpace(request.Currency) ? "ILS" : request.Currency;
    series.RemoteInviteUrl = string.IsNullOrWhiteSpace(request.RemoteInviteUrl) ? "" : request.RemoteInviteUrl;
    series.Icon = request.Icon ?? "";
    series.Color = request.Color ?? "";
    series.AllowedPlanIdsJson = NormalizeGuidListJson(request.AllowedPlanIdsJson);
    series.CancellationWindowHours = request.CancellationWindowHours;
    series.IsActive = request.IsActive;

    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Update", "EventSeries", series.Id.ToString(), $"Updated event series {series.Title}");
    return Results.Ok(series);
});

adminApi.MapDelete("/event-series/{id:guid}", async (ClaimsPrincipal user, Guid id, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var series = await db.EventSeries.FirstOrDefaultAsync(s => s.Id == id && s.StudioId == studioId);
    if (series == null)
    {
        return Results.NotFound();
    }

    var instanceIds = await db.EventInstances
        .Where(i => i.StudioId == studioId && i.EventSeriesId == id)
        .Select(i => i.Id)
        .ToListAsync();

    if (instanceIds.Count > 0)
    {
        var bookings = await db.Bookings
            .Where(b => b.StudioId == studioId && instanceIds.Contains(b.EventInstanceId))
            .ToListAsync();
        if (bookings.Count > 0)
        {
            db.Bookings.RemoveRange(bookings);
        }

        var attendance = await db.Attendance
            .Where(a => a.StudioId == studioId && instanceIds.Contains(a.EventInstanceId))
            .ToListAsync();
        if (attendance.Count > 0)
        {
            db.Attendance.RemoveRange(attendance);
        }

        var instances = await db.EventInstances
            .Where(i => i.StudioId == studioId && i.EventSeriesId == id)
            .ToListAsync();
        if (instances.Count > 0)
        {
            db.EventInstances.RemoveRange(instances);
        }
    }

    db.EventSeries.Remove(series);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Delete", "EventSeries", series.Id.ToString(), $"Deleted event series {series.Title}");
    return Results.NoContent();
});

adminApi.MapPost("/event-series/{id:guid}/generate-instances", async (ClaimsPrincipal user, Guid id, DateOnly? from, DateOnly? to, AppDbContext db, ScheduleService scheduleService) =>
{
    var studioId = GetStudioId(user);
    var studio = await db.Studios.FirstOrDefaultAsync(s => s.Id == studioId);
    var series = await db.EventSeries.FirstOrDefaultAsync(s => s.Id == id && s.StudioId == studioId);
    if (studio == null || series == null)
    {
        return Results.NotFound();
    }

    var fromDate = from ?? DateOnly.FromDateTime(DateTime.UtcNow);
    var toDate = to ?? fromDate.AddDays(56);
    var created = await scheduleService.GenerateInstancesForSeriesAsync(studio, series, fromDate, toDate, CancellationToken.None);
    await LogAuditAsync(db, user, "Generate", "EventSeries", series.Id.ToString(), $"Generated sessions for {series.Title}", new { fromDate, toDate, created });
    return Results.Ok(new { created });
});
adminApi.MapGet("/plans", async (ClaimsPrincipal user, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var plans = await db.Plans.AsNoTracking().Where(p => p.StudioId == studioId).OrderBy(p => p.PriceCents).ToListAsync();
    return Results.Ok(plans);
});

adminApi.MapPost("/plans", async (ClaimsPrincipal user, PlanRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var plan = new Plan
    {
        Id = Guid.NewGuid(),
        StudioId = studioId,
        Name = request.Name,
        Type = request.Type,
        WeeklyLimit = request.WeeklyLimit,
        PunchCardUses = request.PunchCardUses,
        PriceCents = request.PriceCents,
        Currency = request.Currency,
        Active = request.Active
    };
    db.Plans.Add(plan);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Create", "Plan", plan.Id.ToString(), $"Created plan {plan.Name}");
    return Results.Created($"/api/admin/plans/{plan.Id}", plan);
});

adminApi.MapPut("/plans/{id:guid}", async (ClaimsPrincipal user, Guid id, PlanRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var plan = await db.Plans.FirstOrDefaultAsync(p => p.Id == id && p.StudioId == studioId);
    if (plan == null)
    {
        return Results.NotFound();
    }

    plan.Name = request.Name;
    plan.Type = request.Type;
    plan.WeeklyLimit = request.WeeklyLimit;
    plan.PunchCardUses = request.PunchCardUses;
    plan.PriceCents = request.PriceCents;
    plan.Currency = request.Currency;
    plan.Active = request.Active;

    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Update", "Plan", plan.Id.ToString(), $"Updated plan {plan.Name}");
    return Results.Ok(plan);
});

adminApi.MapDelete("/plans/{id:guid}", async (ClaimsPrincipal user, Guid id, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var plan = await db.Plans.FirstOrDefaultAsync(p => p.Id == id && p.StudioId == studioId);
    if (plan == null)
    {
        return Results.NotFound();
    }

    db.Plans.Remove(plan);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Delete", "Plan", plan.Id.ToString(), $"Deleted plan {plan.Name}");
    return Results.NoContent();
});

adminApi.MapGet("/coupons", async (ClaimsPrincipal user, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var coupons = await db.Coupons.AsNoTracking().Where(c => c.StudioId == studioId).OrderBy(c => c.Code).ToListAsync();
    return Results.Ok(coupons);
});

adminApi.MapPost("/coupons", async (ClaimsPrincipal user, CouponRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var coupon = new Coupon
    {
        Id = Guid.NewGuid(),
        StudioId = studioId,
        Code = request.Code.ToUpperInvariant(),
        DiscountType = request.DiscountType,
        DiscountValue = request.DiscountValue,
        MaxUses = request.MaxUses,
        ValidFromUtc = request.ValidFromUtc,
        ValidToUtc = request.ValidToUtc,
        Active = request.Active
    };
    db.Coupons.Add(coupon);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Create", "Coupon", coupon.Id.ToString(), $"Created coupon {coupon.Code}");
    return Results.Created($"/api/admin/coupons/{coupon.Id}", coupon);
});

adminApi.MapPut("/coupons/{id:guid}", async (ClaimsPrincipal user, Guid id, CouponRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var coupon = await db.Coupons.FirstOrDefaultAsync(c => c.Id == id && c.StudioId == studioId);
    if (coupon == null)
    {
        return Results.NotFound();
    }

    coupon.Code = request.Code.ToUpperInvariant();
    coupon.DiscountType = request.DiscountType;
    coupon.DiscountValue = request.DiscountValue;
    coupon.MaxUses = request.MaxUses;
    coupon.ValidFromUtc = request.ValidFromUtc;
    coupon.ValidToUtc = request.ValidToUtc;
    coupon.Active = request.Active;

    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Update", "Coupon", coupon.Id.ToString(), $"Updated coupon {coupon.Code}");
    return Results.Ok(coupon);
});

adminApi.MapDelete("/coupons/{id:guid}", async (ClaimsPrincipal user, Guid id, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var coupon = await db.Coupons.FirstOrDefaultAsync(c => c.Id == id && c.StudioId == studioId);
    if (coupon == null)
    {
        return Results.NotFound();
    }

    db.Coupons.Remove(coupon);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Delete", "Coupon", coupon.Id.ToString(), $"Deleted coupon {coupon.Code}");
    return Results.NoContent();
});

adminApi.MapGet("/customer-statuses", async (ClaimsPrincipal user, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var statuses = await db.CustomerStatuses.AsNoTracking()
        .Where(s => s.StudioId == studioId)
        .OrderByDescending(s => s.IsDefault)
        .ThenBy(s => s.Name)
        .ToListAsync();

    if (statuses.Count == 0)
    {
        var created = await EnsureDefaultCustomerStatusAsync(db, studioId);
        statuses = new List<CustomerStatus> { created };
    }

    return Results.Ok(statuses);
});

adminApi.MapPost("/customer-statuses", async (ClaimsPrincipal user, CustomerStatusRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var name = request.Name?.Trim() ?? "";
    if (string.IsNullOrWhiteSpace(name))
    {
        return Results.BadRequest(new { error = "Status name required" });
    }

    if (request.IsDefault)
    {
        var existingDefaults = await db.CustomerStatuses
            .Where(s => s.StudioId == studioId && s.IsDefault)
            .ToListAsync();
        foreach (var item in existingDefaults)
        {
            item.IsDefault = false;
        }
    }

    var status = new CustomerStatus
    {
        Id = Guid.NewGuid(),
        StudioId = studioId,
        Name = name,
        IsDefault = request.IsDefault,
        IsActive = request.IsActive
    };

    db.CustomerStatuses.Add(status);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Create", "CustomerStatus", status.Id.ToString(), $"Created customer status {status.Name}");
    return Results.Created($"/api/admin/customer-statuses/{status.Id}", status);
});

adminApi.MapPut("/customer-statuses/{id:guid}", async (ClaimsPrincipal user, Guid id, CustomerStatusRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var status = await db.CustomerStatuses.FirstOrDefaultAsync(s => s.Id == id && s.StudioId == studioId);
    if (status == null)
    {
        return Results.NotFound();
    }

    var name = request.Name?.Trim() ?? "";
    if (string.IsNullOrWhiteSpace(name))
    {
        return Results.BadRequest(new { error = "Status name required" });
    }

    status.Name = name;
    status.IsActive = request.IsActive;
    status.IsDefault = request.IsDefault;

    if (request.IsDefault)
    {
        var others = await db.CustomerStatuses
            .Where(s => s.StudioId == studioId && s.Id != status.Id && s.IsDefault)
            .ToListAsync();
        foreach (var item in others)
        {
            item.IsDefault = false;
        }
    }

    await db.SaveChangesAsync();

    var hasDefault = await db.CustomerStatuses.AnyAsync(s => s.StudioId == studioId && s.IsDefault && s.IsActive);
    if (!hasDefault)
    {
        status.IsDefault = true;
        await db.SaveChangesAsync();
    }

    await LogAuditAsync(db, user, "Update", "CustomerStatus", status.Id.ToString(), $"Updated customer status {status.Name}");
    return Results.Ok(status);
});

adminApi.MapDelete("/customer-statuses/{id:guid}", async (ClaimsPrincipal user, Guid id, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var status = await db.CustomerStatuses.FirstOrDefaultAsync(s => s.Id == id && s.StudioId == studioId);
    if (status == null)
    {
        return Results.NotFound();
    }

    status.IsActive = false;
    status.IsDefault = false;
    await db.SaveChangesAsync();

    var hasDefault = await db.CustomerStatuses.AnyAsync(s => s.StudioId == studioId && s.IsDefault && s.IsActive);
    if (!hasDefault)
    {
        var fallback = await db.CustomerStatuses.FirstOrDefaultAsync(s => s.StudioId == studioId && s.IsActive);
        if (fallback != null)
        {
            fallback.IsDefault = true;
            await db.SaveChangesAsync();
        }
    }

    await LogAuditAsync(db, user, "Delete", "CustomerStatus", status.Id.ToString(), $"Archived customer status {status.Name}");
    return Results.NoContent();
});

adminApi.MapGet("/customers", async (ClaimsPrincipal user, string? search, bool? includeArchived, Guid? statusId, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var query = db.Customers.AsNoTracking()
        .Where(c => c.StudioId == studioId);

    if (includeArchived != true)
    {
        query = query.Where(c => !c.IsArchived);
    }

    if (statusId.HasValue)
    {
        query = query.Where(c => c.StatusId == statusId.Value);
    }

    var customers = await query.ToListAsync();
    var userIds = customers.Select(c => c.UserId).ToList();
    var users = await db.Users.AsNoTracking()
        .Where(u => userIds.Contains(u.Id))
        .ToDictionaryAsync(u => u.Id, u => u);
    var statusIds = customers.Where(c => c.StatusId.HasValue).Select(c => c.StatusId!.Value).Distinct().ToList();
    var statusMap = await db.CustomerStatuses.AsNoTracking()
        .Where(s => s.StudioId == studioId && statusIds.Contains(s.Id))
        .ToDictionaryAsync(s => s.Id, s => s.Name);

    var results = customers.Select(c => new
    {
        c.Id,
        c.FirstName,
        c.LastName,
        c.FullName,
        c.Phone,
        c.DateOfBirth,
        c.IdNumber,
        c.Gender,
        c.City,
        c.Address,
        c.Occupation,
        c.SignedHealthView,
        statusId = c.StatusId,
        statusName = c.StatusId.HasValue && statusMap.TryGetValue(c.StatusId.Value, out var name) ? name : "",
        email = users.TryGetValue(c.UserId, out var u) ? u.Email : "",
        tags = TagsToDisplay(c.TagsJson),
        c.TagsJson,
        c.IsArchived
    });

    if (!string.IsNullOrWhiteSpace(search))
    {
        var term = search.Trim();
        results = results.Where(c =>
            c.FullName.Contains(term, StringComparison.OrdinalIgnoreCase) ||
            c.Phone.Contains(term, StringComparison.OrdinalIgnoreCase) ||
            c.email.Contains(term, StringComparison.OrdinalIgnoreCase));
    }

    return Results.Ok(results);
});

adminApi.MapPost("/customers", async (ClaimsPrincipal user, CustomerCreateRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    if (string.IsNullOrWhiteSpace(request.FullName) || string.IsNullOrWhiteSpace(request.Email))
    {
        return Results.BadRequest(new { error = "Full name and email required" });
    }

    var email = request.Email.Trim().ToLowerInvariant();
    var existingUser = await db.Users.FirstOrDefaultAsync(u => u.StudioId == studioId && u.Email == email);
    if (existingUser != null)
    {
        var existingCustomer = await db.Customers.FirstOrDefaultAsync(c => c.UserId == existingUser.Id && c.StudioId == studioId);
        if (existingCustomer != null)
        {
            return Results.Conflict(new { error = "Customer already exists" });
        }
    }

    var userRow = existingUser ?? new AppUser
    {
        Id = Guid.NewGuid(),
        StudioId = studioId,
        Email = email,
        Role = UserRole.Customer,
        DisplayName = request.FullName.Trim(),
        IsActive = true
    };

    if (existingUser == null)
    {
        var password = string.IsNullOrWhiteSpace(request.Password)
            ? GenerateTempPassword()
            : request.Password;
        var hasher = new PasswordHasher<AppUser>();
        userRow.PasswordHash = hasher.HashPassword(userRow, password);
        SetUserRoles(userRow, new[] { UserRole.Customer });
        db.Users.Add(userRow);
    }
    else
    {
        userRow.DisplayName = request.FullName.Trim();
        userRow.IsActive = true;
        var roles = GetUserRoles(userRow);
        if (!roles.Contains(UserRole.Customer))
        {
            roles.Add(UserRole.Customer);
            SetUserRoles(userRow, roles);
        }
        db.Users.Update(userRow);
    }

    var tagsJson = NormalizeTagsJson(request.TagsJson, request.Tags);
    var (firstName, lastName) = ResolveNameParts(request.FullName, request.FirstName, request.LastName);
    var resolvedStatusId = await ResolveCustomerStatusIdAsync(db, studioId, request.StatusId);
    var customer = new Customer
    {
        Id = Guid.NewGuid(),
        StudioId = studioId,
        UserId = userRow.Id,
        FirstName = firstName,
        LastName = lastName,
        FullName = request.FullName.Trim(),
        Phone = request.Phone?.Trim() ?? "",
        DateOfBirth = request.DateOfBirth,
        IdNumber = request.IdNumber?.Trim() ?? "",
        Gender = request.Gender?.Trim() ?? "",
        City = request.City?.Trim() ?? "",
        Address = request.Address?.Trim() ?? "",
        Occupation = request.Occupation?.Trim() ?? "",
        SignedHealthView = request.SignedHealthView,
        StatusId = resolvedStatusId,
        TagsJson = tagsJson,
        IsArchived = false
    };

    db.Customers.Add(customer);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Create", "Customer", customer.Id.ToString(), $"Created customer {customer.FullName}");

    return Results.Created($"/api/admin/customers/{customer.Id}", new
    {
        customer.Id,
        customer.FirstName,
        customer.LastName,
        customer.FullName,
        customer.Phone,
        customer.DateOfBirth,
        statusId = customer.StatusId,
        statusName = await GetStatusNameAsync(db, studioId, customer.StatusId),
        customer.IdNumber,
        customer.Gender,
        customer.City,
        customer.Address,
        customer.Occupation,
        customer.SignedHealthView,
        email = userRow.Email,
        tags = TagsToDisplay(customer.TagsJson),
        customer.TagsJson,
        customer.IsArchived
    });
});

adminApi.MapGet("/customers/{id:guid}", async (ClaimsPrincipal user, Guid id, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var customer = await db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id && c.StudioId == studioId);
    if (customer == null)
    {
        return Results.NotFound();
    }

    var userRow = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == customer.UserId);
    var memberships = await db.Memberships.AsNoTracking().Where(m => m.CustomerId == customer.Id).ToListAsync();
    var bookings = await db.Bookings.AsNoTracking().Where(b => b.CustomerId == customer.Id).OrderByDescending(b => b.CreatedAtUtc).Take(50).ToListAsync();

    return Results.Ok(new
    {
        customer.Id,
        customer.FirstName,
        customer.LastName,
        customer.FullName,
        customer.Phone,
        customer.DateOfBirth,
        customer.IdNumber,
        customer.Gender,
        customer.City,
        customer.Address,
        customer.Occupation,
        customer.SignedHealthView,
        statusId = customer.StatusId,
        statusName = await GetStatusNameAsync(db, studioId, customer.StatusId),
        email = userRow?.Email ?? "",
        tags = TagsToDisplay(customer.TagsJson),
        customer.TagsJson,
        customer.IsArchived,
        memberships,
        bookings
    });
});

adminApi.MapPut("/customers/{id:guid}", async (ClaimsPrincipal user, Guid id, CustomerUpdateRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == id && c.StudioId == studioId);
    if (customer == null)
    {
        return Results.NotFound();
    }

    if (string.IsNullOrWhiteSpace(request.FullName) || string.IsNullOrWhiteSpace(request.Email))
    {
        return Results.BadRequest(new { error = "Full name and email required" });
    }

    var email = request.Email.Trim().ToLowerInvariant();
    var userRow = await db.Users.FirstOrDefaultAsync(u => u.Id == customer.UserId && u.StudioId == studioId);
    if (userRow == null)
    {
        return Results.NotFound(new { error = "User not found" });
    }

    var conflict = await db.Users.AnyAsync(u => u.StudioId == studioId && u.Email == email && u.Id != userRow.Id);
    if (conflict)
    {
        return Results.Conflict(new { error = "Email already in use" });
    }

    customer.FullName = request.FullName.Trim();
    customer.Phone = request.Phone?.Trim() ?? "";
    customer.IdNumber = request.IdNumber?.Trim() ?? "";
    var (firstName, lastName) = ResolveNameParts(customer.FullName, request.FirstName, request.LastName);
    customer.FirstName = firstName;
    customer.LastName = lastName;
    customer.DateOfBirth = request.DateOfBirth;
    customer.Gender = request.Gender?.Trim() ?? "";
    customer.City = request.City?.Trim() ?? "";
    customer.Address = request.Address?.Trim() ?? "";
    customer.Occupation = request.Occupation?.Trim() ?? "";
    customer.SignedHealthView = request.SignedHealthView;
    customer.TagsJson = NormalizeTagsJson(request.TagsJson, request.Tags);
    customer.IsArchived = request.IsArchived;
    if (request.StatusId.HasValue)
    {
        customer.StatusId = await ResolveCustomerStatusIdAsync(db, studioId, request.StatusId);
    }

    userRow.Email = email;
    userRow.DisplayName = customer.FullName;
    userRow.IsActive = !customer.IsArchived;

    db.Customers.Update(customer);
    db.Users.Update(userRow);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Update", "Customer", customer.Id.ToString(), $"Updated customer {customer.FullName}");

    return Results.Ok(new
    {
        customer.Id,
        customer.FirstName,
        customer.LastName,
        customer.FullName,
        customer.Phone,
        customer.DateOfBirth,
        customer.IdNumber,
        customer.Gender,
        customer.City,
        customer.Address,
        customer.Occupation,
        customer.SignedHealthView,
        statusId = customer.StatusId,
        statusName = await GetStatusNameAsync(db, studioId, customer.StatusId),
        email = userRow.Email,
        tags = TagsToDisplay(customer.TagsJson),
        customer.TagsJson,
        customer.IsArchived
    });
});

adminApi.MapGet("/customers/{id:guid}/attachments", async (ClaimsPrincipal user, Guid id, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var customer = await db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id && c.StudioId == studioId);
    if (customer == null)
    {
        return Results.NotFound();
    }

    var attachments = await db.CustomerAttachments.AsNoTracking()
        .Where(a => a.CustomerId == customer.Id && a.StudioId == studioId)
        .OrderByDescending(a => a.UploadedAtUtc)
        .Select(a => new
        {
            a.Id,
            a.FileName,
            a.ContentType,
            a.UploadedAtUtc
        })
        .ToListAsync();

    return Results.Ok(attachments);
});

adminApi.MapPost("/customers/{id:guid}/attachments", async (ClaimsPrincipal user, Guid id, HttpRequest request, AppDbContext db, IFileStorageProvider storage) =>
{
    var studioId = GetStudioId(user);
    var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == id && c.StudioId == studioId);
    if (customer == null)
    {
        return Results.NotFound();
    }

    if (!request.HasFormContentType)
    {
        return Results.BadRequest(new { error = "File upload required" });
    }

    var form = await request.ReadFormAsync(request.HttpContext.RequestAborted);
    var file = form.Files["file"];
    if (file == null || file.Length == 0)
    {
        return Results.BadRequest(new { error = "File upload required" });
    }

    var storagePath = await storage.SaveAsync(file.OpenReadStream(), file.FileName, file.ContentType, request.HttpContext.RequestAborted);
    var attachment = new CustomerAttachment
    {
        Id = Guid.NewGuid(),
        StudioId = studioId,
        CustomerId = customer.Id,
        FileName = file.FileName,
        ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
        StoragePath = storagePath,
        UploadedAtUtc = DateTime.UtcNow
    };

    db.CustomerAttachments.Add(attachment);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Create", "CustomerAttachment", attachment.Id.ToString(), $"Uploaded attachment for customer {customer.FullName}", new { customer.Id, attachment.FileName });

    return Results.Created($"/api/admin/customers/{customer.Id}/attachments/{attachment.Id}", new
    {
        attachment.Id,
        attachment.FileName,
        attachment.ContentType,
        attachment.UploadedAtUtc
    });
});

adminApi.MapGet("/customers/{customerId:guid}/attachments/{attachmentId:guid}", async (ClaimsPrincipal user, Guid customerId, Guid attachmentId, AppDbContext db, IFileStorageProvider storage) =>
{
    var studioId = GetStudioId(user);
    var attachment = await db.CustomerAttachments.AsNoTracking()
        .FirstOrDefaultAsync(a => a.Id == attachmentId && a.CustomerId == customerId && a.StudioId == studioId);
    if (attachment == null)
    {
        return Results.NotFound();
    }

    var stream = await storage.OpenReadAsync(attachment.StoragePath, CancellationToken.None);
    if (stream == null)
    {
        return Results.NotFound();
    }

    return Results.File(stream, attachment.ContentType, attachment.FileName);
});

adminApi.MapDelete("/customers/{customerId:guid}/attachments/{attachmentId:guid}", async (ClaimsPrincipal user, Guid customerId, Guid attachmentId, AppDbContext db, IFileStorageProvider storage) =>
{
    var studioId = GetStudioId(user);
    var attachment = await db.CustomerAttachments.FirstOrDefaultAsync(a => a.Id == attachmentId && a.CustomerId == customerId && a.StudioId == studioId);
    if (attachment == null)
    {
        return Results.NotFound();
    }

    await storage.DeleteAsync(attachment.StoragePath, CancellationToken.None);
    db.CustomerAttachments.Remove(attachment);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Delete", "CustomerAttachment", attachment.Id.ToString(), $"Deleted attachment for customer {customerId}", new { attachment.FileName });
    return Results.NoContent();
});

adminApi.MapGet("/users/{id:guid}/attachments", async (ClaimsPrincipal user, Guid id, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var userRow = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id && u.StudioId == studioId);
    if (userRow == null)
    {
        return Results.NotFound();
    }

    var attachments = await db.UserAttachments.AsNoTracking()
        .Where(a => a.UserId == userRow.Id && a.StudioId == studioId)
        .OrderByDescending(a => a.UploadedAtUtc)
        .Select(a => new
        {
            a.Id,
            a.FileName,
            a.ContentType,
            a.UploadedAtUtc
        })
        .ToListAsync();

    return Results.Ok(attachments);
});

adminApi.MapPost("/users/{id:guid}/attachments", async (ClaimsPrincipal user, Guid id, HttpRequest request, AppDbContext db, IFileStorageProvider storage) =>
{
    var studioId = GetStudioId(user);
    var userRow = await db.Users.FirstOrDefaultAsync(u => u.Id == id && u.StudioId == studioId);
    if (userRow == null)
    {
        return Results.NotFound();
    }

    if (!request.HasFormContentType)
    {
        return Results.BadRequest(new { error = "File upload required" });
    }

    var form = await request.ReadFormAsync(request.HttpContext.RequestAborted);
    var file = form.Files["file"];
    if (file == null || file.Length == 0)
    {
        return Results.BadRequest(new { error = "File upload required" });
    }

    var storagePath = await storage.SaveAsync(file.OpenReadStream(), file.FileName, file.ContentType, request.HttpContext.RequestAborted);
    var attachment = new UserAttachment
    {
        Id = Guid.NewGuid(),
        StudioId = studioId,
        UserId = userRow.Id,
        FileName = file.FileName,
        ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
        StoragePath = storagePath,
        UploadedAtUtc = DateTime.UtcNow
    };

    db.UserAttachments.Add(attachment);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Create", "UserAttachment", attachment.Id.ToString(), $"Uploaded attachment for user {userRow.DisplayName}", new { userRow.Id, attachment.FileName });

    return Results.Created($"/api/admin/users/{userRow.Id}/attachments/{attachment.Id}", new
    {
        attachment.Id,
        attachment.FileName,
        attachment.ContentType,
        attachment.UploadedAtUtc
    });
});

adminApi.MapGet("/users/{userId:guid}/attachments/{attachmentId:guid}", async (ClaimsPrincipal user, Guid userId, Guid attachmentId, AppDbContext db, IFileStorageProvider storage) =>
{
    var studioId = GetStudioId(user);
    var attachment = await db.UserAttachments.AsNoTracking()
        .FirstOrDefaultAsync(a => a.Id == attachmentId && a.UserId == userId && a.StudioId == studioId);
    if (attachment == null)
    {
        return Results.NotFound();
    }

    var stream = await storage.OpenReadAsync(attachment.StoragePath, CancellationToken.None);
    if (stream == null)
    {
        return Results.NotFound();
    }

    return Results.File(stream, attachment.ContentType, attachment.FileName);
});

adminApi.MapDelete("/users/{userId:guid}/attachments/{attachmentId:guid}", async (ClaimsPrincipal user, Guid userId, Guid attachmentId, AppDbContext db, IFileStorageProvider storage) =>
{
    var studioId = GetStudioId(user);
    var attachment = await db.UserAttachments.FirstOrDefaultAsync(a => a.Id == attachmentId && a.UserId == userId && a.StudioId == studioId);
    if (attachment == null)
    {
        return Results.NotFound();
    }

    await storage.DeleteAsync(attachment.StoragePath, CancellationToken.None);
    db.UserAttachments.Remove(attachment);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Delete", "UserAttachment", attachment.Id.ToString(), $"Deleted attachment for user {userId}", new { attachment.FileName });
    return Results.NoContent();
});

adminApi.MapGet("/users", async (ClaimsPrincipal user, AppDbContext db) =>      
{
    var studioId = GetStudioId(user);
    var users = await db.Users.AsNoTracking()
        .Where(u => u.StudioId == studioId && u.Role != UserRole.Customer)
        .OrderBy(u => u.DisplayName)
        .ToListAsync();

    var instructorMap = await db.Instructors.AsNoTracking()
        .Where(i => i.StudioId == studioId && i.UserId != null)
        .ToDictionaryAsync(i => i.UserId!.Value, i => i);

    var response = users.Select(u =>
    {
        instructorMap.TryGetValue(u.Id, out var instructor);
        var roles = GetUserRoles(u);
        return (object)new
        {
            u.Id,
            u.Email,
            u.DisplayName,
            u.Phone,
            u.Address,
            u.Gender,
            u.IdNumber,
            u.DateOfBirth,
            role = u.Role.ToString(),
            roles = roles.Select(r => r.ToString()).ToList(),
            u.IsActive,
            u.CreatedAtUtc,
            instructorId = instructor?.Id,
            instructorName = instructor?.DisplayName ?? "",
            instructorBio = instructor?.Bio ?? "",
            instructorRateCents = instructor?.RateCents ?? 0,
            instructorRateUnit = instructor?.RateUnit ?? PayrollRateUnit.Session,
            instructorRateCurrency = instructor?.RateCurrency ?? "ILS"
        };
    });

    return Results.Ok(response);
});

adminApi.MapPost("/users", async (ClaimsPrincipal user, UserCreateRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.DisplayName))
    {
        return Results.BadRequest(new { error = "Name and email required" });
    }

    var roles = ParseRolesList(request.Roles);
    if (roles.Count == 0 && !string.IsNullOrWhiteSpace(request.Role) &&
        Enum.TryParse<UserRole>(request.Role, true, out var fallbackRole))
    {
        roles = NormalizeRoles(new[] { fallbackRole });
    }
    roles.RemoveAll(r => r == UserRole.Customer);
    if (roles.Count == 0)
    {
        return Results.BadRequest(new { error = "Invalid role" });
    }

    var email = request.Email.Trim().ToLowerInvariant();
    var exists = await db.Users.AnyAsync(u => u.StudioId == studioId && u.Email == email);
    if (exists)
    {
        return Results.Conflict(new { error = "Email already exists" });
    }

    var userRow = new AppUser
    {
        Id = Guid.NewGuid(),
        StudioId = studioId,
        Email = email,
        DisplayName = request.DisplayName.Trim(),
        Phone = request.Phone?.Trim() ?? "",
        Address = request.Address?.Trim() ?? "",
        Gender = request.Gender?.Trim() ?? "",
        IdNumber = request.IdNumber?.Trim() ?? "",
        DateOfBirth = request.DateOfBirth,
        IsActive = true
    };
    SetUserRoles(userRow, roles);

    var password = string.IsNullOrWhiteSpace(request.Password)
        ? GenerateTempPassword()
        : request.Password;
    var hasher = new PasswordHasher<AppUser>();
    userRow.PasswordHash = hasher.HashPassword(userRow, password);
    db.Users.Add(userRow);

    Instructor? instructor = null;
    Customer? guestCustomer = null;
    var createdGuestCustomer = false;
    if (roles.Contains(UserRole.Instructor))
    {
        instructor = new Instructor
        {
            Id = Guid.NewGuid(),
            StudioId = studioId,
            UserId = userRow.Id,
            DisplayName = string.IsNullOrWhiteSpace(request.InstructorDisplayName)
                ? userRow.DisplayName
                : request.InstructorDisplayName.Trim(),
            Bio = request.InstructorBio?.Trim() ?? "",
            RateCents = request.InstructorRateCents ?? 0,
            RateUnit = request.InstructorRateUnit ?? PayrollRateUnit.Session,
            RateCurrency = string.IsNullOrWhiteSpace(request.InstructorRateCurrency)
                ? "ILS"
                : request.InstructorRateCurrency.Trim()
        };
        db.Instructors.Add(instructor);
    }

    if (roles.Contains(UserRole.Guest))
    {
        (guestCustomer, createdGuestCustomer) = await EnsureGuestCustomerAsync(db, studioId, userRow);
    }

    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Create", "User", userRow.Id.ToString(), $"Created user {userRow.DisplayName}", new { userRow.Email, roles });
    if (createdGuestCustomer && guestCustomer != null)
    {
        await LogAuditAsync(db, user, "Create", "Customer", guestCustomer.Id.ToString(), $"Created customer for guest {guestCustomer.FullName}");
    }

    return Results.Created($"/api/admin/users/{userRow.Id}", new
    {
        userRow.Id,
        userRow.Email,
        userRow.DisplayName,
        userRow.Phone,
        userRow.Address,
        userRow.Gender,
        userRow.IdNumber,
        userRow.DateOfBirth,
        role = userRow.Role.ToString(),
        roles = GetUserRoles(userRow).Select(r => r.ToString()).ToList(),
        userRow.IsActive,
        instructorId = instructor?.Id,
        instructorName = instructor?.DisplayName ?? "",
        instructorBio = instructor?.Bio ?? "",
        instructorRateCents = instructor?.RateCents ?? 0,
        instructorRateUnit = instructor?.RateUnit ?? PayrollRateUnit.Session,
        instructorRateCurrency = instructor?.RateCurrency ?? "ILS"
    });
});

adminApi.MapPut("/users/{id:guid}", async (ClaimsPrincipal user, Guid id, UserUpdateRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var userRow = await db.Users.FirstOrDefaultAsync(u => u.Id == id && u.StudioId == studioId);
    if (userRow == null)
    {
        return Results.NotFound();
    }

    if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.DisplayName))
    {
        return Results.BadRequest(new { error = "Name and email required" });
    }

    var roles = ParseRolesList(request.Roles);
    if (roles.Count == 0 && !string.IsNullOrWhiteSpace(request.Role) &&
        Enum.TryParse<UserRole>(request.Role, true, out var fallbackRole))
    {
        roles = NormalizeRoles(new[] { fallbackRole });
    }
    roles.RemoveAll(r => r == UserRole.Customer);
    if (roles.Count == 0)
    {
        return Results.BadRequest(new { error = "Invalid role" });
    }

    var email = request.Email.Trim().ToLowerInvariant();
    var emailExists = await db.Users.AnyAsync(u => u.StudioId == studioId && u.Email == email && u.Id != id);
    if (emailExists)
    {
        return Results.Conflict(new { error = "Email already exists" });
    }

    userRow.Email = email;
    userRow.DisplayName = request.DisplayName.Trim();
    if (request.Phone != null)
    {
        userRow.Phone = request.Phone.Trim();
    }
    if (request.Address != null)
    {
        userRow.Address = request.Address.Trim();
    }
    if (request.Gender != null)
    {
        userRow.Gender = request.Gender.Trim();
    }
    if (request.IdNumber != null)
    {
        userRow.IdNumber = request.IdNumber.Trim();
    }
    userRow.DateOfBirth = request.DateOfBirth;
    SetUserRoles(userRow, roles);
    userRow.IsActive = request.IsActive;

    if (!string.IsNullOrWhiteSpace(request.Password))
    {
        var hasher = new PasswordHasher<AppUser>();
        userRow.PasswordHash = hasher.HashPassword(userRow, request.Password);
    }

    Instructor? instructor = await db.Instructors.FirstOrDefaultAsync(i => i.StudioId == studioId && i.UserId == userRow.Id);
    if (roles.Contains(UserRole.Instructor))
    {
        if (instructor == null)
        {
            instructor = new Instructor
            {
                Id = Guid.NewGuid(),
                StudioId = studioId,
                UserId = userRow.Id,
                DisplayName = string.IsNullOrWhiteSpace(request.InstructorDisplayName)
                    ? userRow.DisplayName
                    : request.InstructorDisplayName.Trim(),
                Bio = request.InstructorBio?.Trim() ?? "",
                RateCents = request.InstructorRateCents ?? 0,
                RateUnit = request.InstructorRateUnit ?? PayrollRateUnit.Session,
                RateCurrency = string.IsNullOrWhiteSpace(request.InstructorRateCurrency)
                    ? "ILS"
                    : request.InstructorRateCurrency.Trim()
            };
            db.Instructors.Add(instructor);
        }
        else
        {
            if (request.InstructorDisplayName != null)
            {
                instructor.DisplayName = request.InstructorDisplayName.Trim();
            }
            if (request.InstructorBio != null)
            {
                instructor.Bio = request.InstructorBio.Trim();
            }
            if (request.InstructorRateCents.HasValue)
            {
                instructor.RateCents = request.InstructorRateCents.Value;
            }
            if (request.InstructorRateUnit.HasValue)
            {
                instructor.RateUnit = request.InstructorRateUnit.Value;
            }
            if (request.InstructorRateCurrency != null)
            {
                instructor.RateCurrency = string.IsNullOrWhiteSpace(request.InstructorRateCurrency)
                    ? "ILS"
                    : request.InstructorRateCurrency.Trim();
            }
            db.Instructors.Update(instructor);
        }
    }
    else if (instructor != null)
    {
        instructor.UserId = null;
        db.Instructors.Update(instructor);
        instructor = null;
    }

    Customer? guestCustomer = null;
    var createdGuestCustomer = false;
    if (roles.Contains(UserRole.Guest))
    {
        (guestCustomer, createdGuestCustomer) = await EnsureGuestCustomerAsync(db, studioId, userRow);
    }

    db.Users.Update(userRow);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Update", "User", userRow.Id.ToString(), $"Updated user {userRow.DisplayName}", new { userRow.Email, roles });
    if (createdGuestCustomer && guestCustomer != null)
    {
        await LogAuditAsync(db, user, "Create", "Customer", guestCustomer.Id.ToString(), $"Created customer for guest {guestCustomer.FullName}");
    }

    return Results.Ok(new
    {
        userRow.Id,
        userRow.Email,
        userRow.DisplayName,
        userRow.Phone,
        userRow.Address,
        userRow.Gender,
        userRow.IdNumber,
        userRow.DateOfBirth,
        role = userRow.Role.ToString(),
        roles = GetUserRoles(userRow).Select(r => r.ToString()).ToList(),
        userRow.AvatarUrl,
        userRow.IsActive,
        instructorId = instructor?.Id,
        instructorName = instructor?.DisplayName ?? "",
        instructorBio = instructor?.Bio ?? "",
        instructorRateCents = instructor?.RateCents ?? 0,
        instructorRateUnit = instructor?.RateUnit ?? PayrollRateUnit.Session,
        instructorRateCurrency = instructor?.RateCurrency ?? "ILS"
    });
});

adminApi.MapPut("/profile", async (ClaimsPrincipal user, AdminProfileUpdateRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var userId = GetUserId(user);
    var userRow = await db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.StudioId == studioId);
    if (userRow == null)
    {
        return Results.NotFound();
    }

    if (string.IsNullOrWhiteSpace(request.DisplayName) || string.IsNullOrWhiteSpace(request.Email))
    {
        return Results.BadRequest(new { error = "Name and email required." });
    }

    var email = request.Email.Trim().ToLowerInvariant();
    var emailExists = await db.Users.AnyAsync(u => u.StudioId == studioId && u.Email == email && u.Id != userId);
    if (emailExists)
    {
        return Results.Conflict(new { error = "Email already in use." });
    }

    userRow.DisplayName = request.DisplayName.Trim();
    userRow.Email = email;
    userRow.AvatarUrl = request.AvatarUrl?.Trim() ?? "";
    userRow.PreferredLocale = string.IsNullOrWhiteSpace(request.PreferredLocale)
        ? null
        : request.PreferredLocale.Trim();

    if (!string.IsNullOrWhiteSpace(request.Password))
    {
        var hasher = new PasswordHasher<AppUser>();
        userRow.PasswordHash = hasher.HashPassword(userRow, request.Password);
    }

    db.Users.Update(userRow);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Update", "UserProfile", userRow.Id.ToString(), $"Updated profile for {userRow.DisplayName}");

    return Results.Ok(new
    {
        userRow.Id,
        userRow.Email,
        userRow.DisplayName,
        role = userRow.Role.ToString(),
        roles = GetUserRoles(userRow).Select(r => r.ToString()).ToList(),
        avatarUrl = userRow.AvatarUrl,
        preferredLocale = userRow.PreferredLocale
    });
});

adminApi.MapPost("/users/{id:guid}/invite", async (ClaimsPrincipal user, Guid id, InviteRequest request, AppDbContext db, HttpContext httpContext, IEmailService emailService) =>
{
    var studioId = GetStudioId(user);
    var userRow = await db.Users.FirstOrDefaultAsync(u => u.Id == id && u.StudioId == studioId);
    if (userRow == null)
    {
        return Results.NotFound();
    }

    var studio = await db.Studios.AsNoTracking().FirstOrDefaultAsync(s => s.Id == studioId);
    var sendEmail = request.SendEmail ?? true;
    if (sendEmail && !emailService.IsConfigured)
    {
        return Results.BadRequest(new { error = "Email delivery is not configured." });
    }

    var previousHash = userRow.PasswordHash;
    var previousActive = userRow.IsActive;
    var tempPassword = GenerateTempPassword();
    var hasher = new PasswordHasher<AppUser>();
    userRow.PasswordHash = hasher.HashPassword(userRow, tempPassword);
    userRow.IsActive = true;
    db.Users.Update(userRow);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Update", "User", userRow.Id.ToString(), $"Reset password for {userRow.DisplayName}");

    var rolesList = GetUserRoles(userRow);
    var primaryRole = GetPrimaryRole(rolesList);
    var portalPath = primaryRole switch
    {
        UserRole.Instructor => "/instructor",
        UserRole.Guest => "/guest",
        UserRole.Customer => "/app",
        _ => "/admin"
    };

    var host = $"{httpContext.Request.Scheme}://{httpContext.Request.Host}";
    var portalUrl = $"{host}{portalPath}";
    var studioName = studio?.Name ?? "Letmein Studio";
    var studioSlug = studio?.Slug ?? "";
    var role = primaryRole.ToString();
    var rolesLabel = string.Join(", ", rolesList.Select(r => r.ToString()));

    var subject = $"{studioName} access on Letmein";
    var body = $"Hi {userRow.DisplayName},\n\n" +
               $"You have been invited to {studioName} on Letmein.\n\n" +
               $"Role: {role}\n" +
               $"Roles: {rolesLabel}\n" +
               $"Login URL: {portalUrl}\n" +
               $"Studio slug: {studioSlug}\n" +
               $"Email: {userRow.Email}\n" +
               $"Temporary password: {tempPassword}\n\n" +
               "Please log in and change your password.";

    if (sendEmail)
    {
        try
        {
            await emailService.SendAsync(userRow.Email, subject, body, httpContext.RequestAborted);
        }
        catch
        {
            userRow.PasswordHash = previousHash;
            userRow.IsActive = previousActive;
            db.Users.Update(userRow);
            await db.SaveChangesAsync();
            return Results.Problem("Unable to send invite email.");
        }
    }

    return Results.Ok(new
    {
        sent = sendEmail,
        email = userRow.Email,
        role,
        portalUrl,
        subject,
        body,
        tempPassword
    });
});

adminApi.MapGet("/reports/occupancy", async (ClaimsPrincipal user, DateOnly? from, DateOnly? to, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var studio = await db.Studios.AsNoTracking().FirstOrDefaultAsync(s => s.Id == studioId);
    if (studio == null)
    {
        return Results.NotFound();
    }

    var fromDate = from ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30));
    var toDate = to ?? DateOnly.FromDateTime(DateTime.UtcNow);

    var tz = ResolveTimeZone(studio.Timezone);
    var fromUtc = TimeZoneInfo.ConvertTimeToUtc(fromDate.ToDateTime(TimeOnly.MinValue), tz);
    var toUtc = TimeZoneInfo.ConvertTimeToUtc(toDate.ToDateTime(TimeOnly.MinValue), tz);

    var instances = await db.EventInstances.AsNoTracking()
        .Where(i => i.StudioId == studioId && i.StartUtc >= fromUtc && i.StartUtc < toUtc)
        .ToListAsync();

    var bookings = await db.Bookings.AsNoTracking()
        .Where(b => b.StudioId == studioId && b.Status == BookingStatus.Confirmed && !b.IsRemote && instances.Select(i => i.Id).Contains(b.EventInstanceId))
        .ToListAsync();

    var grouped = instances.GroupBy(i => i.EventSeriesId)
        .Select(g => new
        {
            EventSeriesId = g.Key,
            Sessions = g.Count(),
            Capacity = g.Sum(x => x.Capacity),
            Booked = bookings.Count(b => g.Select(x => x.Id).Contains(b.EventInstanceId))
        })
        .ToList();

    return Results.Ok(grouped);
});

adminApi.MapGet("/reports/revenue", async (ClaimsPrincipal user, DateOnly? from, DateOnly? to, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var fromDate = from ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30));
    var toDate = to ?? DateOnly.FromDateTime(DateTime.UtcNow);

    var fromUtc = fromDate.ToDateTime(TimeOnly.MinValue);
    var toUtc = toDate.ToDateTime(TimeOnly.MinValue);

    var total = await db.Payments.AsNoTracking()
        .Where(p => p.StudioId == studioId && p.Status == PaymentStatus.Paid && p.CreatedAtUtc >= fromUtc && p.CreatedAtUtc < toUtc)
        .SumAsync(p => (int?)p.AmountCents) ?? 0;

    return Results.Ok(new { totalCents = total });
});
adminApi.MapGet("/payroll", async (ClaimsPrincipal user, DateOnly? from, DateOnly? to, Guid? instructorId, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var instructors = await db.Instructors.AsNoTracking()
        .Where(i => i.StudioId == studioId)
        .OrderBy(i => i.DisplayName)
        .ToListAsync();

    var query = db.InstructorPayrollEntries.AsNoTracking()
        .Where(entry => entry.StudioId == studioId);
    if (from.HasValue)
    {
        var fromUtc = DateTime.SpecifyKind(from.Value.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
        query = query.Where(entry => entry.ReportedAtUtc >= fromUtc);
    }
    if (to.HasValue)
    {
        var toUtc = DateTime.SpecifyKind(to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
        query = query.Where(entry => entry.ReportedAtUtc < toUtc);
    }
    if (instructorId.HasValue)
    {
        query = query.Where(entry => entry.InstructorId == instructorId.Value);
    }

    var logs = await query
        .OrderByDescending(entry => entry.ReportedAtUtc)
        .Take(500)
        .ToListAsync();

    var instructorMap = instructors.ToDictionary(i => i.Id, i => i);
    var instanceIds = logs.Select(l => l.EventInstanceId).Distinct().ToList();
    var instances = await db.EventInstances.AsNoTracking()
        .Where(i => instanceIds.Contains(i.Id))
        .ToDictionaryAsync(i => i.Id, i => i);
    var seriesIds = instances.Values.Select(i => i.EventSeriesId).Distinct().ToList();
    var seriesMap = await db.EventSeries.AsNoTracking()
        .Where(s => seriesIds.Contains(s.Id))
        .ToDictionaryAsync(s => s.Id, s => s);
    var reporterIds = logs.Where(l => l.ReportedByUserId.HasValue).Select(l => l.ReportedByUserId!.Value).Distinct().ToList();
    var reporters = await db.Users.AsNoTracking()
        .Where(u => reporterIds.Contains(u.Id))
        .ToDictionaryAsync(u => u.Id, u => u);

    var response = logs.Select(entry =>
    {
        instructorMap.TryGetValue(entry.InstructorId, out var instructor);
        instances.TryGetValue(entry.EventInstanceId, out var instance);
        EventSeries? series = null;
        if (instance != null)
        {
            seriesMap.TryGetValue(instance.EventSeriesId, out series);
        }
        reporters.TryGetValue(entry.ReportedByUserId ?? Guid.Empty, out var reporter);
        return new
        {
            entry.Id,
            entry.InstructorId,
            entry.EventInstanceId,
            entry.ReportedByUserId,
            entry.ReportedAtUtc,
            entry.DurationMinutes,
            entry.BookedCount,
            entry.PresentCount,
            entry.Units,
            entry.RateCents,
            entry.RateUnit,
            entry.AmountCents,
            entry.Currency,
            instructorName = instructor?.DisplayName ?? "",
            sessionTitle = series?.Title ?? "",
            sessionStartUtc = instance?.StartUtc,
            reportedByName = reporter?.DisplayName ?? ""
        };
    });

    return Results.Ok(new
    {
        instructors = instructors.Select(i => new
        {
            i.Id,
            i.DisplayName,
            i.UserId,
            i.RateCents,
            i.RateUnit,
            i.RateCurrency
        }),
        logs = response
    });
});

adminApi.MapPost("/payroll", async (ClaimsPrincipal user, PayrollReportRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var instance = await db.EventInstances.FirstOrDefaultAsync(i => i.Id == request.EventInstanceId && i.StudioId == studioId);
    if (instance == null)
    {
        return Results.NotFound(new { error = "Session not found" });
    }
    if (!instance.InstructorId.HasValue)
    {
        return Results.BadRequest(new { error = "Session has no instructor" });
    }

    var instructor = await db.Instructors.FirstOrDefaultAsync(i => i.Id == instance.InstructorId.Value && i.StudioId == studioId);
    if (instructor == null)
    {
        return Results.NotFound(new { error = "Instructor not found" });
    }

    var entry = await UpsertPayrollEntryAsync(db, studioId, GetUserId(user), instance, instructor);
    await LogAuditAsync(db, user, "Report", "Payroll", entry.Id.ToString(), $"Reported attendance for {instructor.DisplayName}");
    return Results.Ok(entry);
});

adminApi.MapGet("/audit", async (ClaimsPrincipal user, DateOnly? from, DateOnly? to, string? search, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var query = db.AuditLogs.AsNoTracking().Where(log => log.StudioId == studioId);
    if (from.HasValue)
    {
        var fromUtc = DateTime.SpecifyKind(from.Value.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
        query = query.Where(log => log.CreatedAtUtc >= fromUtc);
    }
    if (to.HasValue)
    {
        var toUtc = DateTime.SpecifyKind(to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
        query = query.Where(log => log.CreatedAtUtc < toUtc);
    }

    if (!string.IsNullOrWhiteSpace(search))
    {
        var term = search.Trim();
        query = query.Where(log =>
            log.Summary.Contains(term, StringComparison.OrdinalIgnoreCase) ||
            log.Action.Contains(term, StringComparison.OrdinalIgnoreCase) ||
            log.EntityType.Contains(term, StringComparison.OrdinalIgnoreCase));
    }

    var logs = await query
        .OrderByDescending(log => log.CreatedAtUtc)
        .Take(500)
        .ToListAsync();

    var actorIds = logs.Where(l => l.ActorUserId.HasValue).Select(l => l.ActorUserId!.Value).Distinct().ToList();
    var actors = await db.Users.AsNoTracking()
        .Where(u => actorIds.Contains(u.Id))
        .ToDictionaryAsync(u => u.Id, u => u);

    var results = logs.Select(log =>
    {
        AppUser? actor = null;
        if (log.ActorUserId.HasValue)
        {
            actors.TryGetValue(log.ActorUserId.Value, out actor);
        }
        return new
        {
            log.Id,
            log.CreatedAtUtc,
            log.ActorUserId,
            actorName = actor?.DisplayName ?? "",
            actorEmail = actor?.Email ?? "",
            log.ActorRole,
            log.Action,
            log.EntityType,
            log.EntityId,
            log.Summary
        };
    });

    return Results.Ok(results);
});

adminApi.MapGet("/audit/export", async (ClaimsPrincipal user, DateOnly? from, DateOnly? to, string? search, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var query = db.AuditLogs.AsNoTracking().Where(log => log.StudioId == studioId);
    if (from.HasValue)
    {
        var fromUtc = DateTime.SpecifyKind(from.Value.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
        query = query.Where(log => log.CreatedAtUtc >= fromUtc);
    }
    if (to.HasValue)
    {
        var toUtc = DateTime.SpecifyKind(to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
        query = query.Where(log => log.CreatedAtUtc < toUtc);
    }
    if (!string.IsNullOrWhiteSpace(search))
    {
        var term = search.Trim();
        query = query.Where(log =>
            log.Summary.Contains(term, StringComparison.OrdinalIgnoreCase) ||
            log.Action.Contains(term, StringComparison.OrdinalIgnoreCase) ||
            log.EntityType.Contains(term, StringComparison.OrdinalIgnoreCase));
    }

    var logs = await query
        .OrderByDescending(log => log.CreatedAtUtc)
        .Take(5000)
        .ToListAsync();

    var actorIds = logs.Where(l => l.ActorUserId.HasValue).Select(l => l.ActorUserId!.Value).Distinct().ToList();
    var actors = await db.Users.AsNoTracking()
        .Where(u => actorIds.Contains(u.Id))
        .ToDictionaryAsync(u => u.Id, u => u);

    var sb = new StringBuilder();
    sb.AppendLine("Timestamp,Actor,ActorEmail,ActorRole,Action,EntityType,EntityId,Summary");
    foreach (var log in logs)
    {
        actors.TryGetValue(log.ActorUserId ?? Guid.Empty, out var actor);
        sb.AppendLine(string.Join(",",
            EscapeCsv(log.CreatedAtUtc.ToString("O")),
            EscapeCsv(actor?.DisplayName ?? ""),
            EscapeCsv(actor?.Email ?? ""),
            EscapeCsv(log.ActorRole),
            EscapeCsv(log.Action),
            EscapeCsv(log.EntityType),
            EscapeCsv(log.EntityId),
            EscapeCsv(log.Summary)));
    }

    return Results.File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", "audit-log.csv");
});

adminApi.MapDelete("/audit", async (ClaimsPrincipal user, DateOnly? before, AppDbContext db) =>
{
    if (!before.HasValue)
    {
        return Results.BadRequest(new { error = "before date required" });
    }

    var studioId = GetStudioId(user);
    var beforeUtc = DateTime.SpecifyKind(before.Value.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
    var logs = await db.AuditLogs.Where(log => log.StudioId == studioId && log.CreatedAtUtc < beforeUtc).ToListAsync();
    var count = logs.Count;
    if (count > 0)
    {
        db.AuditLogs.RemoveRange(logs);
        await db.SaveChangesAsync();
        await LogAuditAsync(db, user, "Delete", "AuditLog", "-", $"Cleared {count} audit log entries", new { before = before.Value });
    }

    return Results.Ok(new { removed = count });
});
adminApi.MapGet("/export/bookings.csv", async (ClaimsPrincipal user, DateOnly? from, DateOnly? to, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var studio = await db.Studios.AsNoTracking().FirstOrDefaultAsync(s => s.Id == studioId);
    if (studio == null)
    {
        return Results.NotFound();
    }

    var fromDate = from ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30));
    var toDate = to ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1));

    var tz = ResolveTimeZone(studio.Timezone);
    var fromUtc = TimeZoneInfo.ConvertTimeToUtc(fromDate.ToDateTime(TimeOnly.MinValue), tz);
    var toUtc = TimeZoneInfo.ConvertTimeToUtc(toDate.ToDateTime(TimeOnly.MinValue), tz);

    var bookings = await db.Bookings.AsNoTracking()
        .Where(b => b.StudioId == studioId && b.CreatedAtUtc >= fromUtc && b.CreatedAtUtc < toUtc)
        .ToListAsync();

    var customers = await db.Customers.AsNoTracking().Where(c => c.StudioId == studioId).ToDictionaryAsync(c => c.Id, c => c);
    var users = await db.Users.AsNoTracking().Where(u => u.StudioId == studioId).ToDictionaryAsync(u => u.Id, u => u);
    var instances = await db.EventInstances.AsNoTracking().Where(i => i.StudioId == studioId).ToDictionaryAsync(i => i.Id, i => i);

    var lines = new List<string> { "booking_id,customer_name,customer_email,event_start_utc,status,created_at_utc" };
    foreach (var booking in bookings)
    {
        customers.TryGetValue(booking.CustomerId, out var customer);
        var email = "";
        if (customer != null && users.TryGetValue(customer.UserId, out var userRecord))
        {
            email = userRecord.Email;
        }

        var startUtc = instances.TryGetValue(booking.EventInstanceId, out var instance) ? instance.StartUtc.ToString("o") : "";
        lines.Add($"{booking.Id},{EscapeCsv(customer?.FullName ?? "")},{EscapeCsv(email)},{startUtc},{booking.Status},{booking.CreatedAtUtc:o}");
    }

    var csv = string.Join("\n", lines);
    return Results.Text(csv, "text/csv");
});
var appApi = app.MapGroup("/api/app").RequireAuthorization("customer");

appApi.MapGet("/me/profile", async (ClaimsPrincipal user, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var customerId = GetCustomerId(user);
    if (customerId == null)
    {
        return Results.Unauthorized();
    }

    var customer = await db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == customerId && c.StudioId == studioId);
    if (customer == null)
    {
        return Results.NotFound();
    }

    var userRow = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == customer.UserId);

    return Results.Ok(new
    {
        customer.Id,
        customer.FirstName,
        customer.LastName,
        customer.FullName,
        customer.Phone,
        customer.DateOfBirth,
        customer.IdNumber,
        customer.Gender,
        customer.City,
        customer.Address,
        customer.Occupation,
        customer.SignedHealthView,
        email = userRow?.Email ?? "",
        preferredLocale = userRow?.PreferredLocale ?? ""
    });
});

appApi.MapPut("/me/profile", async (ClaimsPrincipal user, ProfileUpdateRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var customerId = GetCustomerId(user);
    if (customerId == null)
    {
        return Results.Unauthorized();
    }

    var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == customerId && c.StudioId == studioId);
    if (customer == null)
    {
        return Results.NotFound();
    }

    customer.FullName = request.FullName;
    customer.Phone = request.Phone;
    customer.IdNumber = request.IdNumber?.Trim() ?? customer.IdNumber;
    var (firstName, lastName) = ResolveNameParts(customer.FullName, request.FirstName, request.LastName);
    customer.FirstName = firstName;
    customer.LastName = lastName;
    customer.DateOfBirth = request.DateOfBirth ?? customer.DateOfBirth;
    if (request.Gender != null)
    {
        customer.Gender = request.Gender.Trim();
    }
    if (request.City != null)
    {
        customer.City = request.City.Trim();
    }
    if (request.Address != null)
    {
        customer.Address = request.Address.Trim();
    }
    if (request.Occupation != null)
    {
        customer.Occupation = request.Occupation.Trim();
    }
    var userRow = await db.Users.FirstOrDefaultAsync(u => u.Id == customer.UserId);
    if (userRow != null)
    {
        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var email = request.Email.Trim().ToLowerInvariant();
            var conflict = await db.Users.AnyAsync(u => u.StudioId == studioId && u.Email == email && u.Id != userRow.Id);
            if (conflict)
            {
                return Results.Conflict(new { error = "Email already in use" });
            }
            userRow.Email = email;
        }
        userRow.DisplayName = customer.FullName;
        userRow.Phone = customer.Phone;
        userRow.Address = customer.Address;
        userRow.Gender = customer.Gender;
        userRow.IdNumber = customer.IdNumber;
        userRow.PreferredLocale = string.IsNullOrWhiteSpace(request.PreferredLocale)
            ? null
            : request.PreferredLocale.Trim();
    }
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Update", "Customer", customer.Id.ToString(), $"Updated profile for {customer.FullName}");
    return Results.Ok(customer);
});

appApi.MapPost("/me/health-declaration", async (ClaimsPrincipal user, HealthDeclarationRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var customerId = GetCustomerId(user);
    if (customerId == null)
    {
        return Results.Unauthorized();
    }

    var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == customerId && c.StudioId == studioId);
    if (customer == null)
    {
        return Results.NotFound();
    }

    if (string.IsNullOrWhiteSpace(request.FirstName) ||
        string.IsNullOrWhiteSpace(request.LastName) ||
        string.IsNullOrWhiteSpace(request.Email) ||
        string.IsNullOrWhiteSpace(request.Phone) ||
        string.IsNullOrWhiteSpace(request.IdNumber) ||
        string.IsNullOrWhiteSpace(request.Gender) ||
        string.IsNullOrWhiteSpace(request.City) ||
        string.IsNullOrWhiteSpace(request.Address) ||
        string.IsNullOrWhiteSpace(request.Occupation) ||
        string.IsNullOrWhiteSpace(request.HeardAbout) ||
        string.IsNullOrWhiteSpace(request.SignatureName) ||
        string.IsNullOrWhiteSpace(request.SignatureDataUrl) ||
        request.DateOfBirth == null)
    {
        return Results.BadRequest(new { error = "Missing required fields" });
    }

    if (!request.AgreeToTerms)
    {
        return Results.BadRequest(new { error = "Terms must be accepted" });
    }

    if (!request.Acknowledged)
    {
        return Results.BadRequest(new { error = "Health acknowledgement required" });
    }

    var userRow = await db.Users.FirstOrDefaultAsync(u => u.Id == customer.UserId && u.StudioId == studioId);
    if (userRow == null)
    {
        return Results.NotFound();
    }

    var email = request.Email.Trim().ToLowerInvariant();
    var conflict = await db.Users.AnyAsync(u => u.StudioId == studioId && u.Email == email && u.Id != userRow.Id);
    if (conflict)
    {
        return Results.Conflict(new { error = "Email already in use" });
    }

    var firstName = request.FirstName.Trim();
    var lastName = request.LastName.Trim();
    var fullName = $"{firstName} {lastName}".Trim();

    customer.FirstName = firstName;
    customer.LastName = lastName;
    customer.FullName = fullName;
    customer.Phone = request.Phone.Trim();
    customer.DateOfBirth = request.DateOfBirth;
    customer.IdNumber = request.IdNumber.Trim();
    customer.Gender = request.Gender.Trim();
    customer.City = request.City.Trim();
    customer.Address = request.Address.Trim();
    customer.Occupation = request.Occupation.Trim();
    customer.SignedHealthView = true;

    userRow.Email = email;
    userRow.DisplayName = fullName;
    userRow.Phone = customer.Phone;
    userRow.Address = customer.Address;
    userRow.Gender = customer.Gender;
    userRow.IdNumber = customer.IdNumber;

    if (!string.IsNullOrWhiteSpace(request.Password))
    {
        var hasher = new PasswordHasher<AppUser>();
        userRow.PasswordHash = hasher.HashPassword(userRow, request.Password);
    }

    var payload = JsonSerializer.Serialize(new
    {
        request.FirstName,
        request.LastName,
        request.Email,
        request.Phone,
        request.DateOfBirth,
        request.IdNumber,
        request.Gender,
        request.City,
        request.Address,
        request.Occupation,
        request.HeardAbout,
        request.MarketingConsent,
        request.HighBloodPressure,
        request.Diabetes,
        request.Headaches,
        request.Asthma,
        request.BalanceIssues,
        request.NeckBackShoulderIssues,
        request.JointProblems,
        request.SpineProblems,
        request.DigestiveProblems,
        request.EarProblems,
        request.EyeProblems,
        request.ChronicDisease,
        request.Surgeries,
        request.MenstrualProblems,
        request.Smoker,
        request.Pregnant,
        request.OtherNotes,
        request.Acknowledged,
        request.AgreeToTerms,
        request.SignatureName,
        request.SignatureType,
        request.SignatureDataUrl,
        passwordSet = !string.IsNullOrWhiteSpace(request.Password)
    });

    var declaration = new HealthDeclaration
    {
        Id = Guid.NewGuid(),
        StudioId = studioId,
        CustomerId = customerId.Value,
        PayloadJson = payload,
        SignatureName = request.SignatureName.Trim(),
        SignatureType = string.IsNullOrWhiteSpace(request.SignatureType) ? "typed" : request.SignatureType.Trim()
    };

    db.HealthDeclarations.Add(declaration);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Create", "HealthDeclaration", declaration.Id.ToString(), $"Submitted health declaration for customer {customerId}");
    return Results.Ok(declaration);
});

appApi.MapGet("/me/bookings", async (ClaimsPrincipal user, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var customerId = GetCustomerId(user);
    if (customerId == null)
    {
        return Results.Unauthorized();
    }

    var bookings = await db.Bookings.AsNoTracking()
        .Where(b => b.CustomerId == customerId && b.StudioId == studioId)
        .OrderByDescending(b => b.CreatedAtUtc)
        .ToListAsync();

    var instances = await db.EventInstances.AsNoTracking()
        .Where(i => i.StudioId == studioId)
        .ToDictionaryAsync(i => i.Id, i => i);
    var seriesMap = await db.EventSeries.AsNoTracking()
        .Where(s => s.StudioId == studioId)
        .ToDictionaryAsync(s => s.Id, s => s);

    var response = bookings.Select(b => new
    {
        b.Id,
        b.Status,
        b.CreatedAtUtc,
        instance = instances.TryGetValue(b.EventInstanceId, out var instance)
            ? new
            {
                instance.Id,
                instance.StartUtc,
                instance.EndUtc,
                seriesTitle = seriesMap.TryGetValue(instance.EventSeriesId, out var series) ? series.Title : ""
            }
            : null
    });

    return Results.Ok(response);
});

appApi.MapGet("/me/memberships", async (ClaimsPrincipal user, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var customerId = GetCustomerId(user);
    if (customerId == null)
    {
        return Results.Unauthorized();
    }

    var memberships = await db.Memberships.AsNoTracking().Where(m => m.CustomerId == customerId && m.StudioId == studioId).ToListAsync();
    var plans = await db.Plans.AsNoTracking().Where(p => p.StudioId == studioId).ToDictionaryAsync(p => p.Id, p => p);
    var response = memberships.Select(m => new
    {
        m.Id,
        m.Status,
        m.RemainingUses,
        m.StartUtc,
        m.EndUtc,
        plan = plans.TryGetValue(m.PlanId, out var plan) ? plan : null
    });

    return Results.Ok(response);
});

appApi.MapGet("/me/payments", async (ClaimsPrincipal user, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var customerId = GetCustomerId(user);
    if (customerId == null)
    {
        return Results.Unauthorized();
    }

    var payments = await db.Payments.AsNoTracking()
        .Where(p => p.CustomerId == customerId && p.StudioId == studioId)
        .OrderByDescending(p => p.CreatedAtUtc)
        .ToListAsync();

    var response = payments.Select(p => new
    {
        p.Id,
        p.Status,
        p.AmountCents,
        p.Currency,
        p.Provider,
        p.CreatedAtUtc
    });

    return Results.Ok(response);
});

appApi.MapPost("/bookings", async (ClaimsPrincipal user, BookingRequest request, AppDbContext db, BookingService bookingService) =>
{
    var studioId = GetStudioId(user);
    var customerId = GetCustomerId(user);
    if (customerId == null)
    {
        return Results.Unauthorized();
    }

    var studio = await db.Studios.FirstOrDefaultAsync(s => s.Id == studioId);
    var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == customerId && c.StudioId == studioId);
    var instance = await db.EventInstances.FirstOrDefaultAsync(i => i.Id == request.EventInstanceId && i.StudioId == studioId);
    if (studio == null || customer == null || instance == null)
    {
        return Results.NotFound();
    }

    var result = await bookingService.CreateBookingAsync(
        studio,
        customer,
        instance,
        request.MembershipId,
        CancellationToken.None,
        isRemote: request.IsRemote);
    if (!result.ok)
    {
        return Results.BadRequest(new { error = result.error });
    }

    var booking = result.booking!;
    await LogAuditAsync(db, user, "Create", "Booking", booking.Id.ToString(), "Created booking", new { request.EventInstanceId, request.IsRemote });
    return Results.Ok(new { booking, payment = result.payment });
});

appApi.MapPost("/bookings/{id:guid}/cancel", async (ClaimsPrincipal user, Guid id, AppDbContext db, BookingService bookingService) =>
{
    var studioId = GetStudioId(user);
    var customerId = GetCustomerId(user);
    if (customerId == null)
    {
        return Results.Unauthorized();
    }

    var studio = await db.Studios.FirstOrDefaultAsync(s => s.Id == studioId);
    var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == customerId && c.StudioId == studioId);
    var booking = await db.Bookings.FirstOrDefaultAsync(b => b.Id == id && b.CustomerId == customerId && b.StudioId == studioId);
    if (studio == null || customer == null || booking == null)
    {
        return Results.NotFound();
    }

    var result = await bookingService.CancelBookingAsync(studio, customer, booking, CancellationToken.None);
    if (!result.ok)
    {
        return Results.BadRequest(new { error = result.error });
    }

    await LogAuditAsync(db, user, "Cancel", "Booking", booking.Id.ToString(), "Cancelled booking");
    return Results.Ok(new { status = "cancelled" });
});

appApi.MapPost("/checkout", async (ClaimsPrincipal user, CheckoutRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var customerId = GetCustomerId(user);
    if (customerId == null)
    {
        return Results.Unauthorized();
    }

    var plan = await db.Plans.FirstOrDefaultAsync(p => p.Id == request.PlanId && p.StudioId == studioId && p.Active);
    if (plan == null)
    {
        return Results.NotFound(new { error = "Plan not found" });
    }

    var price = plan.PriceCents;
    Coupon? coupon = null;
    if (!string.IsNullOrWhiteSpace(request.CouponCode))
    {
        coupon = await db.Coupons.FirstOrDefaultAsync(c => c.StudioId == studioId && c.Code == request.CouponCode.ToUpperInvariant() && c.Active);
        if (coupon != null)
        {
            var now = DateTime.UtcNow;
            if (coupon.ValidFromUtc.HasValue && now < coupon.ValidFromUtc.Value || coupon.ValidToUtc.HasValue && now > coupon.ValidToUtc.Value)
            {
                coupon = null;
            }
            else if (coupon.MaxUses > 0 && coupon.TimesUsed >= coupon.MaxUses)
            {
                coupon = null;
            }
        }

        if (coupon != null)
        {
            price = coupon.DiscountType == DiscountType.Percent
                ? Math.Max(0, price - (price * coupon.DiscountValue / 100))
                : Math.Max(0, price - coupon.DiscountValue);
        }
    }

    var payment = new Payment
    {
        Id = Guid.NewGuid(),
        StudioId = studioId,
        CustomerId = customerId.Value,
        AmountCents = price,
        Currency = plan.Currency,
        Status = PaymentStatus.Paid,
        Provider = "manual",
        ProviderRef = $"manual-{Guid.NewGuid():N}"
    };

    var membership = new Membership
    {
        Id = Guid.NewGuid(),
        StudioId = studioId,
        CustomerId = customerId.Value,
        PlanId = plan.Id,
        Status = MembershipStatus.Active,
        StartUtc = DateTime.UtcNow,
        RemainingUses = plan.Type == PlanType.PunchCard ? plan.PunchCardUses : 0
    };

    if (coupon != null)
    {
        coupon.TimesUsed += 1;
        db.Coupons.Update(coupon);
    }

    db.Payments.Add(payment);
    db.Memberships.Add(membership);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Create", "Payment", payment.Id.ToString(), $"Completed checkout for plan {plan.Name}", new { membershipId = membership.Id, planId = plan.Id, payment.AmountCents });

    return Results.Ok(new { membership, payment });
});
var instructorApi = app.MapGroup("/api/instructor").RequireAuthorization("instructor");

instructorApi.MapGet("/studio", async (ClaimsPrincipal user, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var studio = await db.Studios.AsNoTracking().FirstOrDefaultAsync(s => s.Id == studioId);
    if (studio == null)
    {
        return Results.NotFound();
    }

    return Results.Ok(new
    {
        studio.Id,
        studio.Name,
        studio.Slug,
        studio.Timezone,
        studio.WeekStartsOn
    });
});

instructorApi.MapGet("/rooms", async (ClaimsPrincipal user, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var rooms = await db.Rooms.AsNoTracking()
        .Where(r => r.StudioId == studioId)
        .OrderBy(r => r.Name)
        .ToListAsync();
    return Results.Ok(rooms);
});

instructorApi.MapGet("/calendar", async (ClaimsPrincipal user, DateOnly? from, DateOnly? to, AppDbContext db, HolidayService holidayService) =>
{
    var studioId = GetStudioId(user);
    var userId = GetUserId(user);
    var studio = await db.Studios.AsNoTracking().FirstOrDefaultAsync(s => s.Id == studioId);
    if (studio == null)
    {
        return Results.NotFound();
    }

    var instructor = await db.Instructors.AsNoTracking().FirstOrDefaultAsync(i => i.StudioId == studioId && i.UserId == userId);
    if (instructor == null)
    {
        return Results.NotFound(new { error = "Instructor profile missing" });
    }

    var fromDate = from ?? DateOnly.FromDateTime(DateTime.UtcNow);
    var toDate = to ?? fromDate.AddDays(14);
    var tz = ResolveTimeZone(studio.Timezone);
    var fromUtc = TimeZoneInfo.ConvertTimeToUtc(fromDate.ToDateTime(TimeOnly.MinValue), tz);
    var toUtc = TimeZoneInfo.ConvertTimeToUtc(toDate.ToDateTime(TimeOnly.MinValue), tz);

    var instances = await db.EventInstances.AsNoTracking()
        .Where(i => i.StudioId == studioId && i.StartUtc >= fromUtc && i.StartUtc < toUtc)
        .OrderBy(i => i.StartUtc)
        .ToListAsync();

    var seriesMap = await db.EventSeries.AsNoTracking()
        .Where(s => s.StudioId == studioId)
        .ToDictionaryAsync(s => s.Id, s => s);
    var instructorMap = await db.Instructors.AsNoTracking()
        .Where(i => i.StudioId == studioId)
        .ToDictionaryAsync(i => i.Id, i => i);
    var roomMap = await db.Rooms.AsNoTracking()
        .Where(r => r.StudioId == studioId)
        .ToDictionaryAsync(r => r.Id, r => r);

    var counts = await db.Bookings.AsNoTracking()
        .Where(b => b.StudioId == studioId && b.Status == BookingStatus.Confirmed && instances.Select(i => i.Id).Contains(b.EventInstanceId))
        .GroupBy(b => new { b.EventInstanceId, b.IsRemote })
        .Select(g => new { g.Key.EventInstanceId, g.Key.IsRemote, Count = g.Count() })
        .ToListAsync();

    var inPersonMap = counts.Where(x => !x.IsRemote).ToDictionary(x => x.EventInstanceId, x => x.Count);
    var remoteMap = counts.Where(x => x.IsRemote).ToDictionary(x => x.EventInstanceId, x => x.Count);

    var response = instances.Select(instance =>
    {
        seriesMap.TryGetValue(instance.EventSeriesId, out var series);
        instructorMap.TryGetValue(instance.InstructorId ?? Guid.Empty, out var instanceInstructor);
        roomMap.TryGetValue(instance.RoomId ?? Guid.Empty, out var room);
        var booked = inPersonMap.TryGetValue(instance.Id, out var count) ? count : 0;
        var remoteBooked = remoteMap.TryGetValue(instance.Id, out var remoteCount) ? remoteCount : 0;

        return (object)new
        {
            instance.Id,
            instance.EventSeriesId,
            instance.InstructorId,
            instance.RoomId,
            instance.StartUtc,
            instance.EndUtc,
            instance.Capacity,
            remoteCapacity = instance.RemoteCapacity,
            instance.Status,
            instance.PriceCents,
            instance.Currency,
            notes = instance.Notes,
            booked,
            remoteBooked,
            remoteInviteUrl = instance.RemoteInviteUrl,
            seriesTitle = series?.Title ?? "",
            seriesIcon = series?.Icon ?? "",
            seriesColor = series?.Color ?? "",
            seriesDescription = series?.Description ?? "",
            instructorName = instanceInstructor?.DisplayName ?? "",
            roomName = room?.Name ?? "",
            isMine = instance.InstructorId == instructor.Id,
            isHoliday = false,
            isBirthday = false
        };
    }).ToList();

    var holidayCalendars = ParseStringListJson(studio.HolidayCalendarsJson);
    if (holidayCalendars.Count == 0)
    {
        holidayCalendars = new List<string> { "hebrew" };
    }
    if (holidayCalendars.Count > 0)
    {
        var locale = studio.DefaultLocale ?? "en";
        var holidays = holidayService.GetHolidays(fromDate, toDate, holidayCalendars, locale);
        var holidayColor = "#facc15";
        response.AddRange(holidays.Select(holiday =>
        {
            var start = holiday.Date.ToDateTime(new TimeOnly(12, 0));
            return (object)new
            {
                Id = Guid.NewGuid(),
                EventSeriesId = Guid.Empty,
                InstructorId = (Guid?)null,
                RoomId = (Guid?)null,
                StartUtc = start,
                EndUtc = start,
                Capacity = 0,
                remoteCapacity = 0,
                Status = EventStatus.Scheduled,
                PriceCents = 0,
                Currency = "ILS",
                notes = "",
                booked = 0,
                remoteBooked = 0,
                remoteInviteUrl = "",
                seriesTitle = holiday.Title,
                seriesIcon = "",
                seriesColor = holidayColor,
                seriesDescription = "",
                instructorName = "",
                roomName = "",
                isMine = false,
                isHoliday = true,
                isBirthday = false
            };
        }));
    }

    var birthdayUsers = await db.Users.AsNoTracking()
        .Where(u => u.StudioId == studioId && u.DateOfBirth != null && u.Role != UserRole.Customer)
        .ToListAsync();
    if (birthdayUsers.Count > 0)
    {
        response.AddRange(BuildBirthdayEvents(birthdayUsers, fromDate, toDate, tz, "#fde68a"));
    }

    return Results.Ok(response);
});

instructorApi.MapGet("/my-schedule", async (ClaimsPrincipal user, DateOnly? from, DateOnly? to, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var userId = GetUserId(user);
    var instructor = await db.Instructors.AsNoTracking().FirstOrDefaultAsync(i => i.StudioId == studioId && i.UserId == userId);
    if (instructor == null)
    {
        return Results.NotFound(new { error = "Instructor profile missing" });
    }

    var fromDate = from ?? DateOnly.FromDateTime(DateTime.UtcNow);
    var toDate = to ?? fromDate.AddDays(14);

    var instances = await db.EventInstances.AsNoTracking()
        .Where(i => i.StudioId == studioId && i.InstructorId == instructor.Id)
        .Where(i => i.StartUtc >= fromDate.ToDateTime(TimeOnly.MinValue) && i.StartUtc < toDate.ToDateTime(TimeOnly.MinValue))
        .OrderBy(i => i.StartUtc)
        .ToListAsync();

    return Results.Ok(instances);
});

instructorApi.MapGet("/instances/{id:guid}/roster", async (ClaimsPrincipal user, Guid id, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var userId = GetUserId(user);
    var instructor = await db.Instructors.AsNoTracking().FirstOrDefaultAsync(i => i.StudioId == studioId && i.UserId == userId);
    var instance = await db.EventInstances.AsNoTracking().FirstOrDefaultAsync(i => i.Id == id && i.StudioId == studioId);
    if (instance == null)
    {
        return Results.NotFound();
    }

    if (instructor != null && instance.InstructorId != instructor.Id && !user.IsInRole(UserRole.Admin.ToString()))
    {
        return Results.Forbid();
    }

    var bookings = await db.Bookings.AsNoTracking()
        .Where(b => b.EventInstanceId == id && b.Status == BookingStatus.Confirmed)
        .OrderBy(b => b.CreatedAtUtc)
        .ToListAsync();

    var customerIds = bookings.Select(b => b.CustomerId).Distinct().ToList();
    var customers = await db.Customers.AsNoTracking()
        .Where(c => c.StudioId == studioId && customerIds.Contains(c.Id))
        .ToDictionaryAsync(c => c.Id, c => c);

    var userIds = customers.Values.Select(c => c.UserId).Distinct().ToList();
    var users = await db.Users.AsNoTracking()
        .Where(u => u.StudioId == studioId && userIds.Contains(u.Id))
        .ToDictionaryAsync(u => u.Id, u => u);

    var attendance = await db.Attendance.AsNoTracking()
        .Where(a => a.StudioId == studioId && a.EventInstanceId == id)
        .ToListAsync();
    var attendanceMap = attendance.ToDictionary(a => a.CustomerId, a => a);

    var roster = bookings.Select(b =>
    {
        customers.TryGetValue(b.CustomerId, out var customer);
        AppUser? userRow = null;
        if (customer != null)
        {
            users.TryGetValue(customer.UserId, out userRow);
        }
        attendanceMap.TryGetValue(b.CustomerId, out var attendanceRow);

        return new
        {
            bookingId = b.Id,
            customerId = b.CustomerId,
            bookingStatus = b.Status,
            bookedAtUtc = b.CreatedAtUtc,
            isRemote = b.IsRemote,
            customerName = customer?.FullName ?? "",
            phone = customer?.Phone ?? "",
            dateOfBirth = customer?.DateOfBirth,
            email = userRow?.Email ?? "",
            attendanceStatus = attendanceRow?.Status
        };
    });

    return Results.Ok(roster);
});

instructorApi.MapPost("/instances/{id:guid}/attendance", async (ClaimsPrincipal user, Guid id, AttendanceUpdateRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var userId = GetUserId(user);
    var instructor = await db.Instructors.AsNoTracking().FirstOrDefaultAsync(i => i.StudioId == studioId && i.UserId == userId);
    var instance = await db.EventInstances.AsNoTracking().FirstOrDefaultAsync(i => i.Id == id && i.StudioId == studioId);
    if (instance == null)
    {
        return Results.NotFound();
    }

    if (instructor != null && instance.InstructorId != instructor.Id && !user.IsInRole(UserRole.Admin.ToString()))
    {
        return Results.Forbid();
    }

    var attendance = await db.Attendance.FirstOrDefaultAsync(a => a.EventInstanceId == id && a.CustomerId == request.CustomerId);
    if (attendance == null)
    {
        attendance = new Attendance
        {
            Id = Guid.NewGuid(),
            StudioId = studioId,
            EventInstanceId = id,
            CustomerId = request.CustomerId,
            Status = request.Status,
            RecordedAtUtc = DateTime.UtcNow
        };
        db.Attendance.Add(attendance);
    }
    else
    {
        attendance.Status = request.Status;
        attendance.RecordedAtUtc = DateTime.UtcNow;
        db.Attendance.Update(attendance);
    }

    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Update", "Attendance", attendance.Id.ToString(), $"Recorded attendance for customer {request.CustomerId}", new { instanceId = id, request.Status });
    return Results.Ok(attendance);
});

instructorApi.MapDelete("/instances/{id:guid}/attendance/{customerId:guid}", async (ClaimsPrincipal user, Guid id, Guid customerId, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var userId = GetUserId(user);
    var instructor = await db.Instructors.AsNoTracking().FirstOrDefaultAsync(i => i.StudioId == studioId && i.UserId == userId);
    var instance = await db.EventInstances.AsNoTracking().FirstOrDefaultAsync(i => i.Id == id && i.StudioId == studioId);
    if (instance == null)
    {
        return Results.NotFound();
    }

    if (instructor == null || instance.InstructorId != instructor.Id)
    {
        return Results.Forbid();
    }

    var attendance = await db.Attendance.FirstOrDefaultAsync(a => a.EventInstanceId == id && a.CustomerId == customerId);
    if (attendance == null)
    {
        return Results.NotFound();
    }

    db.Attendance.Remove(attendance);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Delete", "Attendance", attendance.Id.ToString(), $"Removed attendance for customer {customerId}", new { instanceId = id });
    return Results.NoContent();
});

instructorApi.MapPost("/instances/{id:guid}/payroll", async (ClaimsPrincipal user, Guid id, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var userId = GetUserId(user);
    var instructor = await db.Instructors.AsNoTracking().FirstOrDefaultAsync(i => i.StudioId == studioId && i.UserId == userId);
    var instance = await db.EventInstances.FirstOrDefaultAsync(i => i.Id == id && i.StudioId == studioId);
    if (instance == null)
    {
        return Results.NotFound(new { error = "Session not found" });
    }
    if (!instance.InstructorId.HasValue)
    {
        return Results.BadRequest(new { error = "Session has no instructor" });
    }

    if (instructor != null && instance.InstructorId != instructor.Id && !user.IsInRole(UserRole.Admin.ToString()))
    {
        return Results.Forbid();
    }

    var sessionInstructor = await db.Instructors.FirstOrDefaultAsync(i => i.Id == instance.InstructorId.Value && i.StudioId == studioId);
    if (sessionInstructor == null)
    {
        return Results.NotFound(new { error = "Instructor not found" });
    }

    var entry = await UpsertPayrollEntryAsync(db, studioId, userId, instance, sessionInstructor);
    await LogAuditAsync(db, user, "Report", "Payroll", entry.Id.ToString(), $"Reported attendance for {sessionInstructor.DisplayName}");
    return Results.Ok(entry);
});

instructorApi.MapPut("/instances/{id:guid}", async (ClaimsPrincipal user, Guid id, InstructorInstanceUpdateRequest request, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var userId = GetUserId(user);
    var instructor = await db.Instructors.AsNoTracking().FirstOrDefaultAsync(i => i.StudioId == studioId && i.UserId == userId);
    var instance = await db.EventInstances.FirstOrDefaultAsync(i => i.Id == id && i.StudioId == studioId);
    var studio = await db.Studios.AsNoTracking().FirstOrDefaultAsync(s => s.Id == studioId);
    if (instance == null)
    {
        return Results.NotFound();
    }

    if (instructor == null || instance.InstructorId != instructor.Id)
    {
        return Results.Forbid();
    }

    if (studio != null)
    {
        var tz = ResolveTimeZone(studio.Timezone);
        var localStart = TimeZoneInfo.ConvertTimeFromUtc(instance.StartUtc, tz);
        var localDate = DateOnly.FromDateTime(localStart);
        var localStartTime = TimeOnly.FromDateTime(localStart).ToTimeSpan();
        var durationMinutes = (int)Math.Round((instance.EndUtc - instance.StartUtc).TotalMinutes);

        var nextDate = request.Date ?? localDate;
        var nextStartTime = request.StartTimeLocal ?? localStartTime;
        var nextDuration = request.DurationMinutes ?? durationMinutes;

        var startLocal = nextDate.ToDateTime(TimeOnly.FromTimeSpan(nextStartTime));
        var startUtc = TimeZoneInfo.ConvertTimeToUtc(startLocal, tz);
        var endUtc = startUtc.AddMinutes(nextDuration);

        instance.StartUtc = startUtc;
        instance.EndUtc = endUtc;
    }

    instance.RoomId = request.RoomId;
    if (request.Notes != null)
    {
        instance.Notes = request.Notes;
    }
    if (request.Status.HasValue)
    {
        instance.Status = request.Status.Value;
    }
    db.EventInstances.Update(instance);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, user, "Update", "EventInstance", instance.Id.ToString(), "Updated session details", new { instance.Id });
    return Results.Ok(instance);
});

var guestApi = app.MapGroup("/api/guest").RequireAuthorization("guest");

guestApi.MapGet("/studio", async (ClaimsPrincipal user, AppDbContext db) =>
{
    var studioId = GetStudioId(user);
    var studio = await db.Studios.AsNoTracking().FirstOrDefaultAsync(s => s.Id == studioId);
    if (studio == null)
    {
        return Results.NotFound();
    }

    return Results.Ok(new
    {
        studio.Id,
        studio.Name,
        studio.Slug,
        studio.Timezone,
        studio.WeekStartsOn
    });
});

guestApi.MapGet("/calendar", async (ClaimsPrincipal user, DateOnly? from, DateOnly? to, AppDbContext db, HolidayService holidayService) =>
{
    var studioId = GetStudioId(user);
    var studio = await db.Studios.AsNoTracking().FirstOrDefaultAsync(s => s.Id == studioId);
    if (studio == null)
    {
        return Results.NotFound();
    }

    var fromDate = from ?? DateOnly.FromDateTime(DateTime.UtcNow);
    var toDate = to ?? fromDate.AddDays(14);
    var tz = ResolveTimeZone(studio.Timezone);
    var fromUtc = TimeZoneInfo.ConvertTimeToUtc(fromDate.ToDateTime(TimeOnly.MinValue), tz);
    var toUtc = TimeZoneInfo.ConvertTimeToUtc(toDate.ToDateTime(TimeOnly.MinValue), tz);

    var instances = await db.EventInstances.AsNoTracking()
        .Where(i => i.StudioId == studioId && i.StartUtc >= fromUtc && i.StartUtc < toUtc)
        .OrderBy(i => i.StartUtc)
        .ToListAsync();

    var seriesMap = await db.EventSeries.AsNoTracking()
        .Where(s => s.StudioId == studioId)
        .ToDictionaryAsync(s => s.Id, s => s);
    var instructorMap = await db.Instructors.AsNoTracking()
        .Where(i => i.StudioId == studioId)
        .ToDictionaryAsync(i => i.Id, i => i);
    var roomMap = await db.Rooms.AsNoTracking()
        .Where(r => r.StudioId == studioId)
        .ToDictionaryAsync(r => r.Id, r => r);

    var counts = await db.Bookings.AsNoTracking()
        .Where(b => b.StudioId == studioId && b.Status == BookingStatus.Confirmed && instances.Select(i => i.Id).Contains(b.EventInstanceId))
        .GroupBy(b => new { b.EventInstanceId, b.IsRemote })
        .Select(g => new { g.Key.EventInstanceId, g.Key.IsRemote, Count = g.Count() })
        .ToListAsync();

    var inPersonMap = counts.Where(x => !x.IsRemote).ToDictionary(x => x.EventInstanceId, x => x.Count);
    var remoteMap = counts.Where(x => x.IsRemote).ToDictionary(x => x.EventInstanceId, x => x.Count);

    var response = instances.Select(instance =>
    {
        seriesMap.TryGetValue(instance.EventSeriesId, out var series);
        instructorMap.TryGetValue(instance.InstructorId ?? Guid.Empty, out var instanceInstructor);
        roomMap.TryGetValue(instance.RoomId ?? Guid.Empty, out var room);
        var booked = inPersonMap.TryGetValue(instance.Id, out var count) ? count : 0;
        var remoteBooked = remoteMap.TryGetValue(instance.Id, out var remoteCount) ? remoteCount : 0;

        return (object)new
        {
            instance.Id,
            instance.EventSeriesId,
            instance.InstructorId,
            instance.RoomId,
            instance.StartUtc,
            instance.EndUtc,
            instance.Capacity,
            remoteCapacity = instance.RemoteCapacity,
            instance.Status,
            instance.PriceCents,
            instance.Currency,
            notes = instance.Notes,
            booked,
            remoteBooked,
            remoteInviteUrl = instance.RemoteInviteUrl,
            seriesTitle = series?.Title ?? "",
            seriesIcon = series?.Icon ?? "",
            seriesColor = series?.Color ?? "",
            seriesDescription = series?.Description ?? "",
            instructorName = instanceInstructor?.DisplayName ?? "",
            roomName = room?.Name ?? "",
            isHoliday = false,
            isBirthday = false
        };
    }).ToList();

    var holidayCalendars = ParseStringListJson(studio.HolidayCalendarsJson);
    if (holidayCalendars.Count == 0)
    {
        holidayCalendars = new List<string> { "hebrew" };
    }
    if (holidayCalendars.Count > 0)
    {
        var locale = studio.DefaultLocale ?? "en";
        var holidays = holidayService.GetHolidays(fromDate, toDate, holidayCalendars, locale);
        var holidayColor = "#facc15";
        response.AddRange(holidays.Select(holiday =>
        {
            var start = holiday.Date.ToDateTime(new TimeOnly(12, 0));
            return (object)new
            {
                Id = Guid.NewGuid(),
                EventSeriesId = Guid.Empty,
                InstructorId = (Guid?)null,
                RoomId = (Guid?)null,
                StartUtc = start,
                EndUtc = start,
                Capacity = 0,
                remoteCapacity = 0,
                Status = EventStatus.Scheduled,
                PriceCents = 0,
                Currency = "ILS",
                notes = "",
                booked = 0,
                remoteBooked = 0,
                remoteInviteUrl = "",
                seriesTitle = holiday.Title,
                seriesIcon = "",
                seriesColor = holidayColor,
                seriesDescription = "",
                instructorName = "",
                roomName = "",
                isHoliday = true,
                isBirthday = false
            };
        }));
    }

    var birthdayUsers = await db.Users.AsNoTracking()
        .Where(u => u.StudioId == studioId && u.DateOfBirth != null && u.Role != UserRole.Customer)
        .ToListAsync();
    if (birthdayUsers.Count > 0)
    {
        response.AddRange(BuildBirthdayEvents(birthdayUsers, fromDate, toDate, tz, "#fde68a"));
    }

    return Results.Ok(response);
});

app.MapFallbackToFile("/marketing/{*path:nonfile}", "marketing/index.html");
app.MapFallbackToFile("/admin/{*path:nonfile}", "admin/index.html");
app.MapFallbackToFile("/instructor/{*path:nonfile}", "instructor/index.html");
app.MapFallbackToFile("/guest/{*path:nonfile}", "guest/index.html");
app.MapFallbackToFile("/app/{*path:nonfile}", "app/index.html");
app.MapFallbackToFile("/s/{studioSlug}", "public/index.html");
app.MapFallbackToFile("/s/{studioSlug}/{*path:nonfile}", "public/index.html");

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    var seed = scope.ServiceProvider.GetRequiredService<SeedService>();
    await seed.SeedAsync(CancellationToken.None);
}

app.Run();

static Guid GetStudioId(ClaimsPrincipal user)
{
    var value = user.FindFirst("studio_id")?.Value;
    return value == null ? Guid.Empty : Guid.Parse(value);
}

static Guid GetUserId(ClaimsPrincipal user)
{
    var value = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    return value == null ? Guid.Empty : Guid.Parse(value);
}

static Guid? GetCustomerId(ClaimsPrincipal user)
{
    var value = user.FindFirst("customer_id")?.Value;
    return value == null ? null : Guid.Parse(value);
}

static string GetActiveRole(ClaimsPrincipal user)
{
    var active = user.FindFirst("active_role")?.Value;
    if (!string.IsNullOrWhiteSpace(active))
    {
        return active;
    }
    return user.FindFirst(ClaimTypes.Role)?.Value ?? "";
}

static List<UserRole> NormalizeRoles(IEnumerable<UserRole> roles)
{
    var unique = new HashSet<UserRole>(roles);
    var priority = new[]
    {
        UserRole.Admin,
        UserRole.Staff,
        UserRole.Instructor,
        UserRole.Guest,
        UserRole.Customer
    };
    return priority.Where(unique.Contains).ToList();
}

static UserRole GetPrimaryRole(IReadOnlyList<UserRole> roles)
{
    return roles.Count == 0 ? UserRole.Customer : roles[0];
}

static List<UserRole> ParseRolesCsv(string? rolesCsv)
{
    if (string.IsNullOrWhiteSpace(rolesCsv))
    {
        return new List<UserRole>();
    }

    var tokens = rolesCsv.Split(new[] { ",", ";", "|" }, StringSplitOptions.RemoveEmptyEntries);
    var parsed = new List<UserRole>();
    foreach (var token in tokens)
    {
        if (Enum.TryParse<UserRole>(token.Trim(), true, out var role))
        {
            parsed.Add(role);
        }
    }
    return NormalizeRoles(parsed);
}

static List<UserRole> ParseRolesList(IEnumerable<string>? roles)
{
    if (roles == null)
    {
        return new List<UserRole>();
    }

    var parsed = new List<UserRole>();
    foreach (var roleValue in roles)
    {
        if (Enum.TryParse<UserRole>(roleValue, true, out var role))
        {
            parsed.Add(role);
        }
    }
    return NormalizeRoles(parsed);
}

static List<UserRole> GetUserRoles(AppUser userRow)
{
    var roles = ParseRolesCsv(userRow.Roles);
    if (roles.Count == 0)
    {
        roles = NormalizeRoles(new[] { userRow.Role });
    }
    return roles;
}

static void SetUserRoles(AppUser userRow, IReadOnlyList<UserRole> roles)
{
    var normalized = NormalizeRoles(roles);
    if (normalized.Count == 0)
    {
        normalized = new List<UserRole> { UserRole.Customer };
    }
    userRow.Roles = string.Join(",", normalized.Select(r => r.ToString()));
    userRow.Role = GetPrimaryRole(normalized);
}

static bool UserHasRole(AppUser userRow, UserRole role)
{
    return GetUserRoles(userRow).Contains(role);
}

static TimeZoneInfo ResolveTimeZone(string timeZoneId)
{
    return TimeZoneInfo.Local;
}

static string EscapeCsv(string value)
{
    if (string.IsNullOrEmpty(value))
    {
        return value;
    }

    var needsQuotes = value.Contains(',') || value.Contains('"') || value.Contains('\n');
    if (!needsQuotes)
    {
        return value;
    }

    var escaped = value.Replace("\"", "\"\"");
    return $"\"{escaped}\"";
}

static string GenerateTempPassword()
{
    return $"Temp{Guid.NewGuid():N}".Substring(0, 12);
}

static (double units, int amountCents) CalculatePayrollAmount(int rateCents, PayrollRateUnit rateUnit, int durationMinutes)
{
    if (rateCents <= 0)
    {
        return (0, 0);
    }

    if (rateUnit == PayrollRateUnit.Hour)
    {
        var hours = Math.Max(0, durationMinutes) / 60.0;
        var amount = (int)Math.Round(rateCents * hours);
        return (hours, amount);
    }

    return (1, rateCents);
}

static async Task<InstructorPayrollEntry> UpsertPayrollEntryAsync(
    AppDbContext db,
    Guid studioId,
    Guid reporterUserId,
    EventInstance instance,
    Instructor instructor)
{
    var bookingsCount = await db.Bookings.AsNoTracking()
        .Where(b => b.StudioId == studioId && b.EventInstanceId == instance.Id && b.Status == BookingStatus.Confirmed)
        .CountAsync();
    var presentCount = await db.Attendance.AsNoTracking()
        .Where(a => a.StudioId == studioId && a.EventInstanceId == instance.Id && a.Status == AttendanceStatus.Present)
        .CountAsync();

    var durationMinutes = (int)Math.Max(0, Math.Round((instance.EndUtc - instance.StartUtc).TotalMinutes));
    var (units, amountCents) = CalculatePayrollAmount(instructor.RateCents, instructor.RateUnit, durationMinutes);
    var currency = string.IsNullOrWhiteSpace(instructor.RateCurrency)
        ? (string.IsNullOrWhiteSpace(instance.Currency) ? "ILS" : instance.Currency)
        : instructor.RateCurrency;

    var entry = await db.InstructorPayrollEntries.FirstOrDefaultAsync(e =>
        e.StudioId == studioId && e.EventInstanceId == instance.Id && e.InstructorId == instructor.Id);

    if (entry == null)
    {
        entry = new InstructorPayrollEntry
        {
            Id = Guid.NewGuid(),
            StudioId = studioId,
            InstructorId = instructor.Id,
            EventInstanceId = instance.Id
        };
        db.InstructorPayrollEntries.Add(entry);
    }

    entry.ReportedByUserId = reporterUserId == Guid.Empty ? null : reporterUserId;
    entry.ReportedAtUtc = DateTime.UtcNow;
    entry.DurationMinutes = durationMinutes;
    entry.BookedCount = bookingsCount;
    entry.PresentCount = presentCount;
    entry.Units = units;
    entry.RateCents = instructor.RateCents;
    entry.RateUnit = instructor.RateUnit;
    entry.AmountCents = amountCents;
    entry.Currency = currency;

    await db.SaveChangesAsync();
    return entry;
}

static string NormalizeTagsJson(string? tagsJson, string? tags)
{
    var source = !string.IsNullOrWhiteSpace(tagsJson) ? tagsJson : tags;
    var parsed = ParseTags(source);
    return JsonSerializer.Serialize(parsed);
}

static async Task<CustomerStatus> EnsureDefaultCustomerStatusAsync(AppDbContext db, Guid studioId)
{
    var defaultStatus = await db.CustomerStatuses.FirstOrDefaultAsync(s =>
        s.StudioId == studioId && s.IsDefault && s.IsActive);
    if (defaultStatus != null)
    {
        return defaultStatus;
    }

    var fallback = await db.CustomerStatuses.FirstOrDefaultAsync(s =>
        s.StudioId == studioId && s.IsActive);
    if (fallback != null)
    {
        fallback.IsDefault = true;
        await db.SaveChangesAsync();
        return fallback;
    }

    var created = new CustomerStatus
    {
        Id = Guid.NewGuid(),
        StudioId = studioId,
        Name = "Active",
        IsDefault = true,
        IsActive = true
    };
    db.CustomerStatuses.Add(created);
    await db.SaveChangesAsync();
    return created;
}

static async Task<Guid?> ResolveCustomerStatusIdAsync(AppDbContext db, Guid studioId, Guid? statusId)
{
    if (statusId.HasValue)
    {
        var exists = await db.CustomerStatuses.AsNoTracking().AnyAsync(s =>
            s.Id == statusId.Value && s.StudioId == studioId && s.IsActive);
        if (exists)
        {
            return statusId;
        }
    }

    var fallback = await EnsureDefaultCustomerStatusAsync(db, studioId);
    return fallback.Id;
}

static async Task<(Customer customer, bool created)> EnsureGuestCustomerAsync(
    AppDbContext db,
    Guid studioId,
    AppUser userRow)
{
    var existing = await db.Customers.FirstOrDefaultAsync(c => c.StudioId == studioId && c.UserId == userRow.Id);
    if (existing != null)
    {
        var (firstName, lastName) = ResolveNameParts(userRow.DisplayName, existing.FirstName, existing.LastName);
        existing.FullName = userRow.DisplayName;
        existing.FirstName = firstName;
        existing.LastName = lastName;
        existing.IsArchived = false;
        if (!existing.StatusId.HasValue)
        {
            existing.StatusId = await ResolveCustomerStatusIdAsync(db, studioId, null);
        }
        db.Customers.Update(existing);
        return (existing, false);
    }

    var statusId = await ResolveCustomerStatusIdAsync(db, studioId, null);
    var (createdFirstName, createdLastName) = ResolveNameParts(userRow.DisplayName, null, null);
    var customer = new Customer
    {
        Id = Guid.NewGuid(),
        StudioId = studioId,
        UserId = userRow.Id,
        FirstName = createdFirstName,
        LastName = createdLastName,
        FullName = userRow.DisplayName,
        Phone = "",
        StatusId = statusId,
        TagsJson = "[]",
        IsArchived = false
    };
    db.Customers.Add(customer);
    return (customer, true);
}

static async Task<string> GetStatusNameAsync(AppDbContext db, Guid studioId, Guid? statusId)
{
    if (!statusId.HasValue)
    {
        return "";
    }

    var status = await db.CustomerStatuses.AsNoTracking().FirstOrDefaultAsync(s =>
        s.Id == statusId.Value && s.StudioId == studioId);
    return status?.Name ?? "";
}

static async Task<(Studio? studio, List<CalendarExportRow> rows)> LoadCalendarExportRowsAsync(
    AppDbContext db,
    Guid studioId,
    DateOnly? from,
    DateOnly? to,
    Guid? instructorId)
{
    var studio = await db.Studios.AsNoTracking().FirstOrDefaultAsync(s => s.Id == studioId);
    if (studio == null)
    {
        return (null, new List<CalendarExportRow>());
    }

    var fromDate = from ?? DateOnly.FromDateTime(DateTime.UtcNow);
    var toDate = to ?? fromDate.AddDays(14);
    var tz = ResolveTimeZone(studio.Timezone);
    var fromUtc = TimeZoneInfo.ConvertTimeToUtc(fromDate.ToDateTime(TimeOnly.MinValue), tz);
    var toUtc = TimeZoneInfo.ConvertTimeToUtc(toDate.ToDateTime(TimeOnly.MinValue), tz);

    var query = db.EventInstances.AsNoTracking()
        .Where(i => i.StudioId == studioId && i.StartUtc >= fromUtc && i.StartUtc < toUtc);
    if (instructorId.HasValue)
    {
        query = query.Where(i => i.InstructorId == instructorId);
    }

    var instances = await query.OrderBy(i => i.StartUtc).ToListAsync();
    var seriesMap = await db.EventSeries.AsNoTracking()
        .Where(s => s.StudioId == studioId)
        .ToDictionaryAsync(s => s.Id, s => s);
    var instructorMap = await db.Instructors.AsNoTracking()
        .Where(i => i.StudioId == studioId)
        .ToDictionaryAsync(i => i.Id, i => i);
    var roomMap = await db.Rooms.AsNoTracking()
        .Where(r => r.StudioId == studioId)
        .ToDictionaryAsync(r => r.Id, r => r);

    var rows = instances.Select(instance =>
    {
        seriesMap.TryGetValue(instance.EventSeriesId, out var series);
        var instructorIdValue = instance.InstructorId ?? series?.InstructorId;
        var roomIdValue = instance.RoomId ?? series?.RoomId;
        instructorMap.TryGetValue(instructorIdValue ?? Guid.Empty, out var instructor);
        roomMap.TryGetValue(roomIdValue ?? Guid.Empty, out var room);
        return new CalendarExportRow(
            instance.StartUtc,
            instance.EndUtc,
            series?.Title ?? "Session",
            series?.Description ?? "",
            instructor?.DisplayName ?? "",
            room?.Name ?? "",
            instance.Status);
    }).ToList();

    return (studio, rows);
}

static async Task<Guid?> ResolveInstructorIdAsync(AppDbContext db, Guid studioId, Guid userId)
{
    if (userId == Guid.Empty)
    {
        return null;
    }
    var instructor = await db.Instructors.AsNoTracking().FirstOrDefaultAsync(i =>
        i.StudioId == studioId && i.UserId == userId);
    return instructor?.Id;
}

static (string firstName, string lastName) ResolveNameParts(string fullName, string? firstName, string? lastName)
{
    var resolvedFirst = firstName?.Trim() ?? "";
    var resolvedLast = lastName?.Trim() ?? "";
    if (!string.IsNullOrWhiteSpace(resolvedFirst) && !string.IsNullOrWhiteSpace(resolvedLast))
    {
        return (resolvedFirst, resolvedLast);
    }

    var tokens = fullName.Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    if (string.IsNullOrWhiteSpace(resolvedFirst) && tokens.Length > 0)
    {
        resolvedFirst = tokens[0];
    }
    if (string.IsNullOrWhiteSpace(resolvedLast) && tokens.Length > 1)
    {
        resolvedLast = tokens[1];
    }
    return (resolvedFirst, resolvedLast);
}

static async Task<bool> HasSessionConflictAsync(
    AppDbContext db,
    Guid studioId,
    DateTime startUtc,
    DateTime endUtc,
    Guid? roomId,
    Guid? instructorId,
    Guid? excludeInstanceId)
{
    if (!roomId.HasValue && !instructorId.HasValue)
    {
        return false;
    }

    var query = db.EventInstances.AsNoTracking()
        .Where(i => i.StudioId == studioId && i.Status != EventStatus.Cancelled)
        .Where(i => i.StartUtc < endUtc && i.EndUtc > startUtc);

    if (excludeInstanceId.HasValue)
    {
        query = query.Where(i => i.Id != excludeInstanceId.Value);
    }

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

    return await query.AnyAsync();
}

static string BuildCalendarIcs(IEnumerable<CalendarExportRow> rows, string calendarName)
{
    var sb = new StringBuilder();
    sb.AppendLine("BEGIN:VCALENDAR");
    sb.AppendLine("VERSION:2.0");
    sb.AppendLine("PRODID:-//Letmein//Calendar Export//EN");
    sb.AppendLine($"X-WR-CALNAME:{EscapeIcs(calendarName)}");
    var stamp = DateTime.UtcNow.ToString("yyyyMMdd'T'HHmmss'Z'");
    foreach (var row in rows)
    {
        sb.AppendLine("BEGIN:VEVENT");
        sb.AppendLine($"UID:{Guid.NewGuid()}@letmein");
        sb.AppendLine($"DTSTAMP:{stamp}");
        sb.AppendLine($"DTSTART:{row.StartUtc:yyyyMMdd'T'HHmmss'Z'}");
        sb.AppendLine($"DTEND:{row.EndUtc:yyyyMMdd'T'HHmmss'Z'}");
        sb.AppendLine($"SUMMARY:{EscapeIcs(row.Title)}");
        if (!string.IsNullOrWhiteSpace(row.RoomName))
        {
            sb.AppendLine($"LOCATION:{EscapeIcs(row.RoomName)}");
        }
        var description = row.Description;
        if (!string.IsNullOrWhiteSpace(row.InstructorName))
        {
            description = string.IsNullOrWhiteSpace(description)
                ? $"Instructor: {row.InstructorName}"
                : $"{description}\nInstructor: {row.InstructorName}";
        }
        if (!string.IsNullOrWhiteSpace(description))
        {
            sb.AppendLine($"DESCRIPTION:{EscapeIcs(description)}");
        }
        sb.AppendLine("END:VEVENT");
    }
    sb.AppendLine("END:VCALENDAR");
    return sb.ToString();
}

static string BuildCalendarCsv(IEnumerable<CalendarExportRow> rows, TimeZoneInfo timeZone)
{
    var sb = new StringBuilder();
    sb.AppendLine("Title,Start,End,Instructor,Room,Status,Description");
    foreach (var row in rows)
    {
        var startLocal = TimeZoneInfo.ConvertTimeFromUtc(row.StartUtc, timeZone);
        var endLocal = TimeZoneInfo.ConvertTimeFromUtc(row.EndUtc, timeZone);
        var values = new[]
        {
            EscapeCsv(row.Title),
            EscapeCsv(startLocal.ToString("yyyy-MM-dd HH:mm")),
            EscapeCsv(endLocal.ToString("yyyy-MM-dd HH:mm")),
            EscapeCsv(row.InstructorName),
            EscapeCsv(row.RoomName),
            EscapeCsv(row.Status.ToString()),
            EscapeCsv(row.Description)
        };
        sb.AppendLine(string.Join(",", values));
    }
    return sb.ToString();
}

static string EscapeIcs(string value)
{
    if (string.IsNullOrWhiteSpace(value))
    {
        return "";
    }
    return value.Replace("\\", "\\\\")
        .Replace(";", "\\;")
        .Replace(",", "\\,")
        .Replace("\r\n", "\\n")
        .Replace("\n", "\\n");
}

static async Task LogAuditAsync(
    AppDbContext db,
    ClaimsPrincipal user,
    string action,
    string entityType,
    string entityId,
    string summary,
    object? data = null)
{
    var studioId = GetStudioId(user);
    var actorId = GetUserId(user);
    var role = GetActiveRole(user);
    await LogAuditRecordAsync(db, studioId, actorId == Guid.Empty ? null : actorId, role, action, entityType, entityId, summary, data);
}

static async Task LogAuditRecordAsync(
    AppDbContext db,
    Guid studioId,
    Guid? actorUserId,
    string actorRole,
    string action,
    string entityType,
    string entityId,
    string summary,
    object? data = null)
{
    var log = new AuditLog
    {
        Id = Guid.NewGuid(),
        StudioId = studioId,
        ActorUserId = actorUserId,
        ActorRole = actorRole ?? "",
        Action = action,
        EntityType = entityType,
        EntityId = entityId,
        Summary = summary,
        DataJson = data == null ? "{}" : JsonSerializer.Serialize(data),
        CreatedAtUtc = DateTime.UtcNow
    };

    db.AuditLogs.Add(log);
    await db.SaveChangesAsync();
}

static string NormalizeGuidListJson(string? json)
{
    var parsed = ParseGuidList(json);
    return JsonSerializer.Serialize(parsed);
}

static string NormalizeStringListJson(string? json)
{
    var parsed = ParseStringList(json);
    return JsonSerializer.Serialize(parsed);
}

static string TagsToDisplay(string? tagsJson)
{
    var parsed = ParseTags(tagsJson);
    return parsed.Count == 0 ? "" : string.Join(", ", parsed);
}

static List<string> ParseTags(string? value)
{
    if (string.IsNullOrWhiteSpace(value))
    {
        return new List<string>();
    }

    var trimmed = value.Trim();
    if (trimmed.StartsWith("[", StringComparison.Ordinal))
    {
        try
        {
            var parsed = JsonSerializer.Deserialize<List<string>>(trimmed);
            if (parsed != null)
            {
                return parsed
                    .Select(tag => tag?.Trim())
                    .Where(tag => !string.IsNullOrWhiteSpace(tag))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList()!;
            }
        }
        catch
        {
            // Fall back to comma-separated parsing.
        }
    }

    return trimmed
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Where(tag => !string.IsNullOrWhiteSpace(tag))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToList();
}

static List<Guid> ParseGuidList(string? json)
{
    if (string.IsNullOrWhiteSpace(json))
    {
        return new List<Guid>();
    }
    try
    {
        var parsed = JsonSerializer.Deserialize<List<Guid>>(json);
        return parsed?.Where(id => id != Guid.Empty).Distinct().ToList() ?? new List<Guid>();
    }
    catch
    {
        return new List<Guid>();
    }
}

static List<string> ParseStringListJson(string? json)
{
    return ParseStringList(json);
}

static List<string> ParseStringList(string? json)
{
    if (string.IsNullOrWhiteSpace(json))
    {
        return new List<string>();
    }

    var trimmed = json.Trim();
    if (trimmed.StartsWith("[", StringComparison.Ordinal))
    {
        try
        {
            var parsed = JsonSerializer.Deserialize<List<string>>(trimmed);
            if (parsed != null)
            {
                return parsed
                    .Select(item => item?.Trim())
                    .Where(item => !string.IsNullOrWhiteSpace(item))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList()!;
            }
        }
        catch
        {
            // Fall back to comma-separated parsing.
        }
    }

    return trimmed
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Where(item => !string.IsNullOrWhiteSpace(item))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToList();
}

static IEnumerable<object> BuildBirthdayEvents(
    IEnumerable<AppUser> users,
    DateOnly fromDate,
    DateOnly toDate,
    TimeZoneInfo timeZone,
    string color)
{
    var results = new List<object>();
    var startYear = fromDate.Year;
    var endYear = toDate.Year;
    foreach (var user in users)
    {
        if (user.DateOfBirth == null)
        {
            continue;
        }
        var dob = user.DateOfBirth.Value;
        for (var year = startYear; year <= endYear; year += 1)
        {
            var date = ResolveBirthdayDate(dob, year);
            if (!date.HasValue)
            {
                continue;
            }
            if (date.Value < fromDate || date.Value > toDate)
            {
                continue;
            }
            var startLocal = date.Value.ToDateTime(new TimeOnly(12, 0));
            var startUtc = TimeZoneInfo.ConvertTimeToUtc(startLocal, timeZone);
            results.Add(new
            {
                Id = Guid.NewGuid(),
                EventSeriesId = Guid.Empty,
                InstructorId = (Guid?)null,
                RoomId = (Guid?)null,
                StartUtc = startUtc,
                EndUtc = startUtc,
                Capacity = 0,
                remoteCapacity = 0,
                Status = EventStatus.Scheduled,
                PriceCents = 0,
                Currency = "ILS",
                notes = "",
                booked = 0,
                remoteBooked = 0,
                remoteInviteUrl = "",
                seriesTitle = user.DisplayName,
                seriesIcon = "",
                seriesColor = color,
                seriesDescription = "",
                instructorName = "",
                roomName = "",
                isMine = false,
                isHoliday = false,
                isBirthday = true,
                birthdayName = user.DisplayName
            });
        }
    }
    return results;
}

static DateOnly? ResolveBirthdayDate(DateOnly dob, int year)
{
    var month = dob.Month;
    var day = dob.Day;
    if (month == 2 && day == 29 && !DateTime.IsLeapYear(year))
    {
        day = 28;
    }
    try
    {
        return new DateOnly(year, month, day);
    }
    catch
    {
        return null;
    }
}

record CalendarExportRow(
    DateTime StartUtc,
    DateTime EndUtc,
    string Title,
    string Description,
    string InstructorName,
    string RoomName,
    EventStatus Status);

