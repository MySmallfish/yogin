# Letmein

Scheduling SaaS MVP for studio managers. Backend is ASP.NET Core + EF Core (SQLite). Frontend is no-build HTML/JS/CSS with XState.

## Run locally

```powershell
# from repo root
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run --project .\Letmein\Letmein.csproj
```

Open:
- Admin app: `http://localhost:5000/admin/`
- Client app: `http://localhost:5000/app/`
- Public schedule: `http://localhost:5000/s/demo`

## Seeded demo accounts

- Admin: `admin@letmein.local` / `admin123`
- Instructor: `instructor@letmein.local` / `teach123`
- Member: `member@letmein.local` / `member123`

## Notes

- SQLite DB file is created as `letmein.db` in the `Letmein` directory.
- Event instances are generated for the next 8 weeks when the app starts and then refreshed every 6 hours.
- Payments are stored as `manual` in this MVP for fast iteration.
