@echo off
setlocal enabledelayedexpansion

set ROOT=%~dp0
set PUBLISH_DIR=%ROOT%publish
set ZIP_FILE=%ROOT%publish.zip
set SETTINGS=%ROOT%azure.PublishSettings
set TEST_PID_FILE=%ROOT%testserver.pid
set TEST_BASE_URL=http://127.0.0.1:5055

if not exist "%SETTINGS%" (
  echo Missing azure.PublishSettings at %SETTINGS%
  exit /b 1
)

echo Publishing...
dotnet publish "%ROOT%Letmein\Letmein.csproj" -c Release -o "%PUBLISH_DIR%"
if errorlevel 1 exit /b 1

echo Running Playwright tests...
where npm >nul 2>nul
if errorlevel 1 (
  echo npm is required to run Playwright tests.
  exit /b 1
)

if not exist "%ROOT%node_modules" (
  npm install
  if errorlevel 1 exit /b 1
)

echo Installing Playwright browsers...
npx playwright install
if errorlevel 1 exit /b 1

echo Starting local test server...
powershell -NoProfile -Command "$p=Start-Process -FilePath 'dotnet' -ArgumentList 'Letmein.dll --urls %TEST_BASE_URL%' -WorkingDirectory '%PUBLISH_DIR%' -PassThru; $p.Id | Out-File '%TEST_PID_FILE%'"
if errorlevel 1 exit /b 1

powershell -NoProfile -Command "$url='%TEST_BASE_URL%/admin/'; for ($i=0; $i -lt 30; $i++) { try { Invoke-WebRequest -Uri $url -UseBasicParsing | Out-Null; exit 0 } catch { Start-Sleep -Seconds 1 } }; exit 1"
if errorlevel 1 (
  call :stopserver
  exit /b 1
)

set PLAYWRIGHT_BASE_URL=%TEST_BASE_URL%
set ADMIN_EMAIL=admin@letmein.local
set ADMIN_PASSWORD=admin123
set STUDIO_SLUG=demo
npm run test:e2e
if errorlevel 1 (
  call :stopserver
  exit /b 1
)

call :stopserver

echo Creating zip...
powershell -NoProfile -Command "Compress-Archive -Path '%PUBLISH_DIR%\*' -DestinationPath '%ZIP_FILE%' -Force"
if errorlevel 1 exit /b 1

echo Deploying via ZipDeploy...
powershell -NoProfile -Command "[xml]$xml=Get-Content '%SETTINGS%'; $profile=$xml.publishData.publishProfile | Where-Object { $_.publishMethod -eq 'ZipDeploy' } | Select-Object -First 1; if (-not $profile) { throw 'ZipDeploy profile not found'; } $user=$profile.userName; $pass=$profile.userPWD; $publishUrl=$profile.publishUrl; $pair=\"$user`:$pass\"; $bytes=[Text.Encoding]::ASCII.GetBytes($pair); $encoded=[Convert]::ToBase64String($bytes); $headers=@{ Authorization = \"Basic $encoded\" }; $uri=\"https://$publishUrl/api/zipdeploy\"; Invoke-RestMethod -Uri $uri -Method POST -InFile '%ZIP_FILE%' -ContentType 'application/zip' -Headers $headers"
if errorlevel 1 exit /b 1

echo Deployment completed.
endlocal

goto :eof

:stopserver
if exist "%TEST_PID_FILE%" (
  for /f %%p in (%TEST_PID_FILE%) do (
    taskkill /F /PID %%p >nul 2>nul
  )
  del "%TEST_PID_FILE%" >nul 2>nul
)
exit /b 0
