#!/bin/bash
set -e

echo "🚀 Iniciando Baileys API..."

# Configurar frontend com URLs corretas
if [ -n "$FRONTEND_URL" ]; then
    echo "🔧 Configurando frontend para: $FRONTEND_URL"
    
    # Atualizar config.js
    cat > /app/frontend/dist/config.js << EOF
// Configuração runtime gerada automaticamente
window.APP_CONFIG = {
  API_URL: '$FRONTEND_URL'
};
EOF
    
    # Substituir URLs hard-coded em arquivos JS (fallback)
    echo "🔄 Aplicando patches de URL nos arquivos frontend..."
    find /app/frontend/dist -name "*.js" -type f -exec sed -i "s|http://localhost:3000|$FRONTEND_URL|g" {} \;
    find /app/frontend/dist -name "*.js" -type f -exec sed -i "s|https://localhost:3000|$FRONTEND_URL|g" {} \;
    
    echo "✅ Frontend configurado com sucesso"
else
    echo "⚠️  FRONTEND_URL não definida, usando configuração padrão"
fi

echo "🎯 Configuração completa, iniciando aplicação..."

# Executar comando original
exec "$@"