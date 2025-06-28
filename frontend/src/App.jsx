import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
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
  LinkIcon,
  BookOpenIcon,
  RocketLaunchIcon,
  BoltIcon
} from '@heroicons/react/24/outline'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

function Home() {
  const [activeFeature, setActiveFeature] = useState(null)
  const [performanceMode, setPerformanceMode] = useState(() => {
    // Detectar dispositivos menos potentes
    const isLowEnd = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2
    const isSlowConnection = navigator.connection && navigator.connection.effectiveType === 'slow-2g'
    return isLowEnd || isSlowConnection
  })

  const features = [
    {
      id: 'sessions',
      title: 'Multi-Sessões',
      description: 'Gerencie múltiplas conexões WhatsApp simultaneamente com QR Code',
      icon: PhoneIcon,
      color: 'from-blue-500 to-cyan-500',
      endpoints: [
        'POST /api/baileys/session/create',
        'POST /api/baileys/session/{sessionId}/regenerate-qr',
        'GET /api/baileys/session/{sessionId}/status',
        'GET /api/baileys/sessions',
        'DELETE /api/baileys/session/{sessionId}'
      ]
    },
    {
      id: 'messages',
      title: 'Mensagens Inteligentes',
      description: 'Envio com comportamento humano simulado e prevenção de banimentos',
      icon: ChatBubbleLeftRightIcon,
      color: 'from-green-500 to-emerald-500',
      endpoints: [
        'POST /api/baileys/session/{sessionId}/send-message',
        'POST /api/baileys/session/{sessionId}/send-media',
        'POST /api/baileys/session/{sessionId}/reply-message',
        'POST /api/baileys/session/{sessionId}/smart-reply',
        'POST /api/baileys/session/{sessionId}/typing',
        'POST /api/baileys/session/{sessionId}/mark-read'
      ]
    },
    {
      id: 'groups',
      title: 'Gerenciamento de Grupos',
      description: 'Controle completo: criar, gerenciar membros, permissões e convites',
      icon: UserGroupIcon,
      color: 'from-purple-500 to-pink-500',
      endpoints: [
        'POST /api/baileys/groups/{sessionId}/create',
        'GET /api/baileys/groups/{sessionId}/{groupId}/info',
        'POST /api/baileys/groups/{sessionId}/{groupId}/add-participants',
        'POST /api/baileys/groups/{sessionId}/{groupId}/remove-participants',
        'POST /api/baileys/groups/{sessionId}/{groupId}/promote',
        'POST /api/baileys/groups/{sessionId}/{groupId}/demote',
        'PUT /api/baileys/groups/{sessionId}/{groupId}/subject',
        'PUT /api/baileys/groups/{sessionId}/{groupId}/description',
        'PUT /api/baileys/groups/{sessionId}/{groupId}/settings',
        'POST /api/baileys/groups/{sessionId}/{groupId}/leave',
        'GET /api/baileys/groups/{sessionId}/list',
        'GET /api/baileys/groups/{sessionId}/{groupId}/invite-code',
        'POST /api/baileys/groups/{sessionId}/{groupId}/revoke-invite'
      ]
    },
    {
      id: 'webhooks',
      title: 'Sistema de Webhooks Avançado',
      description: 'Até 3 webhooks por sessão com eventos em tempo real e mídia em Base64',
      icon: BellIcon,
      color: 'from-orange-500 to-red-500',
      endpoints: [
        'GET /api/baileys/session/{sessionId}/webhooks',
        'POST /api/baileys/session/{sessionId}/webhooks',
        'GET /api/baileys/session/{sessionId}/webhooks/{webhookId}',
        'PUT /api/baileys/session/{sessionId}/webhooks/{webhookId}',
        'DELETE /api/baileys/session/{sessionId}/webhooks/{webhookId}',
        'PATCH /api/baileys/session/{sessionId}/webhooks/{webhookId}/toggle',
        'POST /api/baileys/session/{sessionId}/webhooks/{webhookId}/test',
        'POST /api/baileys/session/{sessionId}/webhook',
        'GET /api/baileys/session/{sessionId}/webhook',
        'DELETE /api/baileys/session/{sessionId}/webhook'
      ]
    },
    {
      id: 'media',
      title: 'Histórico e Mídia',
      description: 'Gerenciamento de mensagens armazenadas e download de arquivos',
      icon: DocumentTextIcon,
      color: 'from-indigo-500 to-blue-500',
      endpoints: [
        'GET /api/baileys/session/{sessionId}/messages',
        'POST /api/baileys/session/{sessionId}/download-media'
      ]
    },
    {
      id: 'info',
      title: 'Informações da API',
      description: 'Documentação completa e informações do sistema',
      icon: CogIcon,
      color: 'from-gray-500 to-slate-600',
      endpoints: [
        'GET /api/baileys/info',
        'GET /'
      ]
    }
  ]

  const stats = [
    { label: 'API Endpoints', value: '50+', color: 'text-blue-300' },
    { label: 'Sessões Simultâneas', value: 'Ilimitadas', color: 'text-green-300' },
    { label: 'Webhooks por Sessão', value: '3', color: 'text-purple-300' },
    { label: 'Taxa de Prevenção', value: '99.9%', color: 'text-cyan-300' }
  ]

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      {/* Enhanced Background floating elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Liquid orbs - reduzidos em modo performance */}
        {[...Array(performanceMode ? 4 : 8)].map((_, i) => {
          const colors = [
            'bg-gradient-to-r from-blue-500/20 to-cyan-500/20',
            'bg-gradient-to-r from-purple-500/20 to-pink-500/20',
            'bg-gradient-to-r from-green-500/20 to-emerald-500/20',
            'bg-gradient-to-r from-orange-500/20 to-red-500/20'
          ];
          return (
            <div
              key={i}
              className={`absolute rounded-full floating-element ${colors[i % colors.length]}`}
              style={{
                width: `${Math.random() * 300 + 150}px`,
                height: `${Math.random() * 300 + 150}px`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.7}s`,
                filter: performanceMode ? 'none' : 'blur(1px)'
              }}
            />
          );
        })}
        
        {/* Mesh gradient overlay - desabilitado em modo performance */}
        {!performanceMode && <div className="absolute inset-0 mesh-gradient opacity-30" />}
      </div>

      {/* Header */}
      <motion.header 
        className={`${performanceMode ? 'glass-ultra' : 'glass-morphism'} mx-4 mt-4 mb-8`}
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
              <h1 className="text-2xl font-bold">FlowChat API</h1>
            </div>
            <div className="flex space-x-4">
              <motion.a 
                href="/api-docs" 
                target="_blank"
                className="liquid-button inline-flex items-center"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <DocumentTextIcon className="w-5 h-5 mr-2" />
                Documentação
              </motion.a>
              <motion.a 
                href="/api-docs" 
                target="_blank"
                className="liquid-button inline-flex items-center"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <PlayIcon className="w-5 h-5 mr-2" />
                Testar API
              </motion.a>
              <Link to="/login">
                <motion.button 
                  className="liquid-button inline-flex items-center"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Login
                </motion.button>
              </Link>
              <motion.button 
                onClick={() => setPerformanceMode(!performanceMode)}
                className={`liquid-button inline-flex items-center ${performanceMode ? 'bg-green-500/20' : 'bg-orange-500/20'}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title={performanceMode ? 'Modo Performance Ativo' : 'Ativar Modo Performance'}
              >
                <BoltIcon className="w-5 h-5 mr-2" />
                {performanceMode ? 'Performance' : 'Efeitos'}
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
        <h2 className={`text-6xl font-bold mb-6 ${performanceMode ? 'text-white' : 'liquid-text-gradient glass-text-glow'}`}>
          FlowChat API
          <br />
          <span className="text-4xl">Fluxo Inteligente de Mensagens</span>
        </h2>
        <p className="text-xl text-white/80 mb-12 max-w-2xl mx-auto">
          API avançada de WhatsApp com fluxo contínuo de mensagens, comportamento humano simulado, 
          multi-sessões e sistema de webhooks inteligente para automação segura.
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
              <div className={`text-3xl font-bold ${stat.color} mb-2`}>{stat.value}</div>
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
        <h3 className={`text-4xl font-bold text-center mb-16 ${performanceMode ? 'text-white' : 'liquid-text-gradient'}`}>Funcionalidades Principais</h3>
        
        <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6">
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
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${feature.color} flex items-center justify-center mr-4 shadow-lg`}>
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
                    <h5 className="text-sm font-medium text-blue-300 mb-3 flex items-center">
                      <div className="w-2 h-2 rounded-full bg-blue-400 mr-2 animate-pulse"></div>
                      Endpoints disponíveis ({feature.endpoints.length}):
                    </h5>
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                      {feature.endpoints.map((endpoint, i) => {
                        const [method, path] = endpoint.split(' ');
                        const methodColors = {
                          'GET': 'text-green-400 bg-green-500/10 border-green-500/30',
                          'POST': 'text-blue-400 bg-blue-500/10 border-blue-500/30',
                          'PUT': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
                          'DELETE': 'text-red-400 bg-red-500/10 border-red-500/30',
                          'PATCH': 'text-purple-400 bg-purple-500/10 border-purple-500/30'
                        };
                        return (
                          <motion.div 
                            key={i} 
                            className="endpoint-card flex items-center space-x-3"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: i * 0.05 }}
                          >
                            <span className={`px-2 py-1 rounded text-xs font-bold border ${methodColors[method] || 'text-gray-400 bg-gray-500/10 border-gray-500/30'}`}>
                              {method}
                            </span>
                            <code className="text-sm text-cyan-300 flex-1">{path}</code>
                          </motion.div>
                        );
                      })}
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

          <div className="mt-12 glass-ultra p-6 rounded-2xl">
            <h5 className="text-lg font-semibold mb-4 flex items-center liquid-text-gradient">
              <CogIcon className="w-5 h-5 mr-2" />
              Exemplo de uso rápido:
            </h5>
            <div className="space-y-4">
              <div className="glass-shimmer p-4 rounded-lg">
                <div className="text-xs text-blue-300 mb-2 font-medium">1. Criar sessão</div>
                <pre className="text-green-300 text-sm overflow-x-auto">
{`curl -X POST http://localhost:3000/api/baileys/session/create \\
  -H "Content-Type: application/json" \\
  -d '{"sessionId": "minha-sessao"}'`}
                </pre>
              </div>
              <div className="glass-shimmer p-4 rounded-lg">
                <div className="text-xs text-purple-300 mb-2 font-medium">2. Enviar mensagem</div>
                <pre className="text-green-300 text-sm overflow-x-auto">
{`curl -X POST http://localhost:3000/api/baileys/session/minha-sessao/send-message \\
  -H "Content-Type: application/json" \\
  -d '{"to": "5511999999999", "message": "Olá! API funcionando!"}'`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <motion.footer 
        className={`${performanceMode ? 'glass-ultra' : 'glass-morphism'} mx-4 mb-4`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.8 }}
      >
        <div className="container mx-auto px-6 py-8 text-center">
          <div className="flex items-center justify-center space-x-6">
            <motion.a 
              href="https://github.com/" 
              target="_blank"
              className="liquid-button inline-flex items-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <LinkIcon className="w-5 h-5 mr-2" />
              GitHub
            </motion.a>
            <motion.a 
              href="/api-docs" 
              target="_blank"
              className="liquid-button inline-flex items-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <DocumentTextIcon className="w-5 h-5 mr-2" />
              Swagger Docs
            </motion.a>
          </div>
          <p className="text-white/60 mt-6">
            FlowChat API - Desenvolvido com ❤️ para fluxo inteligente de mensagens WhatsApp
          </p>
        </div>
      </motion.footer>

      {/* Floating Action Button for API Docs */}
      <motion.div
        className="fixed bottom-8 right-8 z-50"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 0.5, delay: 1 }}
      >
        <motion.a
          href="/api-docs"
          target="_blank"
          className="glass-ultra w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg group"
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
        >
          <BookOpenIcon className="w-8 h-8 group-hover:scale-110 transition-transform" />
          <div className="absolute -top-12 right-0 bg-black/80 text-white px-3 py-1 rounded-lg text-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Abrir Documentação
          </div>
        </motion.a>
      </motion.div>

      {/* Quick API Test Button */}
      <motion.div
        className="fixed bottom-28 right-8 z-50"
        initial={{ scale: 0, rotate: 180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 0.5, delay: 1.2 }}
      >
        <motion.button
          onClick={() => window.open('/api-docs', '_blank')}
          className="glass-ultra w-14 h-14 rounded-full flex items-center justify-center text-cyan-300 shadow-lg group"
          whileHover={{ scale: 1.1, rotate: -5 }}
          whileTap={{ scale: 0.9 }}
        >
          <RocketLaunchIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
          <div className="absolute -top-12 right-0 bg-black/80 text-white px-3 py-1 rounded-lg text-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Testar API
          </div>
        </motion.button>
      </motion.div>
    </div>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  )
}

export default App