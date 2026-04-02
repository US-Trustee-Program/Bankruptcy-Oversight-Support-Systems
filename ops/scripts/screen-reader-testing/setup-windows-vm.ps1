# setup-windows-vm.ps1
# Automates setup of a Windows 11 ARM VM for screen reader testing with CAMS.
# Run this script inside the VM as Administrator.
#
# Usage:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\setup-windows-vm.ps1

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== CAMS Screen Reader Testing - VM Setup ===" -ForegroundColor Cyan
Write-Host ""

# --- Check for winget ---
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: winget is not available. Please install App Installer from the Microsoft Store." -ForegroundColor Red
    Write-Host "https://apps.microsoft.com/detail/9nblggh4nns1" -ForegroundColor Yellow
    exit 1
}

# --- Install Google Chrome ARM64 ---
Write-Host "[1/3] Installing Google Chrome..." -ForegroundColor Green
winget install --id=Google.Chrome -e --accept-source-agreements --accept-package-agreements
if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) {
    # -1978335189 = already installed
    Write-Host "WARNING: Chrome installation returned exit code $LASTEXITCODE" -ForegroundColor Yellow
} else {
    Write-Host "  Chrome installed successfully." -ForegroundColor Green
}

# --- Install NVDA ---
Write-Host "[2/3] Installing NVDA screen reader..." -ForegroundColor Green
winget install --id=NVAccess.NVDA -e --accept-source-agreements --accept-package-agreements
if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) {
    Write-Host "WARNING: NVDA installation returned exit code $LASTEXITCODE" -ForegroundColor Yellow
} else {
    Write-Host "  NVDA installed successfully." -ForegroundColor Green
}

# --- Configure NVDA defaults for testing ---
Write-Host "[3/3] Configuring NVDA for testing..." -ForegroundColor Green

$nvdaConfigDir = "$env:APPDATA\nvda"
$nvdaConfigFile = "$nvdaConfigDir\nvda.ini"

if (Test-Path $nvdaConfigDir) {
    # Back up existing config if present
    if (Test-Path $nvdaConfigFile) {
        Copy-Item $nvdaConfigFile "$nvdaConfigFile.bak" -Force
        Write-Host "  Backed up existing NVDA config to nvda.ini.bak" -ForegroundColor Gray
    }

    # Write testing-friendly NVDA configuration
    @"
[speech]
    autoLanguageSwitching = False
    autoDialectSwitching = False
    symbolLevel = 300
    trustVoiceLanguage = True

[presentation]
    reportKeyboardShortcuts = True
    reportObjectPositionInformation = True
    reportTooltips = True

[braille]
    enabled = False

[general]
    showWelcomeDialogAtStartup = False
    playStartAndExitSounds = False
"@ | Out-File -FilePath $nvdaConfigFile -Encoding utf8

    Write-Host "  NVDA configured with testing defaults:" -ForegroundColor Green
    Write-Host "    - Symbol level: most (verbose announcements)" -ForegroundColor Gray
    Write-Host "    - Welcome dialog disabled" -ForegroundColor Gray
    Write-Host "    - Startup/exit sounds disabled" -ForegroundColor Gray
    Write-Host "    - Braille display disabled" -ForegroundColor Gray
} else {
    Write-Host "  NVDA config directory not found. Launch NVDA once, then re-run this script to apply config." -ForegroundColor Yellow
}

# --- Print connection instructions ---
Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host ""
Write-Host "  1. On your Mac, start the CAMS dev server:" -ForegroundColor White
Write-Host "     cd user-interface" -ForegroundColor Yellow
Write-Host "     npm run test:screen-reader" -ForegroundColor Yellow
Write-Host ""
Write-Host "  2. Find your Mac's IP address:" -ForegroundColor White
Write-Host "     ipconfig getifaddr en0" -ForegroundColor Yellow
Write-Host ""
Write-Host "  3. In this VM, open Chrome and go to:" -ForegroundColor White
Write-Host "     http://<mac-ip>:3000" -ForegroundColor Yellow
Write-Host ""

# Try to detect the default gateway as a hint for the host IP
$gateway = (Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue |
    Sort-Object -Property RouteMetric |
    Select-Object -First 1).NextHop

if ($gateway) {
    Write-Host "  Detected default gateway: $gateway" -ForegroundColor Gray
    Write-Host "  Your Mac host may be reachable at this address." -ForegroundColor Gray
    Write-Host "  Try: http://${gateway}:3000" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "  4. Start a screen reader:" -ForegroundColor White
Write-Host "     - NVDA: Launch from Start menu" -ForegroundColor Yellow
Write-Host "     - Narrator: Win + Ctrl + Enter" -ForegroundColor Yellow
Write-Host ""
Write-Host "See docs/contributing/screen-reader-testing.md for the full testing guide." -ForegroundColor Gray
Write-Host ""
