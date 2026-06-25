@echo off
setlocal

:: -----------------------------------------------------------------------
::  Flow Analytics - JIRA Export
::  Doppelklick zum Starten. Gibt eine JSON-Datei fuer das Dashboard aus.
:: -----------------------------------------------------------------------

set "CONFIG=%~dp0..\config\flow_config.json"
set "SCRIPT=%~dp0jira_transform.ps1"

:: Config pruefen
if not exist "%CONFIG%" (
    echo.
    echo [FEHLER] config\flow_config.json nicht gefunden.
    echo.
    echo  Bitte die Vorlage kopieren und anpassen:
    echo    config\flow_config.example.json  ^>  config\flow_config.json
    echo.
    pause
    exit /b 1
)

:: PowerShell-Version pruefen (mind. 3.0 benoetigt)
for /f "usebackq tokens=*" %%V in (
    `powershell -NoProfile -Command "$PSVersionTable.PSVersion.Major" 2^>nul`
) do set PS_MAJOR=%%V

if "%PS_MAJOR%"=="" (
    echo.
    echo [FEHLER] PowerShell nicht gefunden oder nicht ausfuehrbar.
    echo.
    pause
    exit /b 1
)
if %PS_MAJOR% LSS 3 (
    echo.
    echo [FEHLER] PowerShell Version %PS_MAJOR% zu alt. Mindestens Version 3 benoetigt.
    echo.
    pause
    exit /b 1
)

:: Export starten
chcp 65001 >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass ^
    -File "%SCRIPT%" ^
    -ConfigPath "%CONFIG%"

set EXIT_CODE=%errorlevel%

echo.
if %EXIT_CODE% equ 0 (
    echo  Fertig! Die JSON-Datei liegt im Projekt-Hauptordner.
    echo  Im Dashboard: Datei laden ^> JSON-Datei auswaehlen.
) else (
    echo  [FEHLER] Export fehlgeschlagen ^(Exitcode %EXIT_CODE%^).
    echo  Bitte die Fehlermeldung oben pruefen.
)
echo.
pause
