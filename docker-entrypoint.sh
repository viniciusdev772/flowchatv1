#!/bin/bash
set -e

echo "🚀 Iniciando Baileys com MongoDB integrado..."

# Função para verificar se o MongoDB está rodando
wait_for_mongodb() {
    echo "⏳ Aguardando MongoDB inicializar..."
    while ! docker-compose -f docker-compose.yaml exec -T mongodb mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; do
        sleep 2
    done
    echo "✅ MongoDB pronto!"
}

# Se não há containers rodando, inicia o stack completo
if ! docker-compose -f docker-compose.yaml ps | grep -q "Up"; then
    echo "🔄 Iniciando stack completo (MongoDB + Baileys)..."
    docker-compose -f docker-compose.yaml up -d mongodb
    wait_for_mongodb
    docker-compose -f docker-compose.yaml up -d baileys-api
else
    echo "✅ Stack já está rodando"
fi

# Executa o comando original
exec "$@"