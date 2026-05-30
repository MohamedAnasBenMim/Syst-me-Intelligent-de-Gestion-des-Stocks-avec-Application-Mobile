# SGS Mobile - Gateway + Tunnel backend
$ProjectDir = "c:\Users\nherz\OneDrive\Desktop\Projet Gestion-Stock"
$MobileDir  = "$ProjectDir\mobile"
$ApiFile    = "$MobileDir\src\services\api.js"

Write-Host "SGS Mobile - Demarrage" -ForegroundColor Cyan

# 1. Gateway
Write-Host "[1/2] Gateway..." -ForegroundColor Yellow
Start-Process "cmd" -ArgumentList "/k cd /d $ProjectDir && node gateway.js" -WindowStyle Normal
Start-Sleep -Seconds 2

# 2. Tunnel backend
Write-Host "[2/2] Tunnel backend Cloudflare..." -ForegroundColor Yellow
$backendLog = "$env:TEMP\sgs_backend.log"
if (Test-Path $backendLog) { Remove-Item $backendLog -Force }
Start-Process "cloudflared" -ArgumentList "tunnel --url http://localhost:9000" -RedirectStandardError $backendLog -PassThru -WindowStyle Hidden | Out-Null

Write-Host "Attente URL backend (max 30s)..." -ForegroundColor Gray
$backendUrl = $null
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $backendLog) {
        $content = Get-Content $backendLog -Raw -ErrorAction SilentlyContinue
        if ($content -match 'https://[\w\-]+\.trycloudflare\.com') {
            $backendUrl = $Matches[0]
            break
        }
    }
}

if ($backendUrl) {
    Write-Host "Backend URL: $backendUrl" -ForegroundColor Green
    $apiContent = Get-Content $ApiFile -Raw
    $apiContent = $apiContent -replace 'const TUNNEL_URL = .*?;', "const TUNNEL_URL = '$backendUrl';"
    Set-Content $ApiFile $apiContent -Encoding UTF8
    Write-Host "api.js mis a jour!" -ForegroundColor Green
} else {
    Write-Host "ERREUR: URL introuvable, relancez le script" -ForegroundColor Red
}

Write-Host ""
Write-Host "Etapes suivantes:" -ForegroundColor Yellow
Write-Host "  Terminal 1: ngrok http 8081" -ForegroundColor White
Write-Host '  Terminal 2: $env:REACT_NATIVE_PACKAGER_HOSTNAME="overlook-doze-unbitten.ngrok-free.dev"' -ForegroundColor White
Write-Host "  Terminal 2: npx expo start" -ForegroundColor White
Write-Host ""
Write-Host "Appuyez sur Entree pour fermer..." -ForegroundColor Gray
Read-Host
