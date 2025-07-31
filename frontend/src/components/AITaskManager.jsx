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
import { 
  Plus, 
  Brain, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  Pause, 
  Trash2, 
  Edit3,
  Calendar,
  User,
  Filter,
  Search,
  ArrowUpDown,
  Sparkles
} from 'lucide-react';

const AITaskManager = () => {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [sortBy, setSortBy] = useState('created');
  const [sortOrder, setSortOrder] = useState('desc');
  const [editingTask, setEditingTask] = useState(null);
  const { toast } = useToast();

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
    category: 'general',
    aiEnabled: true,
    autoExecution: false,
    estimatedDuration: '',
    tags: []
  });

  const priorityColors = {
    low: 'bg-blue-100 text-blue-800 border-blue-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    high: 'bg-red-100 text-red-800 border-red-200',
    urgent: 'bg-purple-100 text-purple-800 border-purple-200'
  };

  const statusColors = {
    pending: 'bg-gray-100 text-gray-800 border-gray-200',
    in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
    paused: 'bg-orange-100 text-orange-800 border-orange-200',
    failed: 'bg-red-100 text-red-800 border-red-200'
  };

  const categories = [
    { value: 'general', label: 'Geral' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'automation', label: 'Automação' },
    { value: 'analysis', label: 'Análise' },
    { value: 'content', label: 'Conteúdo' },
    { value: 'research', label: 'Pesquisa' }
  ];

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    filterAndSortTasks();
  }, [tasks, searchTerm, filterStatus, filterPriority, sortBy, sortOrder]);

  const loadTasks = () => {
    const savedTasks = localStorage.getItem('aiTasks');
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    }
  };

  const saveTasks = (updatedTasks) => {
    localStorage.setItem('aiTasks', JSON.stringify(updatedTasks));
    setTasks(updatedTasks);
  };

  const filterAndSortTasks = () => {
    let filtered = tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           task.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
      const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
      
      return matchesSearch && matchesStatus && matchesPriority;
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

    const task = {
      id: Date.now().toString(),
      ...newTask,
      status: 'pending',
      progress: 0,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      aiSuggestions: [],
      executionLog: []
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
      description: '',
      priority: 'medium',
      dueDate: '',
      category: 'general',
      aiEnabled: true,
      autoExecution: false,
      estimatedDuration: '',
      tags: []
    });
  };

  const updateTaskStatus = (taskId, newStatus) => {
    const updatedTasks = tasks.map(task => 
      task.id === taskId 
        ? { ...task, status: newStatus, updated: new Date().toISOString() }
        : task
    );
    saveTasks(updatedTasks);
    
    toast({
      title: "Status Atualizado",
      description: `Tarefa alterada para ${newStatus}`,
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
      case 'completed': return <CheckCircle2 className="w-4 h-4" />;
      case 'in_progress': return <Play className="w-4 h-4" />;
      case 'paused': return <Pause className="w-4 h-4" />;
      case 'failed': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Não definido';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();
  };

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
            <div className="p-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl shadow-lg">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Tarefas com IA
            </h1>
          </div>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Gerencie suas tarefas com o poder da inteligência artificial. Crie, organize e execute tarefas de forma inteligente.
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
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="in_progress">Em Progresso</SelectItem>
                      <SelectItem value="completed">Concluída</SelectItem>
                      <SelectItem value="paused">Pausada</SelectItem>
                      <SelectItem value="failed">Falhada</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterPriority} onValueChange={setFilterPriority}>
                    <SelectTrigger className="w-40 bg-white/50 border-white/30">
                      <SelectValue placeholder="Prioridade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
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
                      <Button className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg">
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Tarefa
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5" />
                          Criar Nova Tarefa com IA
                        </DialogTitle>
                        <DialogDescription>
                          Preencha os detalhes da tarefa. A IA ajudará na execução e otimização.
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-6 mt-6">
                        <div className="space-y-2">
                          <Label htmlFor="title">Título da Tarefa *</Label>
                          <Input
                            id="title"
                            placeholder="Ex: Analisar mensagens do grupo vendas"
                            value={newTask.title}
                            onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="description">Descrição</Label>
                          <Textarea
                            id="description"
                            placeholder="Descreva detalhadamente o que precisa ser feito..."
                            value={newTask.description}
                            onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                            rows={4}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Prioridade</Label>
                            <Select value={newTask.priority} onValueChange={(value) => setNewTask({...newTask, priority: value})}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Baixa</SelectItem>
                                <SelectItem value="medium">Média</SelectItem>
                                <SelectItem value="high">Alta</SelectItem>
                                <SelectItem value="urgent">Urgente</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Categoria</Label>
                            <Select value={newTask.category} onValueChange={(value) => setNewTask({...newTask, category: value})}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map(cat => (
                                  <SelectItem key={cat.value} value={cat.value}>
                                    {cat.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="dueDate">Data de Vencimento</Label>
                            <Input
                              id="dueDate"
                              type="date"
                              value={newTask.dueDate}
                              onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="duration">Duração Estimada</Label>
                            <Input
                              id="duration"
                              placeholder="Ex: 2 horas, 30 min"
                              value={newTask.estimatedDuration}
                              onChange={(e) => setNewTask({...newTask, estimatedDuration: e.target.value})}
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <Label>IA Habilitada</Label>
                              <p className="text-sm text-gray-500">
                                Permite que a IA auxilie na execução da tarefa
                              </p>
                            </div>
                            <Switch
                              checked={newTask.aiEnabled}
                              onCheckedChange={(checked) => setNewTask({...newTask, aiEnabled: checked})}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <Label>Execução Automática</Label>
                              <p className="text-sm text-gray-500">
                                A IA pode executar a tarefa automaticamente quando possível
                              </p>
                            </div>
                            <Switch
                              checked={newTask.autoExecution}
                              onCheckedChange={(checked) => setNewTask({...newTask, autoExecution: checked})}
                            />
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
                            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                          >
                            Criar Tarefa
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
                <Brain className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                {tasks.length === 0 ? 'Nenhuma tarefa criada' : 'Nenhuma tarefa encontrada'}
              </h3>
              <p className="text-gray-500">
                {tasks.length === 0 
                  ? 'Crie sua primeira tarefa com IA para começar'
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
                            {getStatusIcon(task.status)}
                            {task.title}
                            {task.aiEnabled && (
                              <Sparkles className="w-4 h-4 text-purple-500" />
                            )}
                          </CardTitle>
                          <div className="flex flex-wrap gap-2 mb-3">
                            <Badge className={`${priorityColors[task.priority]} text-xs`}>
                              {task.priority}
                            </Badge>
                            <Badge className={`${statusColors[task.status]} text-xs`}>
                              {task.status.replace('_', ' ')}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {categories.find(c => c.value === task.category)?.label}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {task.description && (
                        <CardDescription className="line-clamp-2">
                          {task.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    
                    <CardContent>
                      <div className="space-y-4">
                        {task.progress > 0 && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Progresso</span>
                              <span>{task.progress}%</span>
                            </div>
                            <Progress value={task.progress} className="h-2" />
                          </div>
                        )}

                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span className={isOverdue(task.dueDate) ? 'text-red-500 font-medium' : ''}>
                              {formatDate(task.dueDate)}
                            </span>
                          </div>
                          {task.estimatedDuration && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>{task.estimatedDuration}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex justify-between pt-3 border-t border-gray-100">
                          <div className="flex gap-2">
                            {task.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateTaskStatus(task.id, 'in_progress')}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200"
                              >
                                <Play className="w-3 h-3 mr-1" />
                                Iniciar
                              </Button>
                            )}
                            {task.status === 'in_progress' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateTaskStatus(task.id, 'completed')}
                                  className="bg-green-50 hover:bg-green-100 text-green-600 border-green-200"
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Concluir
                                </Button>
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
                                onClick={() => updateTaskStatus(task.id, 'in_progress')}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200"
                              >
                                <Play className="w-3 h-3 mr-1" />
                                Retomar
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
                    <div className="text-2xl font-bold text-yellow-600">
                      {tasks.filter(t => t.status === 'pending').length}
                    </div>
                    <div className="text-sm text-gray-500">Pendentes</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {tasks.filter(t => t.status === 'in_progress').length}
                    </div>
                    <div className="text-sm text-gray-500">Em Progresso</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {tasks.filter(t => t.status === 'completed').length}
                    </div>
                    <div className="text-sm text-gray-500">Concluídas</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      {tasks.filter(t => t.aiEnabled).length}
                    </div>
                    <div className="text-sm text-gray-500">Com IA</div>
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