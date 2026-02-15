# Build และ up Docker (legacy + web แล้ว up ทั้ง stack)
# ใช้เมื่อแก้ backend (legacy) หรือ frontend (web) แล้วอยากให้เห็นผลทันที

Set-Location $PSScriptRoot

Write-Host "Building legacy..." -ForegroundColor Cyan
docker compose -f docker-compose.prod.yml build legacy --no-cache
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "Building web..." -ForegroundColor Cyan
docker compose -f docker-compose.prod.yml build web --no-cache
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "Starting containers..." -ForegroundColor Cyan
docker compose -f docker-compose.prod.yml up -d
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "Done. เปิด http://localhost หรือ http://192.168.1.8 ได้เลย" -ForegroundColor Green
