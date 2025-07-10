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
  CpuChipIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  CalendarIcon,
  CalendarDaysIcon,
  FunnelIcon,
  UsersIcon,
  ClockIcon as TimeIcon,
  SunIcon,
  MoonIcon,
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
  UserGroupIcon,
  HashtagIcon
} from '@heroicons/react/24/outline';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { useEffect, useState } from 'react';
import AISummaryPanel from './AISummaryPanel';

export default function MessageCollectorManager() {
  const [collectors, setCollectors] = useState([]);
  const [activeCollectors, setActiveCollectors] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [collectorToStop, setCollectorToStop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [searchingGroups, setSearchingGroups] = useState(false);
  const [selectedCollector, setSelectedCollector] = useState(null);
  const [collectedMessages, setCollectedMessages] = useState([]);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [showSummaryPanel, setShowSummaryPanel] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  
  // Estados para filtros das mensagens
  const [messageSearch, setMessageSearch] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState('');
  const [selectedTimeFilter, setSelectedTimeFilter] = useState('all'); // all, morning, afternoon, evening, night
  const [selectedDateRange, setSelectedDateRange] = useState('all'); // all, today, yesterday, week, month
  const [groupByParticipant, setGroupByParticipant] = useState(false);
  const [sortOrder, setSortOrder] = useState('newest'); // newest, oldest
  const [filteredMessages, setFilteredMessages] = useState([]);
  const [messageStats, setMessageStats] = useState(null);
  
  // Estados para menu de exportação
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    sessionId: '',
    groupId: '',
    name: '',
    startHour: 6,
    endHour: 22,
    timezone: 'America/Sao_Paulo',
    scheduleType: 'daily', // daily, weekly, specific_days
    weekDays: [], // [0,1,2,3,4,5,6] - 0 = Sunday
    specificDates: [], // ['2024-01-01', '2024-01-02']
    duration: 'unlimited', // unlimited, days, until_date
    durationDays: 7,
    endDate: '',
    downloadMedia: true // nova opção para baixar mídias automaticamente (padrão: habilitado)
  });
  
  const [groupSearch, setGroupSearch] = useState('');
  const [filteredGroups, setFilteredGroups] = useState([]);

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

  // Fechar menu de exportação ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showExportMenu && !event.target.closest('.export-menu-container')) {
        setShowExportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

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

  const loadGroups = async (sessionId) => {
    if (!sessionId) {
      setGroups([]);
      setFilteredGroups([]);
      return;
    }
    
    setSearchingGroups(true);
    try {
      console.log('Carregando grupos para sess\u00e3o:', sessionId);
      const response = await fetch(`${apiUrl}/api/management/sessions/${sessionId}/groups?limit=50`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Dados dos grupos recebidos:', data);
        if (data.success) {
          setGroups(data.groups || []);
          setFilteredGroups(data.groups || []);
        } else {
          console.error('API retornou erro:', data.message);
        }
      } else {
        const errorText = await response.text();
        console.error('Erro na resposta:', response.status, errorText);
        // Mostrar mensagem de erro específica baseada no status
        if (response.status === 404) {
          console.warn('Sessão não encontrada ou não conectada');
        } else if (response.status === 403) {
          console.warn('Sem permissão para acessar esta sessão');
        } else if (response.status === 400) {
          console.warn('Sessão não está conectada ao WhatsApp');
        }
      }
    } catch (error) {
      console.error('Erro ao carregar grupos:', error);
    } finally {
      setSearchingGroups(false);
    }
  };

  const filterGroups = (searchTerm) => {
    if (!searchTerm) {
      setFilteredGroups(groups);
      return;
    }
    
    const filtered = groups.filter(group => 
      group.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredGroups(filtered);
  };

  const getTimeOfDay = (date) => {
    const hour = new Date(date).getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  };

  const isInDateRange = (messageDate, range) => {
    const msgDate = new Date(messageDate);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    switch (range) {
      case 'today':
        return msgDate.toDateString() === today.toDateString();
      case 'yesterday':
        return msgDate.toDateString() === yesterday.toDateString();
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return msgDate >= weekAgo;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return msgDate >= monthAgo;
      default:
        return true;
    }
  };

  const applyMessageFilters = () => {
    let filtered = [...collectedMessages];

    // Filtro por busca de texto
    if (messageSearch) {
      const searchLower = messageSearch.toLowerCase();
      filtered = filtered.filter(msg => 
        (msg.text || '').toLowerCase().includes(searchLower) ||
        (msg.pushName || '').toLowerCase().includes(searchLower)
      );
    }

    // Filtro por participante
    if (selectedParticipant && selectedParticipant !== 'all') {
      filtered = filtered.filter(msg => 
        (msg.pushName || 'Usuário') === selectedParticipant
      );
    }

    // Filtro por período do dia
    if (selectedTimeFilter !== 'all') {
      filtered = filtered.filter(msg => 
        getTimeOfDay(msg.timestamp) === selectedTimeFilter
      );
    }

    // Filtro por intervalo de datas
    if (selectedDateRange !== 'all') {
      filtered = filtered.filter(msg => 
        isInDateRange(msg.timestamp, selectedDateRange)
      );
    }

    // Ordenação
    filtered.sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    setFilteredMessages(filtered);
  };

  // Effect para aplicar filtros quando mudarem
  useEffect(() => {
    if (collectedMessages.length > 0) {
      applyMessageFilters();
    }
  }, [messageSearch, selectedParticipant, selectedTimeFilter, selectedDateRange, sortOrder, collectedMessages]);

  const getParticipants = () => {
    const participants = new Set();
    collectedMessages.forEach(msg => {
      participants.add(msg.pushName || 'Usuário');
    });
    return Array.from(participants).sort();
  };

  const groupMessagesByParticipant = (messages) => {
    const grouped = {};
    messages.forEach(msg => {
      const participant = msg.pushName || 'Usuário';
      if (!grouped[participant]) {
        grouped[participant] = [];
      }
      grouped[participant].push(msg);
    });
    return grouped;
  };

  const getTimeIcon = (timeFilter) => {
    switch (timeFilter) {
      case 'morning': return <SunIcon className="w-4 h-4 text-gray-400" />;
      case 'afternoon': return <SunIcon className="w-4 h-4 text-gray-400" />;
      case 'evening': return <MoonIcon className="w-4 h-4 text-gray-400" />;
      case 'night': return <MoonIcon className="w-4 h-4 text-gray-400" />;
      default: return <TimeIcon className="w-4 h-4 text-gray-400" />;
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
            timezone: 'America/Sao_Paulo',
            scheduleType: 'daily',
            weekDays: [],
            specificDates: [],
            duration: 'unlimited',
            durationDays: 7,
            endDate: ''
          });
          setGroupSearch('');
          setGroups([]);
          setFilteredGroups([]);
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

  const handleStopCollector = (collector) => {
    setCollectorToStop(collector);
    setShowConfirmModal(true);
  };

  const confirmStopCollector = async () => {
    if (!collectorToStop) return;
    
    try {
      const response = await fetch(`${apiUrl}/api/management/message-collector/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ collectorId: collectorToStop.id })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setShowConfirmModal(false);
          setCollectorToStop(null);
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
          const messages = data.data.messages || [];
          
          // Filtrar mensagens duplicadas usando o ID único do WhatsApp
          const uniqueMessages = messages.filter((message, index, self) => 
            index === self.findIndex(m => m.id === message.id)
          );
          
          console.log(`📊 Mensagens antes da filtragem: ${messages.length}, após: ${uniqueMessages.length}`);
          
          setCollectedMessages(uniqueMessages);
          setFilteredMessages(uniqueMessages);
          setSelectedCollector({
            ...data.data,
            messages: uniqueMessages
          });
          setSummaryData({
            messages: uniqueMessages,
            collectorId: collectorId,
            totalMessages: uniqueMessages.length
          });
          
          // Calcular estatísticas
          calculateMessageStats(uniqueMessages);
          
          // Reset filters
          setMessageSearch('');
          setSelectedParticipant('');
          setSelectedTimeFilter('all');
          setSelectedDateRange('all');
          setGroupByParticipant(false);
          setSortOrder('newest');
          
          setShowMessagesModal(true);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const calculateMessageStats = (messages) => {
    if (!messages || messages.length === 0) {
      setMessageStats(null);
      return;
    }

    const participantStats = {};
    const hourlyStats = Array(24).fill(0);
    const dailyStats = {};
    
    messages.forEach(msg => {
      const participant = msg.pushName || 'Usuário';
      const date = new Date(msg.timestamp);
      const hour = date.getHours();
      const day = date.toDateString();
      
      // Estatísticas por participante
      if (!participantStats[participant]) {
        participantStats[participant] = {
          name: participant,
          count: 0,
          avgLength: 0,
          totalLength: 0
        };
      }
      participantStats[participant].count++;
      participantStats[participant].totalLength += (msg.text || '').length;
      participantStats[participant].avgLength = Math.round(
        participantStats[participant].totalLength / participantStats[participant].count
      );
      
      // Estatísticas por hora
      hourlyStats[hour]++;
      
      // Estatísticas por dia
      if (!dailyStats[day]) {
        dailyStats[day] = 0;
      }
      dailyStats[day]++;
    });

    const sortedParticipants = Object.values(participantStats)
      .sort((a, b) => b.count - a.count);

    const peakHour = hourlyStats.indexOf(Math.max(...hourlyStats));
    
    setMessageStats({
      totalMessages: messages.length,
      participants: sortedParticipants,
      topParticipant: sortedParticipants[0] || null,
      peakHour: peakHour,
      hourlyDistribution: hourlyStats,
      dailyStats: dailyStats,
      dateRange: {
        start: new Date(Math.min(...messages.map(m => new Date(m.timestamp)))),
        end: new Date(Math.max(...messages.map(m => new Date(m.timestamp))))
      }
    });
  };

  const exportConversation = (messages, collectorInfo, exportType = 'all', participantName = null) => {
    if (!messages || messages.length === 0) {
      alert('Nenhuma mensagem para exportar');
      return;
    }

    // Filtrar mensagens baseado no tipo de exportação
    let messagesToExport = [...messages];
    let exportTitle = 'CONVERSA WHATSAPP';
    
    if (exportType === 'participant' && participantName) {
      messagesToExport = messages.filter(msg => (msg.pushName || 'Usuário') === participantName);
      exportTitle = `MENSAGENS DE ${participantName.toUpperCase()}`;
    } else if (exportType === 'filtered') {
      messagesToExport = filteredMessages;
      exportTitle = 'MENSAGENS FILTRADAS';
    }

    if (messagesToExport.length === 0) {
      alert('Nenhuma mensagem encontrada para exportar');
      return;
    }

    // Analisar estatísticas das mensagens
    const phoneStats = {};
    messagesToExport.forEach(msg => {
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

    const sortedMessages = [...messagesToExport].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    let content = `${exportTitle} - ${collectorInfo?.sessionId || 'COLETOR'}\n`;
    content += `${'='.repeat(60)}\n\n`;
    content += `Data de Exportação: ${new Date().toLocaleString('pt-BR')}\n`;
    content += `Total de Mensagens: ${messagesToExport.length}\n`;
    content += `Sessão: ${collectorInfo?.sessionId || 'N/A'}\n`;
    content += `Grupo: ${collectorInfo?.groupId?.split('@')[0] || 'N/A'}\n`;
    
    if (exportType === 'participant' && participantName) {
      content += `Participante: ${participantName}\n`;
    } else if (exportType === 'filtered') {
      content += `Filtros Aplicados: `;
      const filters = [];
      if (messageSearch) filters.push(`Busca: "${messageSearch}"`);
      if (selectedParticipant) filters.push(`Participante: ${selectedParticipant}`);
      if (selectedTimeFilter !== 'all') filters.push(`Período: ${selectedTimeFilter}`);
      if (selectedDateRange !== 'all') filters.push(`Data: ${selectedDateRange}`);
      content += filters.length > 0 ? filters.join(', ') : 'Nenhum';
      content += `\n`;
    }
    
    if (sortedMessages.length > 0) {
      content += `Período: ${new Date(sortedMessages[0]?.timestamp).toLocaleString('pt-BR')} até ${new Date(sortedMessages[sortedMessages.length - 1]?.timestamp).toLocaleString('pt-BR')}\n\n`;
    }
    
    // Estatísticas de usuários (apenas se não for exportação de participante específico)
    if (exportType !== 'participant') {
      content += `ESTATÍSTICAS DE PARTICIPANTES\n`;
      content += `${'-'.repeat(35)}\n\n`;
      content += `Top Participantes:\n`;
      topUsers.forEach(([phone, data], index) => {
        const cleanPhone = phone.replace('@s.whatsapp.net', '').replace('@c.us', '');
        content += `${index + 1}. ${data.pushName} (${cleanPhone}) - ${data.count} mensagem${data.count > 1 ? 's' : ''}\n`;
      });
    }
    
    content += `\nMENSAGENS\n`;
    content += `${'-'.repeat(25)}\n\n`;
    
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
      
      content += `[${date} ${time}] ${name} (${phone})\n`;
      content += `ID: ${message.id}\n`;
      
      // Verificar se é mídia com link
      const isMediaUrl = message.text && message.text.startsWith('http') && message.text.includes('/api/baileys/download/');
      if (isMediaUrl && message.mediaType) {
        const mediaTypeNames = {
          image: 'Imagem',
          video: 'Vídeo', 
          audio: 'Áudio',
          document: 'Documento',
          sticker: 'Figurinha'
        };
        const mediaTypeName = mediaTypeNames[message.mediaType] || 'Mídia';
        content += `📎 ${mediaTypeName}: ${message.text}\n`;
      } else {
        content += `${message.text || '[Mídia não disponível]'}\n`;
      }
      
      content += `${'-'.repeat(60)}\n\n`;
    });
    
    content += `Exportado por FlowChat API em ${new Date().toLocaleString('pt-BR')}\n`;
    content += `Esta conversa foi coletada automaticamente.`;

    // Nome do arquivo baseado no tipo de exportação
    let fileName = '';
    if (exportType === 'participant' && participantName) {
      const cleanParticipantName = participantName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      fileName = `mensagens-${cleanParticipantName}-${collectorInfo?.sessionId || 'coletor'}-${new Date().toISOString().split('T')[0]}.txt`;
    } else if (exportType === 'filtered') {
      fileName = `mensagens-filtradas-${collectorInfo?.sessionId || 'coletor'}-${new Date().toISOString().split('T')[0]}.txt`;
    } else {
      fileName = `conversa-${collectorInfo?.sessionId || 'coletor'}-${new Date().toISOString().split('T')[0]}.txt`;
    }

    const blob = new Blob([content], { type: 'text/plain; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
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

  // Função para renderizar o conteúdo da mensagem com suporte a mídia
  const renderMessageContent = (message, messageSearch) => {
    if (!message.text) return '[Mensagem vazia]';
    
    // Verificar se é uma URL de mídia
    const isMediaUrl = message.text.startsWith('http') && message.text.includes('/api/baileys/download/');
    
    if (isMediaUrl) {
      const mediaType = message.mediaType || 'unknown';
      const mediaIcons = {
        image: '🖼️',
        video: '🎥',
        audio: '🎵',
        document: '📄',
        sticker: '🏷️'
      };
      
      const mediaTypeNames = {
        image: 'Imagem',
        video: 'Vídeo',
        audio: 'Áudio',
        document: 'Documento',
        sticker: 'Figurinha'
      };
      
      return (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span className="text-base">{mediaIcons[mediaType] || '📎'}</span>
            <span className="text-sm text-gray-600 font-medium">
              {mediaTypeNames[mediaType] || 'Mídia'}
            </span>
          </div>
          <a
            href={message.text}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-800 underline text-sm break-all"
          >
            <span>Visualizar mídia</span>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      );
    }
    
    // Renderizar texto normal com destaque de busca
    if (messageSearch && message.text) {
      return message.text.split(new RegExp(`(${messageSearch})`, 'gi')).map((part, i) => 
        part.toLowerCase() === messageSearch.toLowerCase() ? 
          <mark key={i} className="bg-yellow-200 rounded px-1">{part}</mark> : part
      );
    }
    
    return message.text;
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
                        onClick={() => handleStopCollector(collector)}
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
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-gray-200 flex flex-col"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Fixo */}
              <div className="flex items-center p-6 pb-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl flex-shrink-0">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full mr-3">
                  <DocumentTextIcon className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">
                  Novo Coletor de Mensagens
                </h3>
              </div>

              {/* Conteúdo com Scroll */}
              <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
                <div className="space-y-6 pb-4">
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
                    onChange={(e) => {
                      const sessionId = e.target.value;
                      setFormData(prev => ({ ...prev, sessionId, groupId: '' }));
                      loadGroups(sessionId);
                    }}
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
                    Grupo WhatsApp
                  </label>
                  {formData.sessionId ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={groupSearch}
                          onChange={(e) => {
                            setGroupSearch(e.target.value);
                            filterGroups(e.target.value);
                          }}
                          placeholder="Buscar grupos..."
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl text-gray-800 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-200 focus:bg-white transition-colors"
                        />
                      </div>
                      
                      {searchingGroups ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="ml-2 text-sm text-gray-600">Carregando grupos...</span>
                        </div>
                      ) : (
                        <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl bg-white">
                          {filteredGroups.length > 0 ? (
                            filteredGroups.slice(0, 15).map((group) => (
                              <div
                                key={group.jid}
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, groupId: group.jid }));
                                  setGroupSearch(group.name);
                                  setFilteredGroups([]);
                                }}
                                className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-sm text-gray-800 truncate">{group.name}</p>
                                      <p className="text-xs text-gray-500">{group.participants?.total || 0} membros</p>
                                    </div>
                                  </div>
                                  <div className="text-xs text-blue-600 font-medium">Selecionar</div>
                                </div>
                              </div>
                            ))
                          ) : (
                            groupSearch && (
                              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                <div className="flex flex-col items-center space-y-2">
                                  <MagnifyingGlassIcon className="w-8 h-8 text-gray-300" />
                                  <span>Nenhum grupo encontrado</span>
                                  <span className="text-xs">Tente outro termo de busca</span>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full px-4 py-3 bg-gray-100 rounded-xl text-gray-500 text-center">
                      Selecione uma sessão primeiro
                    </div>
                  )}
                </div>

                {/* Configurações de Agendamento */}
                <div className="space-y-4 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <CalendarIcon className="w-5 h-5 text-blue-600" />
                    <h4 className="font-medium text-blue-800">Configurações de Agendamento</h4>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo de Agendamento
                    </label>
                    <select
                      value={formData.scheduleType}
                      onChange={(e) => setFormData(prev => ({ ...prev, scheduleType: e.target.value }))}
                      className="w-full px-4 py-3 bg-white rounded-xl text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-200 transition-colors"
                    >
                      <option value="daily">Diário</option>
                      <option value="weekly">Semanal (dias específicos)</option>
                      <option value="specific_days">Datas específicas</option>
                    </select>
                  </div>

                  {formData.scheduleType === 'weekly' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Dias da Semana
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, index) => (
                          <label key={index} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.weekDays.includes(index)}
                              onChange={(e) => {
                                const days = formData.weekDays;
                                if (e.target.checked) {
                                  setFormData(prev => ({ ...prev, weekDays: [...days, index] }));
                                } else {
                                  setFormData(prev => ({ ...prev, weekDays: days.filter(d => d !== index) }));
                                }
                              }}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{day}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {formData.scheduleType === 'specific_days' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Datas Específicas
                      </label>
                      <input
                        type="date"
                        className="w-full px-4 py-3 bg-white rounded-xl text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-200 transition-colors"
                        onChange={(e) => {
                          if (e.target.value && !formData.specificDates.includes(e.target.value)) {
                            setFormData(prev => ({
                              ...prev,
                              specificDates: [...prev.specificDates, e.target.value]
                            }));
                          }
                        }}
                      />
                      {formData.specificDates.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {formData.specificDates.map((date, index) => (
                            <div key={index} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border">
                              <span className="text-sm text-gray-700">{new Date(date).toLocaleDateString('pt-BR')}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData(prev => ({
                                    ...prev,
                                    specificDates: prev.specificDates.filter((_, i) => i !== index)
                                  }));
                                }}
                                className="text-red-500 hover:text-red-700"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

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
                        className="w-full px-4 py-3 bg-white rounded-xl text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-200 transition-colors"
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
                        className="w-full px-4 py-3 bg-white rounded-xl text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-200 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Duração da Coleta
                    </label>
                    <select
                      value={formData.duration}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                      className="w-full px-4 py-3 bg-white rounded-xl text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-200 transition-colors"
                    >
                      <option value="unlimited">Ilimitado</option>
                      <option value="days">Número de dias</option>
                      <option value="until_date">Até uma data</option>
                    </select>
                  </div>

                  {formData.duration === 'days' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Número de Dias
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.durationDays}
                        onChange={(e) => setFormData(prev => ({ ...prev, durationDays: parseInt(e.target.value) }))}
                        className="w-full px-4 py-3 bg-white rounded-xl text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-200 transition-colors"
                      />
                    </div>
                  )}

                  {formData.duration === 'until_date' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Data Final
                      </label>
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                        className="w-full px-4 py-3 bg-white rounded-xl text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-200 transition-colors"
                      />
                    </div>
                  )}

                  {/* Opção para baixar mídias */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
                    <div className="flex items-start space-x-3">
                      <ArrowDownTrayIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <label className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.downloadMedia}
                            onChange={(e) => setFormData(prev => ({ ...prev, downloadMedia: e.target.checked }))}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-5 h-5"
                          />
                          <div>
                            <span className="text-blue-800 text-sm font-semibold">
                              Baixar mídias automaticamente
                            </span>
                            <p className="text-blue-700 text-xs mt-1">
                              Quando habilitado, faz download de imagens, vídeos, áudios e documentos, 
                              gerando links diretos. Caso contrário, mostra apenas o tipo de mídia.
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-xl border border-amber-200">
                  <div className="flex items-start space-x-3">
                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-amber-800 text-sm font-semibold mb-2">
                        ⚠️ Informações Importantes
                      </p>
                      <ul className="text-amber-700 text-sm space-y-1">
                        <li>• Captura TODAS as mensagens de texto do grupo</li>
                        <li>• Funciona apenas durante os horários configurados</li>
                        <li>• Inclui mensagens de spam e links</li>
                        <li>• Mídias: baixa arquivos se habilitado, ou mostra apenas tipo [Imagem]</li>
                        <li>• O coletor pode ser parado a qualquer momento</li>
                        <li>• Mensagens já coletadas são preservadas</li>
                      </ul>
                    </div>
                  </div>
                </div>
                </div>
              </div>

              {/* Footer Fixo */}
              <div className="p-6 pt-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex-shrink-0">
                <div className="flex gap-3">
                  <motion.button
                    onClick={createCollector}
                    disabled={!formData.sessionId || !formData.groupId || 
                      (formData.scheduleType === 'weekly' && formData.weekDays.length === 0) ||
                      (formData.scheduleType === 'specific_days' && formData.specificDates.length === 0) ||
                      (formData.duration === 'until_date' && !formData.endDate)}
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
              className="bg-white rounded-xl w-[95vw] h-[95vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
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
                    {/* Menu de Exportação */}
                    <div className="relative export-menu-container">
                      <motion.button
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        className="flex items-center px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        title="Opções de exportação"
                      >
                        <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
                        Exportar
                        <ChevronDownIcon className="w-3 h-3 ml-1" />
                      </motion.button>
                      
                      <AnimatePresence>
                        {showExportMenu && (
                          <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-48"
                            onMouseLeave={() => setShowExportMenu(false)}
                          >
                            <div className="py-1">
                              <button
                                onClick={() => {
                                  exportConversation(collectedMessages, selectedCollector, 'all');
                                  setShowExportMenu(false);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                              >
                                <DocumentTextIcon className="w-4 h-4 mr-2 text-gray-400" />
                                Todas as mensagens
                              </button>
                              
                              <button
                                onClick={() => {
                                  exportConversation(collectedMessages, selectedCollector, 'filtered');
                                  setShowExportMenu(false);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                                disabled={filteredMessages.length === collectedMessages.length}
                              >
                                <FunnelIcon className="w-4 h-4 mr-2 text-gray-400" />
                                Mensagens filtradas
                                <span className="ml-auto text-xs text-gray-500">
                                  ({filteredMessages.length})
                                </span>
                              </button>
                              
                              {getParticipants().length > 0 && (
                                <>
                                  <div className="border-t border-gray-100 my-1"></div>
                                  <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    Por Participante
                                  </div>
                                  {getParticipants().slice(0, 5).map((participant) => {
                                    const participantMessages = collectedMessages.filter(msg => 
                                      (msg.pushName || 'Usuário') === participant
                                    );
                                    return (
                                      <button
                                        key={participant}
                                        onClick={() => {
                                          exportConversation(collectedMessages, selectedCollector, 'participant', participant);
                                          setShowExportMenu(false);
                                        }}
                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                                      >
                                        <div className="w-4 h-4 mr-2 bg-blue-100 rounded-full flex items-center justify-center">
                                          <span className="text-xs text-blue-600 font-bold">
                                            {participant.charAt(0).toUpperCase()}
                                          </span>
                                        </div>
                                        <span className="truncate flex-1">{participant}</span>
                                        <span className="ml-2 text-xs text-gray-500">
                                          ({participantMessages.length})
                                        </span>
                                      </button>
                                    );
                                  })}
                                  {getParticipants().length > 5 && (
                                    <div className="px-4 py-2 text-xs text-gray-500 italic">
                                      +{getParticipants().length - 5} participantes (use filtros)
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    
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

              {/* Layout Ultra Compacto Responsivo */}
              <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {collectedMessages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center bg-gray-50">
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
                  </div>
                ) : (
                  <>
                    {/* Header Mobile com Estatísticas */}
                    <div className="lg:hidden bg-white border-b border-gray-200 p-4">
                      {messageStats && (
                        <div className="grid grid-cols-4 gap-3 mb-4">
                          <div className="text-center">
                            <p className="text-lg font-bold text-blue-600">{messageStats.totalMessages}</p>
                            <p className="text-xs text-gray-500">Total</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-green-600">{messageStats.participants.length}</p>
                            <p className="text-xs text-gray-500">Participantes</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-purple-600">{messageStats.peakHour}h</p>
                            <p className="text-xs text-gray-500">Pico</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-orange-600 truncate">{messageStats.topParticipant?.name || 'N/A'}</p>
                            <p className="text-xs text-gray-500">Mais ativo</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Filtros Mobile */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="relative">
                          <MagnifyingGlassIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={messageSearch}
                            onChange={(e) => setMessageSearch(e.target.value)}
                            placeholder="Buscar mensagens..."
                            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <select
                          value={selectedParticipant}
                          onChange={(e) => setSelectedParticipant(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Todos participantes</option>
                          {getParticipants().map(participant => (
                            <option key={participant} value={participant}>{participant}</option>
                          ))}
                        </select>
                        <select
                          value={selectedTimeFilter}
                          onChange={(e) => setSelectedTimeFilter(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="all">Todos períodos</option>
                          <option value="morning">Manhã</option>
                          <option value="afternoon">Tarde</option>
                          <option value="evening">Noite</option>
                          <option value="night">Madrugada</option>
                        </select>
                        <select
                          value={selectedDateRange}
                          onChange={(e) => setSelectedDateRange(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="all">Todas datas</option>
                          <option value="today">Hoje</option>
                          <option value="yesterday">Ontem</option>
                          <option value="week">Semana</option>
                          <option value="month">Mês</option>
                        </select>
                      </div>
                      
                      {/* Opções Mobile */}
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
                        <div className="flex items-center space-x-4">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={groupByParticipant}
                              onChange={(e) => setGroupByParticipant(e.target.checked)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                            />
                            <span className="text-sm text-gray-700">Agrupar</span>
                          </label>
                          <select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                            className="px-2 py-1 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="newest">Mais recentes</option>
                            <option value="oldest">Mais antigas</option>
                          </select>
                        </div>
                        <div className="text-sm text-gray-500">
                          {filteredMessages.length}/{collectedMessages.length}
                        </div>
                      </div>
                    </div>

                    {/* Sidebar Desktop */}
                    <div className="hidden lg:flex w-80 bg-gray-50 border-r border-gray-200 flex-col flex-shrink-0 overflow-hidden">
                      {/* Estatísticas Compactas */}
                      {messageStats && (
                        <div className="p-4 border-b border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">Estatísticas</h4>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">Total</span>
                              <span className="text-lg font-bold text-blue-600">{messageStats.totalMessages}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">Participantes</span>
                              <span className="text-lg font-bold text-green-600">{messageStats.participants.length}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">Pico</span>
                              <span className="text-lg font-bold text-purple-600">{messageStats.peakHour}h</span>
                            </div>
                            <div className="border-t border-gray-200 pt-3">
                              <span className="text-xs text-gray-500">Mais ativo</span>
                              <div className="flex items-center justify-between mt-1">
                                <p className="text-sm font-semibold text-orange-600 truncate">
                                  {messageStats.topParticipant?.name || 'N/A'}
                                </p>
                                {messageStats.topParticipant && (
                                  <button
                                    onClick={() => exportConversation(collectedMessages, selectedCollector, 'participant', messageStats.topParticipant.name)}
                                    className="text-xs text-blue-600 hover:text-blue-800 underline ml-2"
                                    title={`Exportar mensagens de ${messageStats.topParticipant.name}`}
                                  >
                                    Export
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Área Scrollável de Filtros */}
                      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
                        {/* Filtros Compactos */}
                        <div className="p-4 border-b border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">Filtros</h4>
                          <div className="space-y-3">
                            {/* Busca */}
                            <div className="relative">
                              <MagnifyingGlassIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                              <input
                                type="text"
                                value={messageSearch}
                                onChange={(e) => setMessageSearch(e.target.value)}
                                placeholder="Buscar..."
                                className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>

                            {/* Participante */}
                            <select
                              value={selectedParticipant}
                              onChange={(e) => setSelectedParticipant(e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">Todos participantes</option>
                              {getParticipants().map(participant => (
                                <option key={participant} value={participant}>{participant}</option>
                              ))}
                            </select>

                            {/* Período */}
                            <select
                              value={selectedTimeFilter}
                              onChange={(e) => setSelectedTimeFilter(e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="all">Todos períodos</option>
                              <option value="morning">Manhã</option>
                              <option value="afternoon">Tarde</option>
                              <option value="evening">Noite</option>
                              <option value="night">Madrugada</option>
                            </select>

                            {/* Data */}
                            <select
                              value={selectedDateRange}
                              onChange={(e) => setSelectedDateRange(e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="all">Todas datas</option>
                              <option value="today">Hoje</option>
                              <option value="yesterday">Ontem</option>
                              <option value="week">Semana</option>
                              <option value="month">Mês</option>
                            </select>
                          </div>
                        </div>

                        {/* Opções de View */}
                        <div className="p-4">
                          <div className="space-y-2">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={groupByParticipant}
                                onChange={(e) => setGroupByParticipant(e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                              />
                              <span className="text-xs text-gray-700">Agrupar</span>
                            </label>
                            <select
                              value={sortOrder}
                              onChange={(e) => setSortOrder(e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="newest">Mais recentes</option>
                              <option value="oldest">Mais antigas</option>
                            </select>
                            <div className="text-xs text-gray-500 pt-2">
                              {filteredMessages.length} de {collectedMessages.length}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Área de Mensagens */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <div className="hidden lg:block bg-white border-b border-gray-200 px-4 py-2 flex-shrink-0">
                        <h4 className="text-sm font-semibold text-gray-700">Mensagens</h4>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 lg:p-3">
                        {filteredMessages.length === 0 ? (
                          <div className="text-center py-8">
                            <FunnelIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Nenhuma mensagem encontrada</p>
                          </div>
                        ) : groupByParticipant ? (
                          // Visualização agrupada ultra compacta
                          <div className="space-y-2">
                            {Object.entries(groupMessagesByParticipant(filteredMessages)).map(([participant, messages]) => (
                              <div key={participant} className="bg-white rounded-lg border border-gray-200">
                                <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                      <span className="text-xs text-blue-600 font-bold">
                                        {participant.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                    <span className="text-sm font-medium text-gray-800">{participant}</span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={() => exportConversation(collectedMessages, selectedCollector, 'participant', participant)}
                                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                                      title={`Exportar mensagens de ${participant}`}
                                    >
                                      Export
                                    </button>
                                    <span className="text-xs text-gray-500">{messages.length}</span>
                                  </div>
                                </div>
                                <div className="p-2 space-y-1 max-h-48 lg:max-h-60 overflow-y-auto">
                                  {messages.map((message, index) => (
                                    <div key={index} className="text-xs sm:text-sm py-1">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-gray-400 text-xs">
                                          {new Date(message.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <div className={`w-1.5 h-1.5 rounded-full ${getTimeOfDay(message.timestamp) === 'morning' ? 'bg-yellow-400' : getTimeOfDay(message.timestamp) === 'afternoon' ? 'bg-orange-400' : getTimeOfDay(message.timestamp) === 'evening' ? 'bg-purple-400' : 'bg-blue-400'}`}></div>
                                      </div>
                                      {/* ID da mensagem */}
                                      <div className="text-gray-400 text-xs mb-1 font-mono">
                                        ID: {message.id}
                                      </div>
                                      <div className="text-gray-700 text-xs sm:text-sm leading-relaxed">
                                        {renderMessageContent(message, messageSearch)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          // Visualização linear ultra compacta
                          <div className="space-y-1">
                            {filteredMessages.map((message, index) => {
                              const timeOfDay = getTimeOfDay(message.timestamp);
                              const timeColor = {
                                morning: 'border-l-yellow-400',
                                afternoon: 'border-l-orange-400', 
                                evening: 'border-l-purple-400',
                                night: 'border-l-blue-400'
                              }[timeOfDay];

                              return (
                                <div
                                  key={index}
                                  className={`bg-white px-2 sm:px-3 py-2 rounded border-l-2 ${timeColor} border border-gray-200 hover:bg-gray-50 transition-colors`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                                      <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="text-xs text-gray-600 font-medium">
                                          {message.pushName?.charAt(0) || 'U'}
                                        </span>
                                      </div>
                                      <span className="text-sm font-medium text-gray-800 truncate">
                                        {message.pushName || 'Usuário'}
                                      </span>
                                      <span className="text-xs text-gray-400 flex-shrink-0">
                                        {new Date(message.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${timeOfDay === 'morning' ? 'bg-yellow-400' : timeOfDay === 'afternoon' ? 'bg-orange-400' : timeOfDay === 'evening' ? 'bg-purple-400' : 'bg-blue-400'}`}></div>
                                  </div>
                                  {/* ID da mensagem */}
                                  <div className="text-gray-400 text-xs mb-1 pl-7 font-mono">
                                    ID: {message.id}
                                  </div>
                                  <div className="text-xs sm:text-sm text-gray-700 pl-7 leading-relaxed">
                                    {renderMessageContent(message, messageSearch)}
                                  </div>
                                </div>
                              );
                          })}
                        </div>
                      )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação para Parar Coletor */}
      <AnimatePresence>
        {showConfirmModal && collectorToStop && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowConfirmModal(false)}
          >
            <motion.div
              className="bg-white p-6 rounded-2xl max-w-md w-full shadow-2xl border border-gray-200"
              initial={{ 
                opacity: 0, 
                scale: 0.8, 
                y: 50,
                rotateX: -15 
              }}
              animate={{ 
                opacity: 1, 
                scale: 1, 
                y: 0,
                rotateX: 0
              }}
              exit={{ 
                opacity: 0, 
                scale: 0.85,
                y: 30,
                rotateX: 10
              }}
              transition={{ 
                duration: 0.4, 
                ease: [0.16, 1, 0.3, 1],
                scale: { 
                  type: "spring", 
                  damping: 18, 
                  stiffness: 300
                }
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Ícone de Aviso */}
              <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
                <ExclamationTriangleIcon className="w-8 h-8 text-red-600" />
              </div>

              {/* Título */}
              <h3 className="text-xl font-bold text-gray-800 text-center mb-2">
                Parar Coletor
              </h3>

              {/* Mensagem */}
              <div className="text-center mb-6">
                <p className="text-gray-600 mb-3">
                  Tem certeza que deseja parar o coletor <span className="font-semibold text-gray-800">"{collectorToStop.sessionId}"</span>?
                </p>
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="text-left">
                      <p className="text-yellow-800 text-sm font-medium mb-1">
                        Atenção
                      </p>
                      <p className="text-yellow-700 text-sm">
                        O coletor será finalizado e parará de capturar mensagens. As mensagens já coletadas ({collectorToStop.currentMessages || 0}) serão preservadas.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-3">
                <motion.button
                  onClick={confirmStopCollector}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Sim, Parar Coletor
                </motion.button>

                <motion.button
                  onClick={() => {
                    setShowConfirmModal(false);
                    setCollectorToStop(null);
                  }}
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
    </div>
  );
}