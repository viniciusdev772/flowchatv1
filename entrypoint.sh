#!/bin/bash
set -e

echo "🚀 Iniciando Baileys All-in-One..."

# Função para iniciar MongoDB
start_mongodb() {
    echo "🔄 Iniciando MongoDB..."
    
    # Criar diretórios necessários
    mkdir -p /data/db /var/log/mongodb
    chmod 755 /data/db /var/log/mongodb
    
    # Iniciar MongoDB em background
    echo "📂 Iniciando mongod..."
    mongod --dbpath /data/db \
           --logpath /var/log/mongodb/mongod.log \
           --bind_ip_all \
           --fork \
           --auth \
           --quiet
    
    # Aguardar MongoDB inicializar (sem auth primeiro)
    echo "⏳ Aguardando MongoDB inicializar..."
    sleep 5
    
    # Verificar se processo está rodando
    if ! pgrep mongod >/dev/null; then
        echo "❌ Processo mongod não está rodando!"
        echo "📋 Log do MongoDB:"
        cat /var/log/mongodb/mongod.log
        exit 1
    fi
    
    # Tentar conectar sem auth primeiro
    for i in {1..30}; do
        if mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
            echo "✅ MongoDB conectou sem auth!"
            break
        fi
        echo "   Tentativa $i/30..."
        sleep 2
    done
    
    # Criar usuário admin
    echo "👤 Criando usuário mongouser..."
    mongosh admin --eval "
    try {
        db.createUser({
            user: 'mongouser',
            pwd: 'mongopassword',
            roles: [{role: 'root', db: 'admin'}]
        });
        print('✅ Usuário mongouser criado com sucesso');
    } catch(e) {
        if (e.code === 11000) {
            print('ℹ️ Usuário mongouser já existe');
        } else {
            print('❌ Erro ao criar usuário:', e.message);
            throw e;
        }
    }
    " || {
        echo "❌ Falha ao criar usuário"
        exit 1
    }
    
    # Testar conexão com auth
    echo "🔐 Testando conexão com autenticação..."
    if mongosh "mongodb://mongouser:mongopassword@localhost:27017/admin" --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        echo "✅ MongoDB com auth funcionando!"
    else
        echo "❌ MongoDB auth falhou!"
        exit 1
    fi
}

# MongoDB é obrigatório - deve sempre funcionar
if ! command -v mongod >/dev/null 2>&1; then
    echo "❌ MongoDB não encontrado no container!"
    exit 1
fi

# Iniciar MongoDB (obrigatório)
start_mongodb

# Verificar se MongoDB está realmente funcionando
if ! mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
    echo "❌ MongoDB falhou ao iniciar!"
    exit 1
fi

# Configurar URI para localhost (mesmo container)
export MONGODB_URI="mongodb://mongouser:mongopassword@localhost:27017/baileys?authSource=admin"

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