import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  BellIcon,
  DocumentTextIcon,
  CogIcon,
  PlusIcon,
  QrCodeIcon,
  PlayIcon,
  PauseIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  SignalIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
  ChartBarIcon,
  CloudIcon,
  LinkIcon,
  PaperAirplaneIcon,
  PhotoIcon,
  UsersIcon,
  ClockIcon,
  ServerIcon,
  EyeIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';

export default function Dashboard() {
  // Estado principal
  const [activeTab, setActiveTab] = useState('overview');
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    activeSessions: 0,
    totalMessages: 0,
    totalGroups: 0,
    activeWebhooks: 0,
    uptime: '0h 0m'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  // Performance mode - detecta dispositivos menos potentes
  const [performanceMode, setPerformanceMode] = useState(() => {
    const isLowEnd = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
    const isSlowConnection = navigator.connection && 
      (navigator.connection.effectiveType === 'slow-2g' || navigator.connection.effectiveType === '2g');
    const isOldBrowser = !CSS.supports('backdrop-filter', 'blur(1px)');
    return isLowEnd || isSlowConnection || isOldBrowser;
  });

  // Modal states
  const [showNewSession, setShowNewSession] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);

  // Simular dados do usuário (normalmente viria do sessionStorage ou API)
  useEffect(() => {
    const userData = sessionStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      // Usuário de exemplo se não tiver dados
      setUser({
        name: 'Admin User',
        email: 'admin@whatsapp-api.com',
        role: 'Administrator'
      });
    }

    // Simular carregamento de dados
    setTimeout(() => {
      setSessions([
        {
          id: 'main-session',
          name: 'Sessão Principal',
          status: 'connected',
          lastSeen: '2 minutos atrás',
          messages: 245,
          groups: 12,
          webhooks: 2,
          qrCode: null,
          uptime: '2h 15m'
        },
        {
          id: 'support-session',
          name: 'Suporte Cliente',
          status: 'connecting',
          lastSeen: '15 minutos atrás',
          messages: 89,
          groups: 5,
          webhooks: 1,
          qrCode: 'data:image/png;base64,...',
          uptime: '45m'
        },
        {
          id: 'marketing-session',
          name: 'Marketing',
          status: 'disconnected',
          lastSeen: '1 hora atrás',
          messages: 156,
          groups: 8,
          webhooks: 0,
          qrCode: null,
          uptime: '0m'
        }
      ]);

      setStats({
        totalSessions: 3,
        activeSessions: 1,
        totalMessages: 490,
        totalGroups: 25,
        activeWebhooks: 3,
        uptime: '2h 15m'
      });

      setIsLoading(false);
    }, 1500);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected': return 'text-green-400 bg-green-500/10 border-green-500/30';
      case 'connecting': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'disconnected': return 'text-red-400 bg-red-500/10 border-red-500/30';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected': return <CheckCircleIcon className="w-4 h-4" />;
      case 'connecting': return <ClockIcon className="w-4 h-4 animate-spin" />;
      case 'disconnected': return <XCircleIcon className="w-4 h-4" />;
      default: return <ExclamationTriangleIcon className="w-4 h-4" />;
    }
  };

  const tabs = [
    { id: 'overview', name: 'Visão Geral', icon: ChartBarIcon },
    { id: 'sessions', name: 'Sessões', icon: PhoneIcon },
    { id: 'messages', name: 'Mensagens', icon: ChatBubbleLeftRightIcon },
    { id: 'groups', name: 'Grupos', icon: UserGroupIcon },
    { id: 'webhooks', name: 'Webhooks', icon: BellIcon },
    { id: 'media', name: 'Mídia', icon: PhotoIcon },
    { id: 'settings', name: 'Configurações', icon: CogIcon }
  ];

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    window.location.href = '/login';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <motion.div
          className="glass-card p-8 text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <ServerIcon className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Carregando Dashboard</h2>
          <p className="text-white/70">Conectando com suas sessões WhatsApp...</p>
          <div className="mt-4 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Floating Elements Background - reduzidos em modo performance */}
      {!performanceMode && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-gradient-to-r from-blue-500/8 to-purple-500/8"
              style={{
                width: `${Math.random() * 150 + 80}px`,
                height: `${Math.random() * 150 + 80}px`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -15, 0],
                x: [0, 8, 0],
                opacity: [0.2, 0.4, 0.2],
              }}
              transition={{
                duration: 10 + i * 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <motion.header
        className={`${performanceMode ? 'glass-performance' : 'glass-morphism'} mx-4 mt-4 mb-6`}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                <ChatBubbleLeftRightIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">WhatsApp API Dashboard</h1>
                <p className="text-white/70">Gerencie suas conexões e automações</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Performance Mode Toggle */}
              <motion.button
                onClick={() => setPerformanceMode(!performanceMode)}
                className={`px-3 py-2 rounded-lg text-xs transition-colors ${
                  performanceMode 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title={performanceMode ? 'Modo Performance Ativo' : 'Ativar Modo Performance'}
              >
                {performanceMode ? '🚀 Performance' : '✨ Efeitos'}
              </motion.button>

              {/* Status Indicator */}
              <div className={`${performanceMode ? 'glass-ultra' : 'glass-ultra'} px-4 py-2 rounded-xl`}>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm text-white/80">Sistema Online</span>
                </div>
              </div>

              {/* User Menu */}
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-sm font-medium text-white">{user?.name}</div>
                  <div className="text-xs text-white/70">{user?.role}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-white" />
                </div>
                <motion.button
                  onClick={handleLogout}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ArrowRightOnRectangleIcon className="w-5 h-5 text-white/70" />
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="flex">
        {/* Sidebar Navigation */}
        <motion.nav
          className={`w-64 ${performanceMode ? 'glass-performance' : 'glass-morphism'} mx-4 mb-4 p-4`}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-blue-500/30'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.name}</span>
                </motion.button>
              );
            })}
          </div>

          {/* Quick Stats */}
          <div className={`mt-8 ${performanceMode ? 'glass-performance' : 'glass-ultra'} p-4 rounded-xl`}>
            <h3 className="text-sm font-semibold text-white/80 mb-3">Estatísticas Rápidas</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/60">Sessões Ativas</span>
                <span className="text-sm font-medium text-green-400">{stats.activeSessions}/{stats.totalSessions}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/60">Mensagens</span>
                <span className="text-sm font-medium text-blue-400">{stats.totalMessages}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/60">Uptime</span>
                <span className="text-sm font-medium text-purple-400">{stats.uptime}</span>
              </div>
            </div>
          </div>
        </motion.nav>

        {/* Main Content */}
        <motion.main
          className="flex-1 mr-4 mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: 'Total de Sessões', value: stats.totalSessions, icon: PhoneIcon, color: 'from-blue-500 to-cyan-500' },
                    { label: 'Mensagens Enviadas', value: stats.totalMessages, icon: PaperAirplaneIcon, color: 'from-green-500 to-emerald-500' },
                    { label: 'Grupos Gerenciados', value: stats.totalGroups, icon: UsersIcon, color: 'from-purple-500 to-pink-500' },
                    { label: 'Webhooks Ativos', value: stats.activeWebhooks, icon: BellIcon, color: 'from-orange-500 to-red-500' }
                  ].map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                      <motion.div
                        key={stat.label}
                        className={`${performanceMode ? 'glass-performance' : 'glass-card'} p-6 rounded-xl`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        whileHover={{ scale: 1.02 }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white/70 text-sm">{stat.label}</p>
                            <p className="text-2xl font-bold text-white">{stat.value}</p>
                          </div>
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${stat.color} flex items-center justify-center`}>
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Recent Sessions */}
                <div className={`${performanceMode ? 'glass-performance' : 'glass-card'} p-6 rounded-xl`}>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-white">Sessões Recentes</h2>
                    <motion.button
                      onClick={() => setActiveTab('sessions')}
                      className="liquid-button inline-flex items-center text-sm"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <EyeIcon className="w-4 h-4 mr-2" />
                      Ver Todas
                    </motion.button>
                  </div>
                  
                  <div className="space-y-4">
                    {sessions.slice(0, 3).map((session) => (
                      <motion.div
                        key={session.id}
                        className={`flex items-center justify-between p-4 ${performanceMode ? 'glass-performance' : 'glass-ultra'} rounded-xl`}
                        whileHover={{ scale: 1.01 }}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                            <PhoneIcon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-white font-medium">{session.name}</h3>
                            <p className="text-white/60 text-sm">Última atividade: {session.lastSeen}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className={`px-3 py-1 rounded-full border ${getStatusColor(session.status)} flex items-center space-x-1`}>
                            {getStatusIcon(session.status)}
                            <span className="text-xs font-medium capitalize">{session.status === 'connected' ? 'Conectado' : session.status === 'connecting' ? 'Conectando' : 'Desconectado'}</span>
                          </div>
                          
                          <div className="text-right text-sm">
                            <div className="text-white/70">{session.messages} mensagens</div>
                            <div className="text-white/50">{session.groups} grupos</div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'sessions' && (
              <motion.div
                key="sessions"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">Gerenciar Sessões</h2>
                  <motion.button
                    onClick={() => setShowNewSession(true)}
                    className="liquid-button inline-flex items-center"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Nova Sessão
                  </motion.button>
                </div>

                <div className="grid gap-6">
                  {sessions.map((session) => (
                    <motion.div
                      key={session.id}
                      className={`${performanceMode ? 'glass-performance' : 'glass-card'} p-6 rounded-xl`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.01 }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                            <PhoneIcon className="w-8 h-8 text-white" />
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold text-white">{session.name}</h3>
                            <p className="text-white/70">ID: {session.id}</p>
                            <div className="flex items-center space-x-4 mt-2">
                              <div className={`px-3 py-1 rounded-full border ${getStatusColor(session.status)} flex items-center space-x-1`}>
                                {getStatusIcon(session.status)}
                                <span className="text-xs font-medium capitalize">
                                  {session.status === 'connected' ? 'Conectado' : session.status === 'connecting' ? 'Conectando' : 'Desconectado'}
                                </span>
                              </div>
                              <span className="text-sm text-white/60">Uptime: {session.uptime}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div className="text-sm text-white/70">Mensagens: <span className="text-white font-medium">{session.messages}</span></div>
                            <div className="text-sm text-white/70">Grupos: <span className="text-white font-medium">{session.groups}</span></div>
                            <div className="text-sm text-white/70">Webhooks: <span className="text-white font-medium">{session.webhooks}</span></div>
                          </div>

                          <div className="flex flex-col space-y-2">
                            {session.status === 'connecting' && (
                              <motion.button
                                onClick={() => {
                                  setSelectedSession(session);
                                  setShowQRCode(true);
                                }}
                                className="liquid-button inline-flex items-center text-sm"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <QrCodeIcon className="w-4 h-4 mr-2" />
                                QR Code
                              </motion.button>
                            )}
                            
                            <motion.button
                              className="liquid-button inline-flex items-center text-sm"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <WrenchScrewdriverIcon className="w-4 h-4 mr-2" />
                              Configurar
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Placeholder para outras abas */}
            {activeTab !== 'overview' && activeTab !== 'sessions' && (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className={`${performanceMode ? 'glass-performance' : 'glass-card'} p-8 text-center rounded-xl`}
              >
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center">
                  <CogIcon className="w-10 h-10 text-white/70" />
                </div>
                <h2 className="text-2xl font-semibold text-white mb-2">
                  {tabs.find(tab => tab.id === activeTab)?.name}
                </h2>
                <p className="text-white/70 mb-6">
                  Esta seção está em desenvolvimento. Em breve você poderá gerenciar todas as funcionalidades da API aqui.
                </p>
                <motion.button
                  className="liquid-button inline-flex items-center"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <LinkIcon className="w-5 h-5 mr-2" />
                  Acessar Documentação
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.main>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showNewSession && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowNewSession(false)}
          >
            <motion.div
              className={`${performanceMode ? 'glass-performance' : 'glass-card'} p-6 max-w-md w-full mx-4 rounded-xl`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold text-white mb-4">Nova Sessão WhatsApp</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Nome da Sessão</label>
                  <input
                    type="text"
                    className={`w-full px-4 py-3 ${performanceMode ? 'glass-performance' : 'glass-ultra'} rounded-xl text-white placeholder-white/50 focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                    placeholder="Ex: Vendas, Suporte, Marketing..."
                  />
                </div>
                <div className="flex space-x-3">
                  <motion.button
                    onClick={() => setShowNewSession(false)}
                    className={`flex-1 px-4 py-3 ${performanceMode ? 'glass-performance' : 'glass-ultra'} rounded-xl text-white/70 hover:text-white transition-colors`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    className="flex-1 liquid-button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Criar Sessão
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showQRCode && selectedSession && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowQRCode(false)}
          >
            <motion.div
              className={`${performanceMode ? 'glass-performance' : 'glass-card'} p-6 max-w-md w-full mx-4 text-center rounded-xl`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold text-white mb-4">QR Code - {selectedSession.name}</h3>
              <div className={`w-48 h-48 mx-auto mb-4 ${performanceMode ? 'glass-performance' : 'glass-ultra'} rounded-xl flex items-center justify-center`}>
                <QrCodeIcon className="w-24 h-24 text-white/50" />
              </div>
              <p className="text-white/70 mb-6">
                Escaneie este QR Code com o WhatsApp Web para conectar a sessão.
              </p>
              <motion.button
                onClick={() => setShowQRCode(false)}
                className="liquid-button w-full"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Fechar
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}