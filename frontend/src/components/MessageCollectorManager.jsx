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
  ExclamationTriangleIcon,
  CpuChipIcon,\n  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import AISummaryPanel from './AISummaryPanel';

export default function MessageCollectorManager() {
  const [collectors, setCollectors] = useState([]);
  const [activeCollectors, setActiveCollectors] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [selectedCollector, setSelectedCollector] = useState(null);
  const [collectedMessages, setCollectedMessages] = useState([]);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [showSummaryPanel, setShowSummaryPanel] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  
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

  const stopCollector = async (collectorId) => {
    try {
      const response = await fetch(`${apiUrl}/api/management/message-collector/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ collectorId })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          loadCollectors();
        } else {
          alert(`Erro: ${data.message}`);
        }
      } else {
        const error = await response.json();
        alert(`Erro: ${error.message}`);
      }
    } catch (error) {
      console.error('Erro ao parar coletor:', error);
      alert('Erro ao parar coletor');
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
          setSummaryData({
            messages: data.data.messages || [],
            collectorId: collectorId,
            totalMessages: data.data.totalMessages
          });
          setShowMessagesModal(true);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const exportConversation = (messages, collectorInfo) => {
    if (!messages || messages.length === 0) {
      alert('Nenhuma mensagem para exportar');
      return;
    }

    // Analisar estatísticas das mensagens
    const phoneStats = {};
    messages.forEach(msg => {
      const phone = msg.phone || msg.from || 'Desconhecido';
      if (!phoneStats[phone]) {
        phoneStats[phone] = {
          count: 0,
          pushName: msg.pushName || 'Usuário',
          firstMessage: msg.timestamp,
          lastMessage: msg.timestamp
        };
      }
      phoneStats[phone].count++;
      phoneStats[phone].lastMessage = msg.timestamp;
    });

    const topUsers = Object.entries(phoneStats)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 10);

    const sortedMessages = [...messages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    let content = `# Conversa WhatsApp - ${collectorInfo?.sessionId || 'Coletor'}\\n\\n`;
    content += `**Data de Exportação:** ${new Date().toLocaleString('pt-BR')}\\n`;
    content += `**Total de Mensagens:** ${messages.length}\\n`;
    content += `**Sessão:** ${collectorInfo?.sessionId || 'N/A'}\\n`;
    content += `**Grupo:** ${collectorInfo?.groupId?.split('@')[0] || 'N/A'}\\n`;
    
    if (sortedMessages.length > 0) {
      content += `**Período:** ${new Date(sortedMessages[0]?.timestamp).toLocaleString('pt-BR')} até ${new Date(sortedMessages[sortedMessages.length - 1]?.timestamp).toLocaleString('pt-BR')}\\n\\n`;
    }
    
    // Estatísticas de usuários
    content += `## 📊 Estatísticas de Participantes\\n\\n`;
    topUsers.forEach(([phone, data], index) => {
      const cleanPhone = phone.replace('@s.whatsapp.net', '').replace('@c.us', '');
      content += `${index + 1}. **${data.pushName}** (${cleanPhone}) - ${data.count} mensagem${data.count > 1 ? 's' : ''}\\n`;
    });
    
    content += `\\n## 💬 Mensagens\\n\\n`;
    
    sortedMessages.forEach((message) => {
      const time = new Date(message.timestamp).toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      const date = new Date(message.timestamp).toLocaleDateString('pt-BR');
      const phone = (message.phone || message.from || 'Desconhecido')
        .replace('@s.whatsapp.net', '')
        .replace('@c.us', '');
      const name = message.pushName || 'Usuário';
      
      content += `**[${date} ${time}] ${name} (${phone}):** ${message.text || '[Mídia]'}\\n\\n`;
    });
    
    content += `\\n---\\n*Exportado por FlowChat API*`;

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversa-${collectorInfo?.sessionId || 'coletor'}-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'configured':
        return 'text-blue-600 bg-blue-100';
      case 'completed':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
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

  const ThinkingIndicator = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center space-x-3 px-4 py-3"
    >
      <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <CpuChipIcon className="w-5 h-5 text-blue-600" />
        </motion.div>
      </div>
      <div className="bg-gradient-to-r from-gray-100 to-gray-50 rounded-2xl px-5 py-3 flex-1 max-w-md">
        <div className="flex items-center space-x-3">
          <div className="flex space-x-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2.5 h-2.5 bg-blue-500 rounded-full"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
          <span className="text-sm text-gray-700 font-medium">
            Carregando coletores...
          </span>
        </div>
      </div>
    </motion.div>
  );

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-white min-h-0">
        <div className="flex-1 overflow-y-auto py-2 px-2">
          <div className="max-w-4xl mx-auto">
            <ThinkingIndicator />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white min-h-0">
      {/* Header compacto estilo AIStreamingChat */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
              <DocumentTextIcon className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                Coletor de Mensagens
              </h2>
              <p className="text-gray-600 text-sm">
                Configure coleta automática de mensagens dos grupos
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {summaryData && (
              <motion.button
                onClick={() => setShowSummaryPanel(!showSummaryPanel)}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showSummaryPanel 
                    ? 'bg-purple-100 text-purple-700 border border-purple-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <SparklesIcon className="w-4 h-4 mr-1" />
                IA Summary
              </motion.button>
            )}
            
            <motion.button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <PlusIcon className="w-4 h-4 mr-1" />
              Novo Coletor
            </motion.button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Active Collectors */}
          {activeCollectors.length > 0 && (
            <motion.div 
              className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 p-4 rounded-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
                <div className="flex items-center justify-center w-6 h-6 bg-green-100 rounded-full mr-2">
                  <PlayIcon className="w-4 h-4 text-green-600" />
                </div>
                Coletores Ativos ({activeCollectors.length})
              </h3>
          
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeCollectors.map((collector) => (
                  <motion.div
                    key={collector.id}
                    className="bg-white border border-green-300 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                    whileHover={{ scale: 1.02 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full">
                        <CpuChipIcon className="w-4 h-4 text-green-600" />
                      </div>
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                        Ativo
                      </span>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div>
                        <span className="text-xs font-medium text-gray-500">Sessão:</span>
                        <p className="text-sm font-medium text-gray-800">{collector.sessionId}</p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-gray-500">Grupo:</span>
                        <p className="text-sm text-gray-700">{collector.groupId.split('@')[0]}</p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-gray-500">Mensagens:</span>
                        <p className="text-sm font-medium text-green-600">{collector.currentMessages}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <motion.button
                        onClick={() => viewMessages(collector.id)}
                        className="flex-1 py-2 px-3 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100 transition-colors font-medium"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <EyeIcon className="w-4 h-4 inline mr-1" />
                        Ver
                      </motion.button>
                      
                      <motion.button
                        onClick={() => stopCollector(collector.id)}
                        className="flex-1 py-2 px-3 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100 transition-colors font-medium"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <StopIcon className="w-4 h-4 inline mr-1" />
                        Parar
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Collectors List */}
          <motion.div 
            className="bg-gray-50 border border-gray-200 p-4 rounded-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <div className="flex items-center justify-center w-6 h-6 bg-gray-100 rounded-full mr-2">
                <DocumentTextIcon className="w-4 h-4 text-gray-600" />
              </div>
              Histórico de Coletas ({collectors.length})
            </h3>

            {collectors.length === 0 ? (
              <div className="text-center py-12">
                <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4">
                  <DocumentTextIcon className="w-8 h-8 text-gray-400" />
                </div>
                <h4 className="text-lg font-medium text-gray-700 mb-2">
                  Nenhum coletor configurado
                </h4>
                <p className="text-gray-500 text-sm">
                  Crie seu primeiro coletor para começar a capturar mensagens
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {collectors.map((collector, index) => (
                  <motion.div
                    key={collector._id}
                    className="bg-white border border-gray-200 p-4 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all"
                    whileHover={{ scale: 1.005 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full flex-shrink-0 mt-1">
                          <CpuChipIcon className="w-4 h-4 text-gray-600" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h4 className="font-medium text-gray-800 text-sm">
                              {collector.config.name || `Coletor ${collector.sessionId}`}
                            </h4>
                            
                            <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center ${getStatusColor(collector.status)}`}>
                              {getStatusIcon(collector.status)}
                              <span className="ml-1 capitalize">{collector.status}</span>
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-gray-600 mb-2">
                            <div className="flex items-center space-x-1">
                              <span className="font-medium">Sessão:</span> 
                              <span className="truncate">{collector.sessionId}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <span className="font-medium">Grupo:</span> 
                              <span className="truncate">{collector.groupId.split('@')[0]}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <span className="font-medium">Horário:</span> 
                              <span>{collector.config.startHour}h - {collector.config.endHour}h</span>
                            </div>
                          </div>
                          
                          {collector.totalMessages && (
                            <div className="flex items-center space-x-1 text-xs">
                              <CheckCircleIcon className="w-3 h-3 text-green-500" />
                              <span className="text-green-600 font-medium">
                                {collector.totalMessages} mensagens coletadas
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                        <motion.button
                          onClick={() => viewMessages(collector._id)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          title="Ver mensagens"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* AI Summary Panel Integration */}
          <AnimatePresence>
            {showSummaryPanel && summaryData && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 p-4 rounded-xl">
                  <AISummaryPanel 
                    collectedMessages={summaryData.messages}
                    collectorId={summaryData.collectorId}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Create Modal - Estilo melhorado */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              className="bg-white p-6 rounded-2xl max-w-md w-full shadow-2xl border border-gray-200"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center mb-4">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full mr-3">
                  <DocumentTextIcon className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">
                  Novo Coletor de Mensagens
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do Coletor
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Coleta Grupo Marketing"
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-200 focus:bg-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sessão WhatsApp
                  </label>
                  <select
                    value={formData.sessionId}
                    onChange={(e) => setFormData(prev => ({ ...prev, sessionId: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-200 focus:bg-white transition-colors"
                  >
                    <option value="">Selecione uma sessão</option>
                    {sessions.map((session) => (
                      <option key={session.sessionId} value={session.sessionId}>
                        {session.sessionId} - {session.status}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ID do Grupo (com @g.us)
                  </label>
                  <input
                    type="text"
                    value={formData.groupId}
                    onChange={(e) => setFormData(prev => ({ ...prev, groupId: e.target.value }))}
                    placeholder="120123456789@g.us"
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-200 focus:bg-white transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hora Início
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={formData.startHour}
                      onChange={(e) => setFormData(prev => ({ ...prev, startHour: parseInt(e.target.value) }))}
                      className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-200 focus:bg-white transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hora Fim
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={formData.endHour}
                      onChange={(e) => setFormData(prev => ({ ...prev, endHour: parseInt(e.target.value) }))}
                      className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-200 focus:bg-white transition-colors"
                    />
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
                  <div className="flex items-start space-x-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-blue-800 text-sm font-medium mb-1">
                        Importante
                      </p>
                      <p className="text-blue-700 text-sm">
                        O coletor capturará TODAS as mensagens de texto do grupo durante o horário especificado, incluindo spam.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <motion.button
                  onClick={createCollector}
                  disabled={!formData.sessionId || !formData.groupId}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Criar Coletor
                </motion.button>

                <motion.button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 bg-gray-100 rounded-xl text-gray-700 hover:bg-gray-200 font-medium transition-colors"
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

      {/* Messages Modal - Estilo melhorado */}
      <AnimatePresence>
        {showMessagesModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMessagesModal(false)}
          >
            <motion.div
              className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                      <DocumentTextIcon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">
                        Mensagens Coletadas
                      </h3>
                      {selectedCollector && (
                        <p className="text-gray-600 text-sm mt-1">
                          {selectedCollector.totalMessages} mensagens • {selectedCollector.sessionId} • {selectedCollector.groupId.split('@')[0]}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <motion.button
                      onClick={() => exportConversation(collectedMessages, selectedCollector)}
                      className="flex items-center px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
                      Exportar Conversa
                    </motion.button>
                    
                    {summaryData && (
                      <motion.button
                        onClick={() => {
                          setShowSummaryPanel(true);
                          setShowMessagesModal(false);
                        }}
                        className="flex items-center px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <SparklesIcon className="w-4 h-4 mr-1" />
                        Gerar Resumo IA
                      </motion.button>
                    )}
                    
                    <motion.button
                      onClick={() => setShowMessagesModal(false)}
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <XCircleIcon className="w-5 h-5" />
                    </motion.button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                {collectedMessages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4">
                      <DocumentTextIcon className="w-8 h-8 text-gray-400" />
                    </div>
                    <h4 className="text-lg font-medium text-gray-700 mb-2">
                      Nenhuma mensagem coletada
                    </h4>
                    <p className="text-gray-500">
                      As mensagens aparecerão aqui quando o coletor estiver ativo
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {collectedMessages.map((message, index) => (
                      <motion.div
                        key={index}
                        className="bg-white p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        whileHover={{ scale: 1.005 }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full">
                              <span className="text-blue-600 text-xs font-medium">
                                {message.pushName?.charAt(0) || 'U'}
                              </span>
                            </div>
                            <span className="font-medium text-gray-800 text-sm">
                              {message.pushName || 'Usuário'}
                            </span>
                          </div>
                          <span className="text-gray-500 text-xs">
                            {new Date(message.timestamp).toLocaleTimeString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm leading-relaxed pl-8">
                          {message.text}
                        </p>
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