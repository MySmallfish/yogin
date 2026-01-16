@echo off
setlocal enabledelayedexpansion

set ROOT=%~dp0
set PUBLISH_DIR=%ROOT%publish
set ZIP_FILE=%ROOT%publish.zip
set SETTINGS=%ROOT%azure.PublishSettings

if not exist "%SETTINGS%" (
  echo Missing azure.PublishSettings at %SETTINGS%
  exit /b 1
)

echo Publishing...
dotnet publish "%ROOT%Letmein\Letmein.csproj" -c Release -o "%PUBLISH_DIR%"
if errorlevel 1 exit /b 1

echo Creating zip...
powershell -NoProfile -Command "Compress-Archive -Path '%PUBLISH_DIR%\*' -DestinationPath '%ZIP_FILE%' -Force"
if errorlevel 1 exit /b 1

echo Deploying via ZipDeploy...
powershell -NoProfile -Command "[xml]$xml=Get-Content '%SETTINGS%'; $profile=$xml.publishData.publishProfile | Where-Object { $_.publishMethod -eq 'ZipDeploy' } | Select-Object -First 1; if (-not $profile) { throw 'ZipDeploy profile not found'; } $user=$profile.userName; $pass=$profile.userPWD; $publishUrl=$profile.publishUrl; $pair=\"$user`:$pass\"; $bytes=[Text.Encoding]::ASCII.GetBytes($pair); $encoded=[Convert]::ToBase64String($bytes); $headers=@{ Authorization = \"Basic $encoded\" }; $uri=\"https://$publishUrl/api/zipdeploy\"; Invoke-RestMethod -Uri $uri -Method POST -InFile '%ZIP_FILE%' -ContentType 'application/zip' -Headers $headers"
if errorlevel 1 exit /b 1

echo Deployment completed.
endlocal