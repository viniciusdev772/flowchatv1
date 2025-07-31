import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Progress } from './ui/progress';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';
import { apiRequest } from '../utils/api';
import { 
  Plus, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  Pause, 
  Trash2, 
  Edit3,
  Calendar,
  Users,
  Filter,
  Search,
  ArrowUpDown,
  Sparkles,
  Send,
  UserGroup,
  MessageCircle,
  Image,
  File,
  Timer,
  Repeat,
  PhoneIcon
} from 'lucide-react';

const AITaskManager = ({ tokenId }) => {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('created');
  const [sortOrder, setSortOrder] = useState('desc');
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [token, setToken] = useState('');
  const [tokenLoading, setTokenLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  // Get user timezone
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [newTask, setNewTask] = useState({
    title: '',
    type: 'send_message',
    sessionId: '',
    targetType: 'group', // 'group' or 'contact'
    targetId: '',
    message: '',
    scheduleType: 'once', // 'once', 'daily', 'weekly', 'monthly'
    scheduledTime: '',
    cronExpression: '',
    isActive: true,
    addSignature: true,
    mediaUrl: '',
    mediaType: '',
    repeatCount: 1,
    timezone: userTimezone
  });

  // WhatsApp task types
  const taskTypes = [
    { value: 'send_message', label: 'Enviar Mensagem', icon: Send },
    { value: 'send_media', label: 'Enviar Mídia', icon: Image },
    { value: 'send_document', label: 'Enviar Documento', icon: File },
    { value: 'group_announcement', label: 'Anúncio no Grupo', icon: UserGroup },
    { value: 'broadcast_message', label: 'Mensagem em Massa', icon: MessageCircle },
    { value: 'group_invite', label: 'Convite para Grupo', icon: Users },
  ];

  const scheduleTypes = [
    { value: 'once', label: 'Uma vez', icon: Clock },
    { value: 'daily', label: 'Diariamente', icon: Repeat },
    { value: 'weekly', label: 'Semanalmente', icon: Calendar },
    { value: 'monthly', label: 'Mensalmente', icon: Calendar },
    { value: 'custom', label: 'Personalizado (Cron)', icon: Timer }
  ];

  const statusColors = {
    active: 'bg-green-100 text-green-800 border-green-200',
    paused: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    completed: 'bg-blue-100 text-blue-800 border-blue-200',
    failed: 'bg-red-100 text-red-800 border-red-200',
    scheduled: 'bg-purple-100 text-purple-800 border-purple-200'
  };

  // Predefined templates
  const taskTemplates = [
    {
      id: 'daily_greeting',
      name: 'Saudação Diária',
      type: 'send_message',
      message: 'Bom dia! Tenha um excelente dia! 🌅',
      scheduleType: 'daily',
      targetType: 'group'
    },
    {
      id: 'weekly_reminder',
      name: 'Lembrete Semanal',
      type: 'send_message', 
      message: 'Lembrete: Não esqueça de participar da reunião semanal! 📅',
      scheduleType: 'weekly',
      targetType: 'group'
    },
    {
      id: 'promotion_broadcast',
      name: 'Divulgação de Promoção',
      type: 'broadcast_message',
      message: '🔥 PROMOÇÃO ESPECIAL! Aproveite nossas ofertas imperdíveis!',
      scheduleType: 'once',
      targetType: 'group'
    },
    {
      id: 'group_announcement',
      name: 'Anúncio Importante',
      type: 'group_announcement',
      message: '📢 COMUNICADO: Informações importantes para todos os membros.',
      scheduleType: 'once',
      targetType: 'group'
    }
  ];

  useEffect(() => {
    const initializeTaskManager = async () => {
      await fetchToken();
    };
    initializeTaskManager();
  }, [tokenId]);

  useEffect(() => {
    if (token) {
      loadTasks();
      loadSessions();
    } else if (!tokenLoading) {
      setLoading(false);
    }
  }, [token, tokenLoading]);

  useEffect(() => {
    filterAndSortTasks();
  }, [tasks, searchTerm, filterStatus, filterType, sortBy, sortOrder]);

  const loadTasks = () => {
    const savedTasks = localStorage.getItem('whatsappTasks');
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    }
  };

  const fetchToken = async () => {
    if (!tokenId) {
      console.error('Token ID não fornecido');
      setTokenLoading(false);
      return;
    }

    try {
      console.log('Fetching token with ID:', tokenId);
      setTokenLoading(true);
      const response = await fetch(
        `${apiUrl}/api/management/tokens/${tokenId}/full`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Token response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('Token result:', result);
        if (result.success && result.token) {
          setToken(result.token);
        } else {
          console.error('Erro ao obter token:', result.message);
        }
      } else {
        console.error('Erro na requisição do token:', response.status);
        const errorText = await response.text();
        console.error('Token error response:', errorText);

        if (response.status === 404) {
          console.error(
            'Token não encontrado. O token pode ter sido excluído ou não pertence ao usuário.'
          );
        }
      }
    } catch (error) {
      console.error('Erro ao buscar token:', error);
    } finally {
      console.log('Setting tokenLoading to false');
      setTokenLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      const response = await fetch(
        `${apiUrl}/api/baileys/sessions`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.sessions) {
          setSessions(result.sessions);
          // Load groups for active sessions
          loadGroupsForSessions(result.sessions.filter(s => s.status === 'connected'));
        }
      }
    } catch (error) {
      console.error('Erro ao carregar sessões:', error);
    }
  };

  const loadGroupsForSessions = async (activeSessions) => {
    try {
      const allGroups = [];
      for (const session of activeSessions) {
        try {
          const response = await fetch(
            `${apiUrl}/api/baileys/groups/list/${session.sessionId}`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );
          
          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              const sessionGroups = result.groups.map(group => ({
                ...group,
                sessionId: session.sessionId,
                sessionName: session.sessionId
              }));
              allGroups.push(...sessionGroups);
            }
          }
        } catch (error) {
          console.error(`Erro ao carregar grupos da sessão ${session.sessionId}:`, error);
        }
      }
      setGroups(allGroups);
    } catch (error) {
      console.error('Erro ao carregar grupos:', error);
    }
  };

  const saveTasks = (updatedTasks) => {
    localStorage.setItem('whatsappTasks', JSON.stringify(updatedTasks));
    setTasks(updatedTasks);
  };

  const filterAndSortTasks = () => {
    let filtered = tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           task.message.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
      const matchesType = filterType === 'all' || task.type === filterType;
      
      return matchesSearch && matchesStatus && matchesType;
    });

    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'created' || sortBy === 'dueDate') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    setFilteredTasks(filtered);
  };

  const createTask = () => {
    if (!newTask.title.trim()) {
      toast({
        title: "Erro",
        description: "O título da tarefa é obrigatório",
        variant: "destructive"
      });
      return;
    }

    if (!newTask.sessionId) {
      toast({
        title: "Erro",
        description: "Selecione uma sessão WhatsApp",
        variant: "destructive"
      });
      return;
    }

    if (!newTask.message.trim()) {
      toast({
        title: "Erro",
        description: "A mensagem é obrigatória",
        variant: "destructive"
      });
      return;
    }

    // Add FlowChat signature if enabled
    let finalMessage = newTask.message;
    if (newTask.addSignature) {
      finalMessage += '\n\n_Esta mensagem foi enviada usando o FlowChat Task Runners_';
    }

    const task = {
      id: Date.now().toString(),
      ...newTask,
      message: finalMessage,
      status: newTask.scheduledTime ? 'scheduled' : 'active',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      lastExecution: null,
      nextExecution: calculateNextExecution(newTask),
      executionLog: [],
      executionCount: 0
    };

    const updatedTasks = [task, ...tasks];
    saveTasks(updatedTasks);
    setIsCreateModalOpen(false);
    resetNewTask();
    
    toast({
      title: "Tarefa Criada",
      description: `Tarefa "${task.title}" foi criada com sucesso`,
    });
  };

  const resetNewTask = () => {
    setNewTask({
      title: '',
      type: 'send_message',
      sessionId: '',
      targetType: 'group',
      targetId: '',
      message: '',
      scheduleType: 'once',
      scheduledTime: '',
      cronExpression: '',
      isActive: true,
      addSignature: true,
      mediaUrl: '',
      mediaType: '',
      repeatCount: 1,
      timezone: userTimezone
    });
    setSelectedTemplate('');
  };

  const calculateNextExecution = (task) => {
    if (!task.scheduledTime) return null;
    
    const now = new Date();
    const scheduled = new Date(task.scheduledTime);
    
    if (task.scheduleType === 'once') {
      return scheduled > now ? scheduled.toISOString() : null;
    }
    
    // Calculate next execution based on schedule type
    let next = new Date(scheduled);
    
    switch (task.scheduleType) {
      case 'daily':
        while (next <= now) {
          next.setDate(next.getDate() + 1);
        }
        break;
      case 'weekly':
        while (next <= now) {
          next.setDate(next.getDate() + 7);
        }
        break;
      case 'monthly':
        while (next <= now) {
          next.setMonth(next.getMonth() + 1);
        }
        break;
    }
    
    return next.toISOString();
  };

  const applyTemplate = (templateId) => {
    const template = taskTemplates.find(t => t.id === templateId);
    if (template) {
      setNewTask({
        ...newTask,
        title: template.name,
        type: template.type,
        message: template.message,
        scheduleType: template.scheduleType,
        targetType: template.targetType
      });
    }
  };

  const updateTaskStatus = (taskId, newStatus) => {
    const updatedTasks = tasks.map(task => 
      task.id === taskId 
        ? { ...task, status: newStatus, updated: new Date().toISOString() }
        : task
    );
    saveTasks(updatedTasks);
    
    const statusLabels = {
      active: 'ativa',
      paused: 'pausada',
      completed: 'concluída',
      failed: 'falhada',
      scheduled: 'agendada'
    };
    
    toast({
      title: "Status Atualizado",
      description: `Tarefa alterada para ${statusLabels[newStatus] || newStatus}`,
    });
  };

  const deleteTask = (taskId) => {
    const updatedTasks = tasks.filter(task => task.id !== taskId);
    saveTasks(updatedTasks);
    
    toast({
      title: "Tarefa Removida",
      description: "Tarefa foi removida com sucesso",
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return <Play className="w-4 h-4" />;
      case 'paused': return <Pause className="w-4 h-4" />;
      case 'completed': return <CheckCircle2 className="w-4 h-4" />;
      case 'failed': return <AlertCircle className="w-4 h-4" />;
      case 'scheduled': return <Calendar className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getTaskTypeIcon = (type) => {
    const taskType = taskTypes.find(t => t.value === type);
    return taskType ? <taskType.icon className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />;
  };

  const getTaskTypeLabel = (type) => {
    const taskType = taskTypes.find(t => t.value === type);
    return taskType ? taskType.label : type;
  };

  const getScheduleTypeLabel = (type) => {
    const scheduleType = scheduleTypes.find(t => t.value === type);
    return scheduleType ? scheduleType.label : type;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Não definido';
    return new Date(dateString).toLocaleString('pt-BR', {
      timeZone: userTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSessionName = (sessionId) => {
    const session = sessions.find(s => s.sessionId === sessionId);
    return session ? session.sessionId : sessionId;
  };

  const getTargetName = (task) => {
    if (task.targetType === 'group') {
      const group = groups.find(g => g.id === task.targetId && g.sessionId === task.sessionId);
      return group ? group.subject : task.targetId;
    }
    return task.targetId;
  };

  // Loading states
  if (tokenLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white/95 backdrop-blur-xl border border-gray-200 p-8 max-w-md w-full mx-4 rounded-2xl shadow-2xl">
          <div className="flex items-center justify-center">
            <Timer className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-lg font-medium text-gray-900">
              {tokenLoading ? 'Autenticando...' : 'Carregando tarefas...'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white/95 backdrop-blur-xl border border-gray-200 p-8 max-w-md w-full mx-4 rounded-2xl shadow-2xl">
          <div className="flex items-center justify-center text-center">
            <div>
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Erro de Autenticação
              </h3>
              <p className="text-gray-600 mb-6">
                Não foi possível obter o token de acesso. O token pode ter
                expirado ou sido excluído.
                <br />
                <span className="text-sm text-gray-500">
                  Crie um novo token na aba "Tokens de API".
                </span>
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors border border-red-200"
              >
                Recarregar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="flex items-center justify-center gap-3">
            <div className="p-3 bg-gradient-to-r from-green-500 to-blue-500 rounded-2xl shadow-lg">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              WhatsApp Task Runners
            </h1>
          </div>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Automatize suas mensagens WhatsApp com agendamentos inteligentes e execução programável.
          </p>
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="backdrop-blur-lg bg-white/80 border-white/20 shadow-xl">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                <div className="flex flex-col sm:flex-row gap-3 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Pesquisar tarefas..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-white/50 border-white/30"
                    />
                  </div>
                  
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40 bg-white/50 border-white/30">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Status</SelectItem>
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="paused">Pausada</SelectItem>
                      <SelectItem value="scheduled">Agendada</SelectItem>
                      <SelectItem value="completed">Concluída</SelectItem>
                      <SelectItem value="failed">Falhada</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-40 bg-white/50 border-white/30">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Tipos</SelectItem>
                      {taskTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="bg-white/50 border-white/30 hover:bg-white/70"
                  >
                    <ArrowUpDown className="w-4 h-4 mr-2" />
                    {sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}
                  </Button>

                  <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white shadow-lg">
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Tarefa WhatsApp
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <MessageSquare className="w-5 h-5" />
                          Criar Nova Tarefa WhatsApp
                        </DialogTitle>
                        <DialogDescription>
                          Configure uma tarefa automatizada para suas sessões WhatsApp com agendamento e repetição.
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-6 mt-6">
                        {/* Template Selection */}
                        <div className="space-y-2">
                          <Label>Template Pré-definido (Opcional)</Label>
                          <Select value={selectedTemplate} onValueChange={(value) => {
                            setSelectedTemplate(value);
                            if (value) applyTemplate(value);
                          }}>
                            <SelectTrigger>
                              <SelectValue placeholder="Escolha um template ou crie do zero" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Criar do zero</SelectItem>
                              {taskTemplates.map(template => (
                                <SelectItem key={template.id} value={template.id}>
                                  {template.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="title">Título da Tarefa *</Label>
                          <Input
                            id="title"
                            placeholder="Ex: Saudação diária no grupo vendas"
                            value={newTask.title}
                            onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Tipo de Tarefa *</Label>
                            <Select value={newTask.type} onValueChange={(value) => setNewTask({...newTask, type: value})}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {taskTypes.map(type => (
                                  <SelectItem key={type.value} value={type.value}>
                                    <div className="flex items-center gap-2">
                                      <type.icon className="w-4 h-4" />
                                      {type.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Sessão WhatsApp *</Label>
                            <Select value={newTask.sessionId} onValueChange={(value) => setNewTask({...newTask, sessionId: value})}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione uma sessão" />
                              </SelectTrigger>
                              <SelectContent>
                                {sessions.filter(s => s.status === 'connected').map(session => (
                                  <SelectItem key={session.sessionId} value={session.sessionId}>
                                    <div className="flex items-center gap-2">
                                      <PhoneIcon className="w-4 h-4 text-green-500" />
                                      {session.sessionId}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Tipo de Destino</Label>
                            <Select value={newTask.targetType} onValueChange={(value) => setNewTask({...newTask, targetType: value, targetId: ''})}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="group">
                                  <div className="flex items-center gap-2">
                                    <UserGroup className="w-4 h-4" />
                                    Grupo
                                  </div>
                                </SelectItem>
                                <SelectItem value="contact">
                                  <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    Contato
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>{newTask.targetType === 'group' ? 'Grupo' : 'Contato'} *</Label>
                            {newTask.targetType === 'group' ? (
                              <Select value={newTask.targetId} onValueChange={(value) => setNewTask({...newTask, targetId: value})}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione um grupo" />
                                </SelectTrigger>
                                <SelectContent>
                                  {groups
                                    .filter(g => g.sessionId === newTask.sessionId)
                                    .map(group => (
                                    <SelectItem key={group.id} value={group.id}>
                                      {group.subject}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                placeholder="Ex: 5511999999999@s.whatsapp.net"
                                value={newTask.targetId}
                                onChange={(e) => setNewTask({...newTask, targetId: e.target.value})}
                              />
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="message">Mensagem *</Label>
                          <Textarea
                            id="message"
                            placeholder="Digite a mensagem que será enviada..."
                            value={newTask.message}
                            onChange={(e) => setNewTask({...newTask, message: e.target.value})}
                            rows={4}
                          />
                        </div>

                        {/* Media Upload for media tasks */}
                        {(newTask.type === 'send_media' || newTask.type === 'send_document') && (
                          <div className="space-y-2">
                            <Label htmlFor="mediaUrl">URL da Mídia</Label>
                            <Input
                              id="mediaUrl"
                              placeholder="https://exemplo.com/arquivo.jpg"
                              value={newTask.mediaUrl}
                              onChange={(e) => setNewTask({...newTask, mediaUrl: e.target.value})}
                            />
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Tipo de Agendamento</Label>
                            <Select value={newTask.scheduleType} onValueChange={(value) => setNewTask({...newTask, scheduleType: value})}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {scheduleTypes.map(type => (
                                  <SelectItem key={type.value} value={type.value}>
                                    <div className="flex items-center gap-2">
                                      <type.icon className="w-4 h-4" />
                                      {type.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="scheduledTime">
                              {newTask.scheduleType === 'once' ? 'Data e Hora' : 'Hora de Início'}
                            </Label>
                            <Input
                              id="scheduledTime"
                              type="datetime-local"
                              value={newTask.scheduledTime}
                              onChange={(e) => setNewTask({...newTask, scheduledTime: e.target.value})}
                            />
                          </div>
                        </div>

                        {newTask.scheduleType === 'custom' && (
                          <div className="space-y-2">
                            <Label htmlFor="cronExpression">Expressão Cron</Label>
                            <Input
                              id="cronExpression"
                              placeholder="Ex: 0 9 * * 1-5 (Segunda a sexta às 9h)"
                              value={newTask.cronExpression}
                              onChange={(e) => setNewTask({...newTask, cronExpression: e.target.value})}
                            />
                            <p className="text-sm text-gray-500">
                              Use <a href="https://crontab.guru/" target="_blank" className="text-blue-500 hover:underline">crontab.guru</a> para ajuda com expressões cron
                            </p>
                          </div>
                        )}

                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <Label>Adicionar Assinatura FlowChat</Label>
                              <p className="text-sm text-gray-500">
                                Adiciona "Esta mensagem foi enviada usando o FlowChat Task Runners" ao final
                              </p>
                            </div>
                            <Switch
                              checked={newTask.addSignature}
                              onCheckedChange={(checked) => setNewTask({...newTask, addSignature: checked})}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <Label>Tarefa Ativa</Label>
                              <p className="text-sm text-gray-500">
                                A tarefa será executada automaticamente conforme agendado
                              </p>
                            </div>
                            <Switch
                              checked={newTask.isActive}
                              onCheckedChange={(checked) => setNewTask({...newTask, isActive: checked})}
                            />
                          </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-start gap-2">
                            <Clock className="w-5 h-5 text-blue-500 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-blue-800">Timezone do Usuário</p>
                              <p className="text-sm text-blue-600">{userTimezone}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                          <Button 
                            variant="outline" 
                            onClick={() => setIsCreateModalOpen(false)}
                          >
                            Cancelar
                          </Button>
                          <Button 
                            onClick={createTask}
                            className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Criar Tarefa WhatsApp
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tasks Grid */}
        <AnimatePresence>
          {filteredTasks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <div className="p-4 bg-gray-100 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                <MessageSquare className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                {tasks.length === 0 ? 'Nenhuma tarefa WhatsApp criada' : 'Nenhuma tarefa encontrada'}
              </h3>
              <p className="text-gray-500">
                {tasks.length === 0 
                  ? 'Crie sua primeira tarefa automatizada para WhatsApp'
                  : 'Tente ajustar os filtros de pesquisa'
                }
              </p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTasks.map((task, index) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="backdrop-blur-lg bg-white/80 border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-2 flex items-center gap-2">
                            {getTaskTypeIcon(task.type)}
                            {task.title}
                          </CardTitle>
                          <div className="flex flex-wrap gap-2 mb-3">
                            <Badge className={`${statusColors[task.status]} text-xs`}>
                              {getStatusIcon(task.status)}
                              <span className="ml-1">{task.status}</span>
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {getTaskTypeLabel(task.type)}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {getScheduleTypeLabel(task.scheduleType)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <CardDescription className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <PhoneIcon className="w-4 h-4 text-green-500" />
                          <span>{getSessionName(task.sessionId)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <UserGroup className="w-4 h-4 text-blue-500" />
                          <span>{getTargetName(task)}</span>
                        </div>
                        <p className="line-clamp-2 text-gray-600">
                          {task.message}
                        </p>
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="space-y-4">
                        {/* Execution Info */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Próxima Execução</p>
                            <p className="font-medium">
                              {task.nextExecution ? formatDate(task.nextExecution) : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Execuções</p>
                            <p className="font-medium">{task.executionCount || 0}</p>
                          </div>
                        </div>

                        {/* Schedule Info */}
                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Timer className="w-4 h-4" />
                            <span>Timezone: {task.timezone}</span>
                          </div>
                          {task.lastExecution && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>Última: {formatDate(task.lastExecution)}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex justify-between pt-3 border-t border-gray-100">
                          <div className="flex gap-2">
                            {task.status === 'scheduled' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateTaskStatus(task.id, 'active')}
                                className="bg-green-50 hover:bg-green-100 text-green-600 border-green-200"
                              >
                                <Play className="w-3 h-3 mr-1" />
                                Ativar
                              </Button>
                            )}
                            {task.status === 'active' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateTaskStatus(task.id, 'paused')}
                                  className="bg-orange-50 hover:bg-orange-100 text-orange-600 border-orange-200"
                                >
                                  <Pause className="w-3 h-3 mr-1" />
                                  Pausar
                                </Button>
                              </>
                            )}
                            {task.status === 'paused' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateTaskStatus(task.id, 'active')}
                                className="bg-green-50 hover:bg-green-100 text-green-600 border-green-200"
                              >
                                <Play className="w-3 h-3 mr-1" />
                                Reativar
                              </Button>
                            )}
                            {(task.status === 'active' || task.status === 'scheduled') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateTaskStatus(task.id, 'completed')}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200"
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Finalizar
                              </Button>
                            )}
                          </div>
                          
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingTask(task)}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              <Edit3 className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteTask(task.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* Stats Footer */}
        {tasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="backdrop-blur-lg bg-white/80 border-white/20 shadow-xl">
              <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-800">{tasks.length}</div>
                    <div className="text-sm text-gray-500">Total</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {tasks.filter(t => t.status === 'active').length}
                    </div>
                    <div className="text-sm text-gray-500">Ativas</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      {tasks.filter(t => t.status === 'scheduled').length}
                    </div>
                    <div className="text-sm text-gray-500">Agendadas</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {tasks.filter(t => t.status === 'completed').length}
                    </div>
                    <div className="text-sm text-gray-500">Concluídas</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-600">
                      {tasks.reduce((sum, t) => sum + (t.executionCount || 0), 0)}
                    </div>
                    <div className="text-sm text-gray-500">Execuções</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AITaskManager;