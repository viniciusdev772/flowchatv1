#!/usr/bin/env node

/**
 * Baileys Multi-Session WhatsApp API
 * Entry point - starts the Express application
 */

const { app } = require('./src/app');

const PORT = process.env.PORT || 3000;

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Baileys API rodando na porta ${PORT}`);
  console.log(`📱 Acesse http://localhost:${PORT}/api-docs para ver a documentação`);
  console.log(`📊 Acesse http://localhost:${PORT}/api/info para informações da API`);
});