#!/bin/bash
set -e

echo "🚀 Iniciando Baileys All-in-One..."

# Criar diretórios necessários
mkdir -p /data/db /var/log/mongodb

# Configurar MongoDB
echo "🔄 Iniciando MongoDB..."
mongod --dbpath /data/db --logpath /var/log/mongodb/mongodb.log --fork --bind_ip_all

# Aguardar MongoDB inicializar
echo "⏳ Aguardando MongoDB..."
sleep 5

# Criar usuário admin se não existir
echo "👤 Configurando usuário MongoDB..."
mongosh --eval "
try {
  db.getSiblingDB('admin').createUser({
    user: 'admin',
    pwd: 'password123',
    roles: [{role: 'root', db: 'admin'}]
  });
  print('✅ Usuário admin criado');
} catch(e) {
  print('ℹ️ Usuário admin já existe');
}
"

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