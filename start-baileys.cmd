@echo off
echo 🚀 Iniciando Baileys com MongoDB...

REM Cleanup containers existentes
echo 🧹 Limpando containers antigos...
docker stop baileys-api baileys-mongodb >nul 2>&1
docker rm baileys-api baileys-mongodb >nul 2>&1
docker network rm baileys-network >nul 2>&1

REM Criar network
echo 🌐 Criando rede Docker...
docker network create baileys-network

REM Iniciar MongoDB
echo 📊 Iniciando MongoDB...
docker run -d ^
  --name baileys-mongodb ^
  --network baileys-network ^
  -e MONGO_INITDB_ROOT_USERNAME=mongouser ^
  -e MONGO_INITDB_ROOT_PASSWORD=mongopassword ^
  -e MONGO_INITDB_DATABASE=baileys ^
  -v baileys_mongodb_data:/data/db ^
  mongo:7-jammy

REM Aguardar MongoDB inicializar
echo ⏳ Aguardando MongoDB inicializar (30 segundos)...
timeout /t 30 /nobreak >nul

REM Verificar se MongoDB está rodando
docker ps | findstr baileys-mongodb >nul
if %errorlevel% neq 0 (
    echo ❌ Erro: MongoDB não iniciou corretamente
    pause
    exit /b 1
)

REM Iniciar Baileys
echo 🚀 Iniciando Baileys API...
docker run -d ^
  --name baileys-api ^
  --network baileys-network ^
  -p 3000:3000 ^
  -e NODE_ENV=production ^
  -e PORT=3000 ^
  -e TZ=America/Sao_Paulo ^
  -e MONGODB_URI=mongodb://mongouser:mongopassword@baileys-mongodb:27017/baileys?authSource=admin ^
  -e DB_NAME=baileys ^
  -e SESSION_SECRET=baileys-session-secret-change-in-production ^
  -e COOKIE_SECRET=baileys-cookie-secret-change-in-production ^
  -e CORS_ORIGIN=http://localhost:3000 ^
  -e OPENAI_API_KEY=%OPENAI_API_KEY% ^
  -v baileys_sessions:/app/.sessions ^
  -v baileys_media:/app/.media ^
  -v baileys_uploads:/app/uploads ^
  -v baileys_downloads:/app/downloads ^
  -v baileys_auth:/app/auth_sessions ^
  -v baileys_logs:/app/logs ^
  vinicius666/baileys-api

REM Verificar se Baileys está rodando
timeout /t 10 /nobreak >nul
docker ps | findstr baileys-api >nul
if %errorlevel% neq 0 (
    echo ❌ Erro: Baileys API não iniciou corretamente
    echo 📋 Logs do container:
    docker logs baileys-api
    pause
    exit /b 1
)

echo ✅ Baileys iniciado com sucesso!
echo 🌐 Acesse: http://localhost:3000
echo 📊 MongoDB: baileys-mongodb container
echo 🔧 Para parar: docker stop baileys-api baileys-mongodb

REM Mostrar status
echo.
echo 📊 Status dos containers:
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo.
echo 📋 Para ver logs em tempo real:
echo docker logs -f baileys-api

pause