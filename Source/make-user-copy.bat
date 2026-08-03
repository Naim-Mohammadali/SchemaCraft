@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "USER_RELEASE=release\SchemaCraft-Windows-User"

if not exist "SchemaCraft.exe" (
  echo ERROR: SchemaCraft.exe was not found. Run build-windows.bat first.
  exit /b 1
)

if exist "%USER_RELEASE%" rmdir /S /Q "%USER_RELEASE%"
mkdir "%USER_RELEASE%"
mkdir "%USER_RELEASE%\app"

copy /Y "SchemaCraft.exe" "%USER_RELEASE%\SchemaCraft.exe" >nul
if errorlevel 1 exit /b 1

xcopy "app\*" "%USER_RELEASE%\app\" /E /I /Y >nul
if errorlevel 1 exit /b 1

rem Builder authentication is optional.
if exist "builder-auth.json" (
  copy /Y "builder-auth.json" "%USER_RELEASE%\builder-auth.json" >nul
  if errorlevel 1 exit /b 1
)

if /I not "%~1"=="/quiet" (
  echo.
  echo User package created: %USER_RELEASE%
  echo.
  echo No data folder was copied into the package.
  echo SchemaCraft creates its runtime data files when first started.
  if exist "builder-auth.json" (
    echo Builder password configuration was included.
  ) else (
    echo Builder access is disabled until builder-auth.json is configured.
  )
  pause
)
exit /b 0
