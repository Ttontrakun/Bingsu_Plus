# รันสคริปต์นี้หลังจากหยุด backend (Ctrl+C) แล้ว
# ใช้สำหรับ: Prisma generate + migrate deploy เพื่อให้รองรับ avatarUrl

Set-Location $PSScriptRoot

# โหลด .env และ .env.local (ถ้ามี) เพื่อให้มี DATABASE_URL
foreach ($envFile in @('.env', '.env.local')) {
    if (Test-Path $envFile) {
        Write-Host "Loading $envFile..." -ForegroundColor Gray
        Get-Content $envFile -Raw | ForEach-Object {
            $_ -split "`n" | ForEach-Object {
                if ($_ -match '^\s*([^#=][^=]*)=(.*)$') {
                    $name = $matches[1].Trim()
                    $value = $matches[2].Trim() -replace '^["'']|["'']$', ''
                    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
                }
            }
        }
    }
}
if (-not $env:DATABASE_URL) {
    Write-Host "DATABASE_URL not set. Copy env.sample to .env and set DATABASE_URL, or use Docker: docker compose run --rm legacy npx prisma migrate deploy" -ForegroundColor Yellow
    $doMigrate = $false
} else {
    $doMigrate = $true
}

Write-Host "Running prisma generate..." -ForegroundColor Cyan
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "prisma generate failed. Make sure backend is stopped." -ForegroundColor Red
    exit 1
}

if ($doMigrate) {
    Write-Host "Running prisma migrate deploy..." -ForegroundColor Cyan
    npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) {
        Write-Host "prisma migrate deploy failed. Is the database running?" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Skipping prisma migrate deploy (no DATABASE_URL)." -ForegroundColor Yellow
    exit 1
}

Write-Host "Done. You can start the backend again (npm run dev:legacy)." -ForegroundColor Green
