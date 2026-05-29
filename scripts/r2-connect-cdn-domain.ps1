# Connect cdn.stillwet.com (or custom name) to an R2 bucket via Wrangler.
# Prereq: npx wrangler login
#
# Usage:
#   .\scripts\r2-connect-cdn-domain.ps1
#   .\scripts\r2-connect-cdn-domain.ps1 -Bucket stillwet-listings -Domain cdn.stillwet.com

param(
  [string]$Bucket = "",
  [string]$Domain = "cdn.stillwet.com"
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "Checking wrangler auth..."
$whoami = npx wrangler whoami 2>&1 | Out-String
if ($whoami -match "not authenticated") {
  Write-Host "Run: npx wrangler login"
  exit 1
}

if (-not $Bucket) {
  if (Test-Path ".env.local") {
    Get-Content ".env.local" | ForEach-Object {
      if ($_ -match '^\s*R2_BUCKET(?:_NAME)?\s*=\s*"?([^"#]+)"?\s*$') {
        $Bucket = $Matches[1].Trim()
      }
    }
  }
}

if (-not $Bucket) {
  $Bucket = Read-Host "R2 bucket name"
}

Write-Host "Looking up zone for stillwet.com..."
$zonesJson = npx wrangler zones list 2>&1 | Out-String
$zoneId = $null
foreach ($line in ($zonesJson -split "`n")) {
  if ($line -match 'stillwet\.com' -and $line -match '([a-f0-9]{32})') {
    $zoneId = $Matches[1]
    break
  }
}

if (-not $zoneId) {
  Write-Host @"

Could not find stillwet.com in your Cloudflare account.

Add the zone first (Cloudflare dashboard -> Add site -> stillwet.com).
For IONOS + Vercel, use partial (CNAME) setup so you keep IONOS nameservers.

See docs/r2-stillwet-domain.md

"@
  npx wrangler zones list
  exit 1
}

Write-Host "Bucket: $Bucket"
Write-Host "Domain: $Domain"
Write-Host "Zone ID: $zoneId"
Write-Host ""

npx wrangler r2 bucket domain add $Bucket --domain $Domain --zone-id $zoneId -y

Write-Host @"

Next steps:
  1. If using partial DNS at IONOS, add the CNAME record Cloudflare shows for cdn.
  2. Set R2_PUBLIC_BASE_URL=https://$Domain in Vercel (Production) and .env.local
  3. Redeploy Vercel
  4. npm run test:r2

"@
