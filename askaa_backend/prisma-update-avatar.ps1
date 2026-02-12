# รันสคริปต์นี้หลังจากหยุด backend (Ctrl+C) แล้ว
# ใช้สำหรับ: Prisma generate + migrate deploy เพื่อให้รองรับ avatarUrl

Set-Location $PSScriptRoot

Write-Host "Running prisma generate..." -ForegroundColor Cyan
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "prisma generate failed. Make sure backend is stopped." -ForegroundColor Red
    exit 1
}

Write-Host "Running prisma migrate deploy..." -ForegroundColor Cyan
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "prisma migrate deploy failed." -ForegroundColor Red
    exit 1
}

Write-Host "Done. You can start the backend again (npm run dev:legacy)." -ForegroundColor Green
