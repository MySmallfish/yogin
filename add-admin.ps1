param(
    [string]$Email = 'admin@letmein.local',
    [string]$Password = 'admin123',
    [string]$StudioSlug = 'demo',
    [switch]$ResetPassword
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Email)) {
    Write-Error 'Email is required.'
    exit 1
}
if ([string]::IsNullOrWhiteSpace($Password)) {
    Write-Error 'Password is required.'
    exit 1
}
if ([string]::IsNullOrWhiteSpace($StudioSlug)) {
    Write-Error 'StudioSlug is required.'
    exit 1
}

$projectPath = Join-Path $PSScriptRoot 'Letmein\Letmein.csproj'
$resetArg = ''
if ($ResetPassword.IsPresent) {
    $resetArg = '--reset-password'
}

Write-Host "Bootstrapping admin user for studio '$StudioSlug'..."

$cmd = @(
    'dotnet', 'run', '--project', $projectPath, '--',
    '--add-admin',
    '--email', $Email,
    '--password', $Password,
    '--studio', $StudioSlug
)
if ($resetArg -ne '') {
    $cmd += $resetArg
}

& $cmd
if ($LASTEXITCODE -ne 0) {
    Write-Error "Admin bootstrap failed with exit code $LASTEXITCODE."
    exit $LASTEXITCODE
}

Write-Host 'Done.'
