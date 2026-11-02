<#
.SYNOPSIS
    Registers the PortfoliOS Native Relay Host with Chrome, Edge, Brave, and Firefox on Windows.

.PARAMETER ChromeExtensionId
    The unpacked Chrome/Edge extension ID (e.g. from chrome://extensions).
#>
param (
    [string]$ChromeExtensionId = ""
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$runnerPath = Join-Path $scriptDir "host-runner.bat"
$chromeManifestPath = Join-Path $scriptDir "manifests\com.bl4ut0.portfolios.relay.chrome.json"
$firefoxManifestPath = Join-Path $scriptDir "manifests\com.bl4ut0.portfolios.relay.firefox.json"

Write-Host "Registering PortfoliOS Native Relay Host..." -ForegroundColor Cyan
Write-Host "Runner script: $runnerPath"

# Prompt for extension ID if not provided
if ([string]::IsNullOrWhiteSpace($ChromeExtensionId)) {
    Write-Host "`nChrome requires your specific unpacked Extension ID (found at chrome://extensions with Developer mode ON)." -ForegroundColor Yellow
    $userInput = Read-Host "Enter your Extension ID (or press Enter if using Firefox only)"
    if (-not [string]::IsNullOrWhiteSpace($userInput)) {
        $ChromeExtensionId = $userInput.Trim()
    }
}

# Update Chrome / Chromium manifest with absolute path and extension ID
$chromeAllowed = @()
if (-not [string]::IsNullOrWhiteSpace($ChromeExtensionId)) {
    $cleanId = $ChromeExtensionId -replace '^chrome-extension://', '' -replace '/.*$', ''
    $chromeAllowed += "chrome-extension://$cleanId/"
    Write-Host "Configured Chrome extension origin: chrome-extension://$cleanId/" -ForegroundColor Green
} else {
    Write-Warning "No Chrome Extension ID specified. The Chrome bridge will remain offline until an ID is registered."
}

$chromeJson = @{
    name = "com.bl4ut0.portfolios.relay"
    description = "PortfoliOS Native Relay Host (UDP/TCP Bridge)"
    path = $runnerPath
    type = "stdio"
    allowed_origins = $chromeAllowed
} | ConvertTo-Json -Depth 5

Set-Content -Path $chromeManifestPath -Value $chromeJson -Encoding utf8
Write-Host "Wrote Chrome manifest: $chromeManifestPath" -ForegroundColor Green

# Update Firefox manifest with absolute path
$firefoxJson = @{
    name = "com.bl4ut0.portfolios.relay"
    description = "PortfoliOS Native Relay Host (UDP/TCP Bridge)"
    path = $runnerPath
    type = "stdio"
    allowed_extensions = @("relay@os.bl4ut0.dev", "relay@os.bl4ut0.com")
} | ConvertTo-Json -Depth 5

Set-Content -Path $firefoxManifestPath -Value $firefoxJson -Encoding utf8
Write-Host "Wrote Firefox manifest: $firefoxManifestPath" -ForegroundColor Green

# Registry paths for Native Messaging
$targets = @(
    @{ Name = "Google Chrome"; Key = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.bl4ut0.portfolios.relay"; Manifest = $chromeManifestPath },
    @{ Name = "Microsoft Edge"; Key = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.bl4ut0.portfolios.relay"; Manifest = $chromeManifestPath },
    @{ Name = "Brave Browser"; Key = "HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.bl4ut0.portfolios.relay"; Manifest = $chromeManifestPath },
    @{ Name = "Mozilla Firefox"; Key = "HKCU:\Software\Mozilla\NativeMessagingHosts\com.bl4ut0.portfolios.relay"; Manifest = $firefoxManifestPath }
)

foreach ($target in $targets) {
    try {
        if (-not (Test-Path (Split-Path $target.Key))) {
            New-Item -Path (Split-Path $target.Key) -ItemType Directory -Force | Out-Null
        }
        New-Item -Path $target.Key -Force | Out-Null
        Set-ItemProperty -Path $target.Key -Name "(Default)" -Value $target.Manifest
        Write-Host "Registered in $($target.Name): $($target.Key)" -ForegroundColor Green
    } catch {
        Write-Warning "Could not register $($target.Name): $_"
    }
}

Write-Host "`nSetup complete! Remember to click the reload icon on the extension at chrome://extensions if you just updated files." -ForegroundColor Cyan
