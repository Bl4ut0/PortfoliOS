<#
.SYNOPSIS
    Builds the PortfoliOS Native Relay MSI Installer using WiX Toolset v5.
#>
param(
    [string]$OutputDir = "$PSScriptRoot\..\..\..\dist"
)

$ErrorActionPreference = "Stop"

$scriptDir = $PSScriptRoot
$distDir = [System.IO.Path]::GetFullPath($OutputDir)
$wxsFile = Join-Path $scriptDir "Package.wxs"
$outputMsi = Join-Path $distDir "PortfoliOS-NativeRelay.msi"

if (-not (Test-Path $distDir)) {
    New-Item -Path $distDir -ItemType Directory -Force | Out-Null
}

Write-Host "Building PortfoliOS-NativeRelay.msi..." -ForegroundColor Cyan

# Check if wix is available
$wixCmd = Get-Command wix -ErrorAction SilentlyContinue
if (-not $wixCmd) {
    Write-Host "WiX is not installed. Installing WiX v5 dotnet tool..." -ForegroundColor Yellow
    dotnet tool install --global wix --version 5.0.2
}

wix build $wxsFile -b $scriptDir -out $outputMsi
$pdbFile = [System.IO.Path]::ChangeExtension($outputMsi, ".wixpdb")
if (Test-Path $pdbFile) {
    Remove-Item -Path $pdbFile -Force -ErrorAction SilentlyContinue
}

if (Test-Path $outputMsi) {
    $size = (Get-Item $outputMsi).Length
    Write-Host "Successfully built MSI: $outputMsi ($([Math]::Round($size / 1KB, 1)) KB)" -ForegroundColor Green
} else {
    Write-Error "Failed to produce MSI at $outputMsi"
}
