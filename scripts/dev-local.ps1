# TaxDesk PK — start local infra + API + web (Windows PowerShell)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "Starting Docker infra (Postgres, Redis)..." -ForegroundColor Cyan
docker compose up -d postgres redis
if ($LASTEXITCODE -ne 0) {
  Write-Host "Docker failed. Start Docker Desktop, then re-run this script." -ForegroundColor Red
  exit 1
}

Write-Host "Waiting for Postgres..." -ForegroundColor Cyan
$deadline = (Get-Date).AddMinutes(2)
do {
  Start-Sleep -Seconds 3
  docker compose exec -T postgres pg_isready -U taxdesk -d taxdesk_dev 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { break }
} while ((Get-Date) -lt $deadline)

Write-Host "Applying migrations..." -ForegroundColor Cyan
pnpm prisma migrate deploy

Write-Host "Seeding demo firm (idempotent)..." -ForegroundColor Cyan
pnpm db:seed:demo

Write-Host "Starting web (3000) + worker (3001)..." -ForegroundColor Cyan
Write-Host "Login: demo-firm / owner@demo.taxdesk.local / Demo-Only-Passw0rd! + TOTP secret from .env.e2e.example" -ForegroundColor Green
pnpm dev
