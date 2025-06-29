#!/bin/bash
set -e

echo "🚀 Iniciando Baileys All-in-One..."

# Função para verificar se MongoDB container existe
check_mongodb() {
    docker ps --format "table {{.Names}}" | grep -q "baileys-mongodb-${HOSTNAME}"
}

# Função para iniciar MongoDB via Docker
start_mongodb() {
    echo "🔄 Iniciando MongoDB container..."
    docker run -d \
        --name "baileys-mongodb-${HOSTNAME}" \
        --network container:$(hostname) \
        -e MONGO_INITDB_ROOT_USERNAME=admin \
        -e MONGO_INITDB_ROOT_PASSWORD=password123 \
        -e MONGO_INITDB_DATABASE=baileys \
        mongo:7-jammy \
        mongod --bind_ip_all
    
    echo "⏳ Aguardando MongoDB inicializar..."
    sleep 15
}

# Verificar se MongoDB já está rodando, senão iniciar
if ! check_mongodb; then
    start_mongodb
fi

# Configurar variáveis de ambiente
export NODE_ENV=production
export PORT=3000
export MONGODB_URI="mongodb://admin:password123@localhost:27017/baileys?authSource=admin"
export DB_NAME=baileys
export SESSION_SECRET="auto-generated-session-secret-$(date +%s)"
export COOKIE_SECRET="auto-generated-cookie-secret-$(date +%s)"
export CORS_ORIGIN="http://localhost:3000"

echo "🎯 Variáveis configuradas:"
echo "   MONGODB_URI: $MONGODB_URI"
echo "   DB_NAME: $DB_NAME"

# Iniciar aplicação Baileys
echo "🚀 Iniciando aplicação Baileys..."
npm start