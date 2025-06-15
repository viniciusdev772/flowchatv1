import { motion } from 'framer-motion'
import { useState } from 'react'
import { 
  PhoneIcon, 
  ChatBubbleLeftRightIcon, 
  UserGroupIcon, 
  BellIcon,
  CogIcon,
  PlayIcon,
  DocumentTextIcon,
  LinkIcon
} from '@heroicons/react/24/outline'

function App() {
  const [activeFeature, setActiveFeature] = useState(null)

  const features = [
    {
      id: 'sessions',
      title: 'Multi-Sessões',
      description: 'Gerencie múltiplas conexões WhatsApp simultaneamente',
      icon: PhoneIcon,
      endpoints: [
        'POST /api/baileys/session/create',
        'GET /api/baileys/session/:id/qr',
        'GET /api/baileys/session/:id/status',
        'DELETE /api/baileys/session/:id'
      ]
    },
    {
      id: 'messages',
      title: 'Mensagens Inteligentes',
      description: 'Envio com comportamento humano e prevenção de banimentos',
      icon: ChatBubbleLeftRightIcon,
      endpoints: [
        'POST /api/baileys/session/:id/send-message',
        'POST /api/baileys/session/:id/send-media',
        'POST /api/baileys/session/:id/reply',
        'POST /api/baileys/session/:id/send-bulk'
      ]
    },
    {
      id: 'groups',
      title: 'Gerenciamento de Grupos',
      description: 'Controle completo de grupos: criar, gerenciar membros e permissões',
      icon: UserGroupIcon,
      endpoints: [
        'POST /api/baileys/groups/:id/create',
        'POST /api/baileys/groups/:id/:groupId/add-participants',
        'POST /api/baileys/groups/:id/:groupId/promote',
        'GET /api/baileys/groups/:id/list'
      ]
    },
    {
      id: 'webhooks',
      title: 'Sistema de Webhooks',
      description: 'Até 3 webhooks por sessão com eventos em tempo real',
      icon: BellIcon,
      endpoints: [
        'GET /api/baileys/session/:id/webhooks',
        'POST /api/baileys/session/:id/webhooks',
        'PUT /api/baileys/session/:id/webhooks/:webhookId',
        'DELETE /api/baileys/session/:id/webhooks/:webhookId'
      ]
    }
  ]

  const stats = [
    { label: 'API Endpoints', value: '50+' },
    { label: 'Sessões Simultâneas', value: 'Ilimitadas' },
    { label: 'Webhooks por Sessão', value: '3' },
    { label: 'Taxa de Prevenção', value: '99.9%' }
  ]

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      {/* Background floating elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className={`absolute rounded-full bg-white/5 floating-element`}
            style={{
              width: `${Math.random() * 200 + 100}px`,
              height: `${Math.random() * 200 + 100}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.5}s`
            }}
          />
        ))}
      </div>

      {/* Header */}
      <motion.header 
        className="glass-morphism mx-4 mt-4 mb-8"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-400 to-purple-600 flex items-center justify-center">
                <PhoneIcon className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold">Baileys Multi-Session API</h1>
            </div>
            <div className="flex space-x-4">
              <motion.button 
                className="liquid-button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <DocumentTextIcon className="w-5 h-5 inline mr-2" />
                Documentação
              </motion.button>
              <motion.button 
                className="liquid-button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <PlayIcon className="w-5 h-5 inline mr-2" />
                Testar API
              </motion.button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <motion.section 
        className="container mx-auto px-6 py-16 text-center"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        <h2 className="text-6xl font-bold mb-6 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
          WhatsApp API
          <br />
          <span className="text-4xl">Avançada & Segura</span>
        </h2>
        <p className="text-xl text-white/80 mb-12 max-w-2xl mx-auto">
          API completa do WhatsApp com Baileys, comportamento humano simulado, 
          multi-sessões e sistema de webhooks para prevenção de banimentos.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              className="glass-card text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * index }}
            >
              <div className="text-3xl font-bold text-blue-300 mb-2">{stat.value}</div>
              <div className="text-white/70">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Features Grid */}
      <motion.section 
        className="container mx-auto px-6 py-16"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.4 }}
      >
        <h3 className="text-4xl font-bold text-center mb-16">Funcionalidades Principais</h3>
        
        <div className="grid md:grid-cols-2 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={feature.id}
                className={`glass-card cursor-pointer transition-all duration-300 ${
                  activeFeature === feature.id ? 'ring-2 ring-blue-400' : ''
                }`}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.1 * index }}
                whileHover={{ scale: 1.02 }}
                onClick={() => setActiveFeature(activeFeature === feature.id ? null : feature.id)}
              >
                <div className="flex items-start mb-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center mr-4">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-semibold mb-2">{feature.title}</h4>
                    <p className="text-white/70">{feature.description}</p>
                  </div>
                </div>

                {/* Expandable endpoints */}
                <motion.div
                  initial={false}
                  animate={{ height: activeFeature === feature.id ? 'auto' : 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 pt-4 border-t border-white/20">
                    <h5 className="text-sm font-medium text-blue-300 mb-3">Endpoints principais:</h5>
                    <div className="space-y-2">
                      {feature.endpoints.map((endpoint, i) => (
                        <div key={i} className="glass-shimmer rounded-lg bg-black/20 p-3">
                          <code className="text-sm text-green-300">{endpoint}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )
          })}
        </div>
      </motion.section>

      {/* Quick Start */}
      <motion.section 
        className="container mx-auto px-6 py-16"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.6 }}
      >
        <div className="glass-card max-w-4xl mx-auto">
          <h3 className="text-3xl font-bold mb-8 text-center">Início Rápido</h3>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h4 className="text-lg font-semibold mb-2">Instalar</h4>
              <p className="text-white/70 text-sm">Clone o repositório e instale as dependências</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h4 className="text-lg font-semibold mb-2">Configurar</h4>
              <p className="text-white/70 text-sm">Inicie o servidor e crie sua primeira sessão</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-400 to-pink-500 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h4 className="text-lg font-semibold mb-2">Usar</h4>
              <p className="text-white/70 text-sm">Escaneie o QR Code e comece a usar a API</p>
            </div>
          </div>

          <div className="mt-12 p-6 bg-black/20 rounded-lg">
            <h5 className="text-lg font-semibold mb-4 flex items-center">
              <CogIcon className="w-5 h-5 mr-2" />
              Exemplo de uso:
            </h5>
            <pre className="text-green-300 text-sm overflow-x-auto">
{`curl -X POST http://localhost:3000/api/baileys/session/create \\
  -H "Content-Type: application/json" \\
  -d '{"sessionId": "minha-sessao"}'

curl -X POST http://localhost:3000/api/baileys/session/minha-sessao/send-message \\
  -H "Content-Type: application/json" \\
  -d '{"number": "5511999999999", "message": "Olá! Mensagem enviada via API"}'`}
            </pre>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <motion.footer 
        className="glass-morphism mx-4 mb-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.8 }}
      >
        <div className="container mx-auto px-6 py-8 text-center">
          <div className="flex items-center justify-center space-x-6">
            <motion.button 
              className="liquid-button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <LinkIcon className="w-5 h-5 inline mr-2" />
              GitHub
            </motion.button>
            <motion.button 
              className="liquid-button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <DocumentTextIcon className="w-5 h-5 inline mr-2" />
              Swagger Docs
            </motion.button>
          </div>
          <p className="text-white/60 mt-6">
            Baileys Multi-Session API - Desenvolvido com ❤️ para automação WhatsApp segura
          </p>
        </div>
      </motion.footer>
    </div>
  )
}

export default App