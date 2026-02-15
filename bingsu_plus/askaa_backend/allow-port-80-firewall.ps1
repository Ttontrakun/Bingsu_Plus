# เปิดพอร์ต 80 ใน Windows Firewall เพื่อให้คนอื่น (มือถือ/โน๊ตบุ๊คเครื่องอื่น) เข้าเว็บได้
# วิธีใช้: เปิด PowerShell as Administrator แล้วรัน .\allow-port-80-firewall.ps1

$ruleName = "Bingsu HTTP 80"
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    # อัปเดตให้รับทุกประเภทเครือข่าย (รวม Public) เพื่อให้เครื่องอื่นใน WiFi เข้าได้
    Set-NetFirewallRule -DisplayName $ruleName -Profile Any -ErrorAction SilentlyContinue
    Write-Host "กฎ '$ruleName' มีอยู่แล้ว — อัปเดตให้รับทุกเครือข่าย (รวม Public) แล้ว" -ForegroundColor Green
} else {
    try {
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow -Profile Any
        Write-Host "เพิ่มกฎ Firewall สำเร็จ — คนอื่นเข้า http://(IP เครื่องนี้) ได้แล้ว" -ForegroundColor Green
    } catch {
        Write-Host "เกิดข้อผิดพลาด (ต้อง Run as Administrator): $_" -ForegroundColor Red
        exit 1
    }
}
Write-Host "ให้เครื่องอื่น (มือถือ/โน๊ตบุ๊ค) เปิดเบราว์เซอร์ไปที่ http://(IP เครื่องที่รัน Docker) — ต้องอยู่ WiFi/เครือข่ายเดียวกัน" -ForegroundColor Cyan
