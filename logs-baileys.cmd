@echo off
echo 📋 Logs do Baileys API

echo Escolha uma opção:
echo 1. Ver logs em tempo real
echo 2. Ver últimas 50 linhas
echo 3. Ver logs do MongoDB
echo 4. Status dos containers

set /p choice="Digite sua escolha (1-4): "

if "%choice%"=="1" (
    echo 📋 Logs em tempo real do Baileys (Ctrl+C para sair):
    docker logs -f baileys-api
) else if "%choice%"=="2" (
    echo 📋 Últimas 50 linhas do Baileys:
    docker logs --tail 50 baileys-api
    pause
) else if "%choice%"=="3" (
    echo 📋 Logs do MongoDB:
    docker logs --tail 30 baileys-mongodb
    pause
) else if "%choice%"=="4" (
    echo 📊 Status dos containers:
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | findstr baileys
    echo.
    echo 💾 Volumes:
    docker volume ls | findstr baileys
    pause
) else (
    echo ❌ Opção inválida
    pause
)