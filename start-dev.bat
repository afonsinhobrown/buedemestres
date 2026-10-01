@echo off
echo ========================================================
echo       A arrancar o ecosistema Bué de Mestres...
echo ========================================================
echo.

echo 1. A preparar App Web (Next.js) num novo terminal (Porta 3000)...
start "Bue de Mestres - Web (Next.js)" cmd /k "cd apps\web && npm run dev"

echo 2. A preparar App Cliente (Expo) num novo terminal (Porta 8081)...
start "Bue de Mestres - Cliente (Expo)" cmd /k "cd apps\cliente && npx expo start --port 8081"

echo 3. A preparar App Pro (Expo) num novo terminal (Porta 8082)...
start "Bue de Mestres - Pro (Expo)" cmd /k "cd apps\pro && npx expo start --port 8082"

echo.
echo ========================================================
echo Todos os servicos foram enviados para terminais separados!
echo Cada app Expo (Cliente e Pro) vai abrir um Metro Bundler proprio.
echo Cliente: Porta 8081 | Pro: Porta 8082
echo ========================================================
echo.
pause
