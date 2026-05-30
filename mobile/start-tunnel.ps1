# SGS Mobile — Mode tunnel Cloudflare (sans ngrok)
# API + Metro Expo tunnelises via Cloudflare
# Usage : npm run tunnel

$ROOT      = "c:\Users\nherz\OneDrive\Desktop\Projet Gestion-Stock"
$MOBILE    = "$ROOT\mobile"
$API_JS    = "$MOBILE\src\services\api.js"
$EXPO_PORT = 80   # Port 80 requis : Cloudflare n'expose que 80/443 en externe

Write-Host "`n=== SGS Mobile Tunnel (Cloudflare) ===" -ForegroundColor Cyan

# --- Verifier que le port 80 est disponible ---
$portOccupe = Get-NetTCPConnection -LocalPort $EXPO_PORT -State Listen -ErrorAction SilentlyContinue
if ($portOccupe) {
    Write-Host "`nERREUR: Le port $EXPO_PORT est deja utilise." -ForegroundColor Red
    Write-Host "        Stoppe le service qui l'occupe (ex: IIS) puis relance." -ForegroundColor Yellow
    Write-Host "        Commande pour identifier : netstat -ano | findstr :80" -ForegroundColor DarkGray
    exit 1
}

# [1/4] Gateway
Write-Host "`n[1/4] Demarrage du gateway..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$ROOT'; node gateway.js`""
Start-Sleep -Seconds 2

# [2/4] Tunnel API (port 9000)
Write-Host "[2/4] Tunnel API (port 9000)..." -ForegroundColor Yellow
$tmpApi = "$env:TEMP\cf_api_$PID.txt"
Remove-Item $tmpApi -ErrorAction SilentlyContinue
Start-Process powershell -ArgumentList "-NoExit -Command `"cloudflared tunnel --url http://localhost:9000 2>&1 | Tee-Object -FilePath '$tmpApi'`""

Write-Host "     Attente de l'URL API..."
$apiUrl = $null
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 2
    if (Test-Path $tmpApi) {
        $content = Get-Content $tmpApi -Raw -ErrorAction SilentlyContinue
        if ($content -match "https://[a-z0-9\-]+\.trycloudflare\.com") {
            $apiUrl = $matches[0]; break
        }
    }
}
if (-not $apiUrl) { Write-Host "ERREUR: URL API non trouvee" -ForegroundColor Red; exit 1 }
Write-Host "     API URL: $apiUrl" -ForegroundColor Green

(Get-Content $API_JS) -replace "const TUNNEL_URL = .*?;", "const TUNNEL_URL = '$apiUrl';" | Set-Content $API_JS
Write-Host "     api.js mis a jour" -ForegroundColor Green

# [3/4] Tunnel Metro Expo (port 80)
Write-Host "[3/4] Tunnel Metro Expo (port $EXPO_PORT)..." -ForegroundColor Yellow
$tmpMetro = "$env:TEMP\cf_metro_$PID.txt"
Remove-Item $tmpMetro -ErrorAction SilentlyContinue
Start-Process powershell -ArgumentList "-NoExit -Command `"cloudflared tunnel --url http://localhost:$EXPO_PORT 2>&1 | Tee-Object -FilePath '$tmpMetro'`""

Write-Host "     Attente de l'URL Metro..."
$metroHost = $null
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 2
    if (Test-Path $tmpMetro) {
        $content = Get-Content $tmpMetro -Raw -ErrorAction SilentlyContinue
        if ($content -match "https://([a-z0-9\-]+\.trycloudflare\.com)") {
            $metroHost = $matches[1]; break
        }
    }
}
if (-not $metroHost) { Write-Host "ERREUR: URL Metro non trouvee" -ForegroundColor Red; exit 1 }
Write-Host "     Metro URL: https://$metroHost" -ForegroundColor Green

# [4/4] Expo sur port 80 avec hostname Cloudflare
Write-Host "[4/4] Demarrage Expo (port $EXPO_PORT)..." -ForegroundColor Yellow
Write-Host "`n>>> Scanne le QR code avec Expo Go <<<" -ForegroundColor Cyan
Write-Host "    QR pointe vers : exp://$metroHost`n" -ForegroundColor DarkGray

$env:REACT_NATIVE_PACKAGER_HOSTNAME = $metroHost
Set-Location $MOBILE
.\node_modules\.bin\expo start --port $EXPO_PORT --lan --clear
