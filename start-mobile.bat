@echo off
echo ========================================
echo    SGS Mobile - Demarrage complet
echo ========================================

echo.
echo [1/3] Demarrage du Gateway...
start "SGS Gateway" cmd /k "cd /d c:\Users\nherz\OneDrive\Desktop\Projet Gestion-Stock && node gateway.js"
timeout /t 2 /nobreak >nul

echo [2/3] Demarrage du tunnel backend...
start "SGS Backend Tunnel" cmd /k "cloudflared tunnel --url http://localhost:9000"
timeout /t 5 /nobreak >nul

echo [3/3] Demarrage du tunnel Metro + Expo...
start "SGS Metro Tunnel" cmd /k "cloudflared tunnel --url http://localhost:8081"
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo  IMPORTANT : Copiez l'URL Metro tunnel
echo  (https://xxxx.trycloudflare.com)
echo  depuis la fenetre "SGS Metro Tunnel"
echo  et lancez dans un nouveau terminal :
echo.
echo  cd mobile
echo  set REACT_NATIVE_PACKAGER_HOSTNAME=xxxx.trycloudflare.com ^&^& npx expo start
echo ========================================
echo.
pause
