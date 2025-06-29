@echo off
echo 🛑 Parando Baileys e MongoDB...

REM Parar containers
echo 📊 Parando containers...
docker stop baileys-api baileys-mongodb

REM Remover containers
echo 🗑️ Removendo containers...
docker rm baileys-api baileys-mongodb

REM Remover network
echo 🌐 Removendo rede...
docker network rm baileys-network

echo ✅ Baileys parado com sucesso!
echo.
echo 💡 Para iniciar novamente, execute: start-baileys.cmd
echo 🗂️ Os dados ficaram salvos nos volumes Docker

pause