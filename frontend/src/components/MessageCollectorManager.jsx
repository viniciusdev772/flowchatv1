import {
  ClockIcon,
  PlayIcon,
  StopIcon,
  DocumentTextIcon,
  ChartBarIcon,
  CogIcon,
  TrashIcon,
  EyeIcon,
  SparklesIcon,
  PlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function MessageCollectorManager() {
  const [collectors, setCollectors] = useState([]);
  const [activeCollectors, setActiveCollectors] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [selectedCollector, setSelectedCollector] = useState(null);
  const [collectedMessages, setCollectedMessages] = useState([]);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    sessionId: '',
    groupId: '',
    name: '',
    startHour: 6,
    endHour: 22,
    timezone: 'America/Sao_Paulo'
  });

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  // Performance mode detection
  const [performanceMode] = useState(() => {
    const isLowEnd = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return isLowEnd || isMobile;
  });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Atualizar a cada 30s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([
        loadCollectors(),
        loadSessions()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCollectors = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/management/message-collector/list`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCollectors(data.collectors || []);
          setActiveCollectors(data.active || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar coletores:', error);
    }
  };

  const loadSessions = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/management/tokens/list`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSessions(data.sessions || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar sessões:', error);
    }
  };

  const createCollector = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/management/message-collector/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setShowCreateModal(false);
          setFormData({
            sessionId: '',
            groupId: '',
            name: '',
            startHour: 6,
            endHour: 22,
            timezone: 'America/Sao_Paulo'
          });
          loadCollectors();
        }
      } else {
        const error = await response.json();
        alert(`Erro: ${error.message}`);
      }
    } catch (error) {
      console.error('Erro ao criar coletor:', error);
      alert('Erro ao criar coletor');
    }
  };

  const stopCollector = async (sessionId, groupId) => {
    try {
      const response = await fetch(`${apiUrl}/api/management/message-collector/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId, groupId })
      });

      if (response.ok) {
        loadCollectors();
      }
    } catch (error) {
      console.error('Erro ao parar coletor:', error);
    }
  };

  const viewMessages = async (collectorId) => {
    try {
      const response = await fetch(`${apiUrl}/api/management/message-collector/messages/${collectorId}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCollectedMessages(data.data.messages || []);
          setSelectedCollector(data.data);
          setShowMessagesModal(true);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-500/20';
      case 'configured': return 'text-blue-400 bg-blue-500/20';
      case 'completed': return 'text-gray-400 bg-gray-500/20';
      default: return 'text-yellow-400 bg-yellow-500/20';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return <PlayIcon className="w-4 h-4" />;
      case 'configured': return <ClockIcon className="w-4 h-4" />;
      case 'completed': return <CheckCircleIcon className="w-4 h-4" />;
      default: return <ExclamationTriangleIcon className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
        <span className="ml-3 text-white">Carregando coletores...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center">
            <DocumentTextIcon className="w-8 h-8 mr-3 text-blue-400" />
            Coletor de Mensagens
          </h2>
          <p className="text-white/70 mt-1">
            Configure coleta automática de mensagens dos grupos
          </p>
        </div>
        
        <motion.button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Novo Coletor
        </motion.button>
      </div>

      {/* Active Collectors */}
      {activeCollectors.length > 0 && (
        <div className="glass-performance p-4 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <PlayIcon className="w-5 h-5 mr-2 text-green-400" />
            Coletores Ativos ({activeCollectors.length})
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeCollectors.map((collector) => (
              <motion.div
                key={collector.id}
                className="glass-performance p-4 rounded-lg border border-green-500/30"
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-white">{collector.sessionId}</span>
                  <span className="text-green-400 text-sm flex items-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                    Ativo
                  </span>
                </div>
                
                <p className="text-white/70 text-sm mb-2">
                  Grupo: {collector.groupId.split('@')[0]}
                </p>
                
                <p className="text-white/70 text-sm mb-3">
                  Mensagens: {collector.currentMessages}
                </p>
                
                <div className="flex gap-2">
                  <motion.button
                    onClick={() => viewMessages(collector.id)}
                    className="flex-1 py-2 px-3 bg-blue-500/20 text-blue-400 rounded-lg text-sm hover:bg-blue-500/30 transition-colors"
                    whileTap={{ scale: 0.98 }}
                  >
                    <EyeIcon className="w-4 h-4 inline mr-1" />
                    Ver
                  </motion.button>
                  
                  <motion.button
                    onClick={() => stopCollector(collector.sessionId, collector.groupId)}
                    className="flex-1 py-2 px-3 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition-colors"
                    whileTap={{ scale: 0.98 }}
                  >
                    <StopIcon className="w-4 h-4 inline mr-1" />
                    Parar
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Collectors List */}
      <div className="glass-performance p-4 rounded-xl">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <DocumentTextIcon className="w-5 h-5 mr-2 text-blue-400" />
          Histórico de Coletas ({collectors.length})
        </h3>

        {collectors.length === 0 ? (
          <div className="text-center py-8">
            <DocumentTextIcon className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <p className="text-white/70">Nenhum coletor configurado ainda</p>
            <p className="text-white/50 text-sm mt-2">
              Crie seu primeiro coletor para começar a capturar mensagens
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {collectors.map((collector) => (
              <motion.div
                key={collector._id}
                className="glass-performance p-4 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
                whileHover={{ scale: 1.01 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-white">
                        {collector.config.name || `Coletor ${collector.sessionId}`}
                      </h4>
                      
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center ${getStatusColor(collector.status)}`}>
                        {getStatusIcon(collector.status)}
                        <span className="ml-1 capitalize">{collector.status}</span>
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-white/70">
                      <div>
                        <span className="font-medium">Sessão:</span> {collector.sessionId}
                      </div>
                      <div>
                        <span className="font-medium">Grupo:</span> {collector.groupId.split('@')[0]}
                      </div>
                      <div>
                        <span className="font-medium">Horário:</span> {collector.config.startHour}h - {collector.config.endHour}h
                      </div>
                    </div>
                    
                    {collector.totalMessages && (
                      <div className="text-sm text-green-400 mt-2">
                        ✓ {collector.totalMessages} mensagens coletadas
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <motion.button
                      onClick={() => viewMessages(collector._id)}
                      className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      title="Ver mensagens"
                    >
                      <EyeIcon className="w-5 h-5" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              className="glass-performance p-6 rounded-xl max-w-md w-full mx-4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-4">
                Novo Coletor de Mensagens
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Nome do Coletor
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Coleta Grupo Marketing"
                    className="w-full px-4 py-3 glass-performance rounded-xl text-white placeholder-white/50 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-white/10"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Sessão WhatsApp
                  </label>
                  <select
                    value={formData.sessionId}
                    onChange={(e) => setFormData(prev => ({ ...prev, sessionId: e.target.value }))}
                    className="w-full px-4 py-3 glass-performance rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none border border-white/10"
                  >
                    <option value="">Selecione uma sessão</option>
                    {sessions.map((session) => (
                      <option key={session.sessionId} value={session.sessionId} className="bg-gray-800">
                        {session.sessionId} - {session.status}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    ID do Grupo (com @g.us)
                  </label>
                  <input
                    type="text"
                    value={formData.groupId}
                    onChange={(e) => setFormData(prev => ({ ...prev, groupId: e.target.value }))}
                    placeholder="120123456789@g.us"
                    className="w-full px-4 py-3 glass-performance rounded-xl text-white placeholder-white/50 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-white/10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Hora Início
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={formData.startHour}
                      onChange={(e) => setFormData(prev => ({ ...prev, startHour: parseInt(e.target.value) }))}
                      className="w-full px-4 py-3 glass-performance rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none border border-white/10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Hora Fim
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={formData.endHour}
                      onChange={(e) => setFormData(prev => ({ ...prev, endHour: parseInt(e.target.value) }))}
                      className="w-full px-4 py-3 glass-performance rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none border border-white/10"
                    />
                  </div>
                </div>

                <div className="bg-blue-500/20 p-4 rounded-xl border border-blue-500/30">
                  <p className="text-blue-300 text-sm">
                    <strong>Importante:</strong> O coletor capturará TODAS as mensagens de texto do grupo durante o horário especificado, incluindo spam.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <motion.button
                  onClick={createCollector}
                  disabled={!formData.sessionId || !formData.groupId}
                  className="flex-1 py-3 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Criar Coletor
                </motion.button>
                
                <motion.button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 glass-performance rounded-xl text-white/70 hover:text-white transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Cancelar
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Modal */}
      <AnimatePresence>
        {showMessagesModal && (
          <motion.div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMessagesModal(false)}
          >
            <motion.div
              className="glass-performance rounded-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      Mensagens Coletadas
                    </h3>
                    {selectedCollector && (
                      <p className="text-white/70 text-sm mt-1">
                        {selectedCollector.totalMessages} mensagens • {selectedCollector.sessionId} • {selectedCollector.groupId.split('@')[0]}
                      </p>
                    )}
                  </div>
                  
                  <motion.button
                    onClick={() => setShowMessagesModal(false)}
                    className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <XCircleIcon className="w-6 h-6" />
                  </motion.button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {collectedMessages.length === 0 ? (
                  <div className="text-center py-8">
                    <DocumentTextIcon className="w-16 h-16 text-white/30 mx-auto mb-4" />
                    <p className="text-white/70">Nenhuma mensagem coletada</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {collectedMessages.map((message, index) => (
                      <motion.div
                        key={index}
                        className="glass-performance p-3 rounded-lg border border-white/10"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <span className="font-medium text-white text-sm">
                            {message.pushName}
                          </span>
                          <span className="text-white/50 text-xs">
                            {new Date(message.timestamp).toLocaleTimeString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-white/90 text-sm">{message.text}</p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}