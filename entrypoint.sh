#!/bin/bash
set -e

echo "🚀 Iniciando Baileys All-in-One..."

# Função para iniciar MongoDB
start_mongodb() {
    echo "🔄 Iniciando MongoDB..."
    
    # Criar diretórios necessários
    mkdir -p /data/db /var/log/mongodb
    
    # Iniciar MongoDB em background
    mongod --dbpath /data/db \
           --logpath /var/log/mongodb/mongod.log \
           --bind_ip_all \
           --fork \
           --quiet
    
    # Aguardar MongoDB inicializar
    echo "⏳ Aguardando MongoDB..."
    for i in {1..30}; do
        if mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
            echo "✅ MongoDB pronto!"
            break
        fi
        sleep 1
    done
    
    # Criar usuário admin se não existir
    echo "👤 Configurando usuário MongoDB..."
    mongosh --eval "
    try {
        db.getSiblingDB('admin').createUser({
            user: 'mongouser',
            pwd: 'mongopassword',
            roles: [{role: 'root', db: 'admin'}]
        });
        print('✅ Usuário mongouser criado');
    } catch(e) {
        if (e.code !== 11000) {
            print('❌ Erro ao criar usuário:', e.message);
        } else {
            print('ℹ️ Usuário mongouser já existe');
        }
    }
    " >/dev/null 2>&1
}

# Verificar se MongoDB está disponível
if ! command -v mongod >/dev/null 2>&1; then
    echo "⚠️  MongoDB não encontrado, usando memory store"
    export MONGODB_URI=""
else
    # Iniciar MongoDB
    start_mongodb
    
    # Configurar URI para localhost (mesmo container)
    export MONGODB_URI="mongodb://mongouser:mongopassword@localhost:27017/baileys?authSource=admin"
fi

# Configurar variáveis de ambiente padrão
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-3000}
export TZ=${TZ:-America/Sao_Paulo}
export DB_NAME=${DB_NAME:-baileys}
export SESSION_SECRET=${SESSION_SECRET:-baileys-default-session-secret-change-in-production}
export COOKIE_SECRET=${COOKIE_SECRET:-baileys-default-cookie-secret-change-in-production}
export CORS_ORIGIN=${CORS_ORIGIN:-http://localhost:3000}

echo "🎯 Configuração:"
echo "   MongoDB: ${MONGODB_URI:-Memory Store}"
echo "   Port: $PORT"

# Executar comando original (npm start)
exec "$@"