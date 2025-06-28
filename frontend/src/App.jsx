import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  PhoneIcon, 
  ChatBubbleLeftRightIcon, 
  UserGroupIcon, 
  BellIcon,
  DocumentTextIcon,
  ArrowRightIcon,
  CheckIcon
} from '@heroicons/react/24/outline'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

function Home() {
  const features = [
    {
      title: 'Multi-Sessões',
      description: 'Múltiplas conexões WhatsApp simultâneas com autenticação QR Code',
      icon: PhoneIcon
    },
    {
      title: 'Mensagens Inteligentes',
      description: 'Envio com comportamento humano e prevenção de banimentos',
      icon: ChatBubbleLeftRightIcon
    },
    {
      title: 'Grupos',
      description: 'Criação, gerenciamento de membros e configurações avançadas',
      icon: UserGroupIcon
    },
    {
      title: 'Webhooks',
      description: 'Sistema de eventos em tempo real com mídia em Base64',
      icon: BellIcon
    }
  ]

  const stats = [
    { value: '50+', label: 'Endpoints' },
    { value: '∞', label: 'Sessões' },
    { value: '3', label: 'Webhooks/Sessão' },
    { value: '99.9%', label: 'Uptime' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm bg-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <PhoneIcon className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold">FlowChat</span>
            </div>
            
            <nav className="hidden md:flex items-center space-x-8">
              <a href="/api-docs" target="_blank" className="text-gray-300 hover:text-white transition-colors">
                Documentação
              </a>
              <Link to="/login" className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors">
                Login
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1 
            className="text-4xl md:text-6xl font-bold mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            FlowChat API
            <br />
            <span className="text-blue-400">Fluxo Inteligente</span>
          </motion.h1>
          
          <motion.p 
            className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Solução completa para automação WhatsApp com fluxo contínuo de mensagens, 
            multi-sessões e sistema de webhooks inteligente.
          </motion.p>

          <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <a 
              href="/api-docs" 
              target="_blank"
              className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-lg font-medium transition-colors inline-flex items-center justify-center"
            >
              Ver Documentação
              <ArrowRightIcon className="w-4 h-4 ml-2" />
            </a>
            <Link 
              to="/login"
              className="border border-gray-600 hover:border-gray-500 px-8 py-3 rounded-lg font-medium transition-colors"
            >
              Começar Agora
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div 
            className="grid grid-cols-2 md:grid-cols-4 gap-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl font-bold text-blue-400 mb-1">{stat.value}</div>
                <div className="text-gray-400 text-sm">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Recursos Principais</h2>
            <p className="text-gray-300 max-w-2xl mx-auto">
              Funcionalidades essenciais do FlowChat para fluxo inteligente de mensagens
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={index}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 * index }}
                >
                  <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm">{feature.description}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Quick Start */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Início Rápido</h2>
            <p className="text-gray-300">Configure sua primeira sessão em minutos</p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-8">
            <div className="grid md:grid-cols-3 gap-8 mb-8">
              {[
                { step: '1', title: 'Criar Sessão', desc: 'Inicie uma nova sessão WhatsApp' },
                { step: '2', title: 'Escanear QR', desc: 'Autentique com seu dispositivo' },
                { step: '3', title: 'Enviar Mensagens', desc: 'Comece a usar a API' }
              ].map((item, index) => (
                <div key={index} className="text-center">
                  <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold mx-auto mb-4">
                    {item.step}
                  </div>
                  <h4 className="font-semibold mb-2">{item.title}</h4>
                  <p className="text-gray-400 text-sm">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-2">Exemplo de uso:</div>
              <pre className="text-green-400 text-sm overflow-x-auto">
{`curl -X POST http://localhost:3000/api/baileys/session/create \\
  -H "Content-Type: application/json" \\
  -d '{"sessionId": "minha-sessao"}'`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-600/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Pronto para começar?</h2>
          <p className="text-gray-300 mb-8">
            Acesse a documentação completa ou faça login para gerenciar suas sessões
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="/api-docs" 
              target="_blank"
              className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-lg font-medium transition-colors inline-flex items-center justify-center"
            >
              <DocumentTextIcon className="w-5 h-5 mr-2" />
              Ver API Docs
            </a>
            <Link 
              to="/login"
              className="border border-gray-600 hover:border-gray-500 px-8 py-3 rounded-lg font-medium transition-colors"
            >
              Acessar Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
                <PhoneIcon className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold">FlowChat</span>
            </div>
            
            <div className="flex items-center space-x-6 text-sm text-gray-400">
              <a href="/api-docs" target="_blank" className="hover:text-white transition-colors">
                Documentação
              </a>
              <a href="https://github.com/" target="_blank" className="hover:text-white transition-colors">
                GitHub
              </a>
            </div>
          </div>
          
          <div className="border-t border-white/10 mt-8 pt-8 text-center text-gray-400 text-sm">
            FlowChat - Fluxo inteligente de mensagens WhatsApp para automação profissional
          </div>
        </div>
      </footer>

      {/* Floating Docs Button */}
      <motion.div
        className="fixed bottom-8 right-8"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1, duration: 0.3 }}
      >
        <a
          href="/api-docs"
          target="_blank"
          className="w-14 h-14 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center text-white shadow-lg transition-colors"
        >
          <DocumentTextIcon className="w-6 h-6" />
        </a>
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