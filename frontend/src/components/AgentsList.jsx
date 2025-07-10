import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Switch } from './ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { 
  Trash2, 
  Eye, 
  Pause, 
  Play, 
  MessageCircle, 
  Cpu, 
  Users, 
  Calendar, 
  BarChart3, 
  AlertTriangle, 
  CheckCircle, 
  X, 
  Sparkles,
  Bot,
  Activity,
  Brain,
  Zap,
  Clock
} from 'lucide-react';


export default function AgentsList({ onRefresh }) {
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [token, setToken] = useState('');

  const personalities = {
    professional: { name: 'Profissional', emoji: '🎯', color: 'blue' },
    friendly: { name: 'Amigável', emoji: '😊', color: 'green' },
    creative: { name: 'Criativo', emoji: '🎨', color: 'purple' },
    analytical: { name: 'Analítico', emoji: '📊', color: 'indigo' },
    casual: { name: 'Descontraído', emoji: '😎', color: 'yellow' },
    empathetic: { name: 'Empático', emoji: '❤️', color: 'pink' }
  };

  const specializations = {
    general: { name: 'Assistente Geral', emoji: '🤖' },
    sales: { name: 'Vendas & Marketing', emoji: '💼' },
    support: { name: 'Suporte ao Cliente', emoji: '🛠️' },
    education: { name: 'Educação & Ensino', emoji: '📚' },
    health: { name: 'Saúde & Bem-estar', emoji: '🏥' },
    finance: { name: 'Finanças & Consultoria', emoji: '💰' }
  };

  useEffect(() => {
    fetchToken();
  }, []);

  useEffect(() => {
    if (token) {
      loadAgents();
    }
  }, [token]);

  const fetchToken = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/management/tokens/list`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.tokens && result.tokens.length > 0) {
          const tokenResponse = await fetch(`${apiUrl}/api/management/tokens/${result.tokens[0]._id}/full`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          });

          if (tokenResponse.ok) {
            const tokenResult = await tokenResponse.json();
            if (tokenResult.success && tokenResult.token) {
              setToken(tokenResult.token);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching token:', error);
      setError('Erro ao obter token de autenticação');
    }
  };

  const loadAgents = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${apiUrl}/api/baileys/agents/list`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setAgents(result.agents || []);
        } else {
          setError(result.message || 'Erro ao carregar agentes');
        }
      } else {
        setError(`Erro HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
      setError('Erro ao carregar lista de agentes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDetails = async (agent) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/baileys/agents/${agent.id}/stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSelectedAgent({ ...agent, ...result.agent });
          setShowDetailModal(true);
        }
      }
    } catch (error) {
      console.error('Error fetching agent details:', error);
      // Mostrar detalhes básicos mesmo se falhar
      setSelectedAgent(agent);
      setShowDetailModal(true);
    }
  };

  const handleDeleteAgent = (agent) => {
    setAgentToDelete(agent);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!agentToDelete) return;

    try {
      setIsDeleting(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${apiUrl}/api/baileys/agents/${agentToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setAgents(agents.filter(agent => agent.id !== agentToDelete.id));
          setShowDeleteModal(false);
          setAgentToDelete(null);
          if (onRefresh) onRefresh();
        } else {
          setError(result.message || 'Erro ao deletar agente');
        }
      } else {
        setError(`Erro HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting agent:', error);
      setError('Erro ao deletar agente');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleAgentStatus = async (agent) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const endpoint = agent.isActive ? 'deactivate' : 'activate';
      
      const response = await fetch(`${apiUrl}/api/baileys/agents/${agent.id}/${endpoint}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setAgents(agents.map(a => 
            a.id === agent.id ? { ...a, isActive: !a.isActive } : a
          ));
          if (onRefresh) onRefresh();
        }
      }
    } catch (error) {
      console.error('Error toggling agent status:', error);
      setError('Erro ao alterar status do agente');
    }
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString('pt-BR');
    } catch {
      return 'Data inválida';
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6 md:p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 md:h-12 md:w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground text-sm md:text-base">Carregando agentes...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-primary text-primary-foreground">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Sparkles className="w-5 h-5 md:w-6 md:h-6 mr-2 md:mr-3" />
            <CardTitle className="text-lg md:text-xl">Agentes de IA</CardTitle>
          </div>
          <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30">
            {agents.length} agente{agents.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>

      {error && (
        <div className="bg-destructive/10 border-l-4 border-destructive/50 p-3 md:p-4 m-4 md:m-6">
          <div className="flex">
            <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-destructive flex-shrink-0" />
            <div className="ml-2 md:ml-3">
              <p className="text-xs md:text-sm text-destructive">{error}</p>
            </div>
          </div>
        </div>
      )}

      <CardContent className="p-4 md:p-6">
        {agents.length === 0 ? (
          <div className="text-center py-8 md:py-12">
            <Cpu className="w-12 h-12 md:w-16 md:h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-base md:text-lg font-medium mb-2">
              Nenhum agente criado
            </h3>
            <p className="text-sm md:text-base text-muted-foreground">
              Crie seu primeiro agente de IA para começar
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {agents.map((agent) => {
              const personality = personalities[agent.personality] || {};
              const specialization = specializations[agent.specialization] || {};
              
              return (
                <Card
                  key={agent.id}
                  className="hover:shadow-md transition-all duration-200 border-2 hover:border-primary/30"
                >
                  <CardContent className="p-4 md:p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-lg md:text-xl bg-muted">
                          {personality.emoji || '🤖'}
                        </div>
                        <div className="ml-2 md:ml-3">
                          <h3 className="font-semibold text-sm md:text-base truncate">
                            {agent.name}
                          </h3>
                          <div className="flex items-center mt-1">
                            <div className={`w-2 h-2 rounded-full mr-2 ${
                              agent.isActive ? 'bg-green-500' : 'bg-muted-foreground'
                            }`} />
                            <Badge 
                              variant={agent.isActive ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {agent.isActive ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      <Switch
                        checked={agent.isActive}
                        onCheckedChange={() => toggleAgentStatus(agent)}
                        className="data-[state=checked]:bg-green-600"
                      />
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-xs md:text-sm text-muted-foreground">
                        <span className="text-base md:text-lg mr-2">{specialization.emoji || '🤖'}</span>
                        <span>{specialization.name || 'Especialização'}</span>
                      </div>
                      
                      <div className="flex items-center text-xs md:text-sm text-muted-foreground">
                        <Cpu className="w-3 h-3 md:w-4 md:h-4 mr-2" />
                        <span>{agent.model}</span>
                      </div>
                      
                      <div className="flex items-center text-xs md:text-sm text-muted-foreground">
                        <MessageCircle className="w-3 h-3 md:w-4 md:h-4 mr-2" />
                        <span>{agent.messageCount || 0} mensagens</span>
                      </div>

                      {agent.replyToGroups && (
                        <div className="flex items-center text-xs md:text-sm text-green-600">
                          <Users className="w-3 h-3 md:w-4 md:h-4 mr-2" />
                          <span>Responde em grupos</span>
                        </div>
                      )}
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        onClick={() => handleViewDetails(agent)}
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 md:h-9"
                      >
                        <Eye className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                        <span className="hidden sm:inline">Detalhes</span>
                        <span className="sm:hidden">Ver</span>
                      </Button>
                      
                      <Button
                        onClick={() => handleDeleteAgent(agent)}
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive-foreground hover:bg-destructive h-8 md:h-9 px-2 md:px-3"
                      >
                        <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedAgent && (
            <div>
              <div className="bg-primary text-primary-foreground rounded-t-lg -m-6 mb-6 px-4 md:px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-primary-foreground/20 rounded-full flex items-center justify-center text-lg md:text-2xl mr-3 md:mr-4">
                      {personalities[selectedAgent.personality]?.emoji || '🤖'}
                    </div>
                    <div>
                      <DialogTitle className="text-lg md:text-xl font-bold">
                        {selectedAgent.name}
                      </DialogTitle>
                      <DialogDescription className="text-primary-foreground/80 text-sm md:text-base">
                        {specializations[selectedAgent.specialization]?.name}
                      </DialogDescription>
                    </div>
                  </div>
                </div>
              </div>

              <Tabs defaultValue="config" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="config" className="text-xs md:text-sm">
                    Configuração
                  </TabsTrigger>
                  <TabsTrigger value="stats" className="text-xs md:text-sm">
                    Estatísticas
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="config" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <Card>
                      <CardContent className="p-3 md:p-4">
                        <div className="text-xs md:text-sm text-muted-foreground mb-1">Modelo de IA</div>
                        <div className="font-medium text-sm md:text-base">{selectedAgent.model}</div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-3 md:p-4">
                        <div className="text-xs md:text-sm text-muted-foreground mb-1">Personalidade</div>
                        <div className="font-medium text-sm md:text-base">
                          {personalities[selectedAgent.personality]?.name}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-3 md:p-4">
                        <div className="text-xs md:text-sm text-muted-foreground mb-1">Sessão WhatsApp</div>
                        <div className="font-medium text-xs md:text-sm">{selectedAgent.sessionId}</div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-3 md:p-4">
                        <div className="text-xs md:text-sm text-muted-foreground mb-1">Status</div>
                        <div className="flex items-center">
                          <div className={`w-2 h-2 rounded-full mr-2 ${
                            selectedAgent.isActive ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                          <Badge variant={selectedAgent.isActive ? "default" : "secondary"}>
                            {selectedAgent.isActive ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {selectedAgent.description && (
                    <Card>
                      <CardContent className="p-3 md:p-4">
                        <div className="text-xs md:text-sm text-muted-foreground mb-2">Descrição</div>
                        <div className="text-sm">{selectedAgent.description}</div>
                      </CardContent>
                    </Card>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <Card>
                      <CardContent className="p-3 md:p-4">
                        <div className="text-xs md:text-sm text-muted-foreground mb-1">Criado em</div>
                        <div className="text-xs md:text-sm">{formatDate(selectedAgent.createdAt)}</div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-3 md:p-4">
                        <div className="text-xs md:text-sm text-muted-foreground mb-1">Atualizado em</div>
                        <div className="text-xs md:text-sm">{formatDate(selectedAgent.updatedAt)}</div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                
                <TabsContent value="stats" className="space-y-4 mt-4">
                  {selectedAgent.conversations ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      <Card className="border">
                        <CardContent className="p-3 md:p-4">
                          <div className="flex items-center">
                            <MessageCircle className="w-5 h-5 md:w-6 md:h-6 text-primary mr-2" />
                            <div>
                              <div className="text-lg md:text-2xl font-bold">
                                {selectedAgent.conversations.totalMessages}
                              </div>
                              <div className="text-xs md:text-sm text-muted-foreground">Total de Mensagens</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="border">
                        <CardContent className="p-3 md:p-4">
                          <div className="flex items-center">
                            <Users className="w-5 h-5 md:w-6 md:h-6 text-primary mr-2" />
                            <div>
                              <div className="text-lg md:text-2xl font-bold">
                                {selectedAgent.conversations.uniqueChats}
                              </div>
                              <div className="text-xs md:text-sm text-muted-foreground">Chats Únicos</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="border">
                        <CardContent className="p-3 md:p-4">
                          <div className="flex items-center">
                            <Users className="w-5 h-5 md:w-6 md:h-6 text-primary mr-2" />
                            <div>
                              <div className="text-lg md:text-2xl font-bold">
                                {selectedAgent.conversations.groupMessages}
                              </div>
                              <div className="text-xs md:text-sm text-muted-foreground">Mensagens em Grupos</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="border">
                        <CardContent className="p-3 md:p-4">
                          <div className="flex items-center">
                            <MessageCircle className="w-5 h-5 md:w-6 md:h-6 text-primary mr-2" />
                            <div>
                              <div className="text-lg md:text-2xl font-bold">
                                {selectedAgent.conversations.privateMessages}
                              </div>
                              <div className="text-xs md:text-sm text-muted-foreground">Mensagens Privadas</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <div className="text-center py-6 md:py-8">
                      <BarChart3 className="w-8 h-8 md:w-12 md:h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground text-sm md:text-base">Estatísticas não disponíveis</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <div className="flex items-center">
            <div className="mx-auto flex h-10 w-10 md:h-12 md:w-12 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 md:h-6 md:w-6 text-destructive" />
            </div>
          </div>
          
          <div className="mt-4 text-center">
            <DialogTitle className="text-base md:text-lg font-medium">
              Deletar Agente
            </DialogTitle>
            
            <DialogDescription className="mt-2 text-sm md:text-base">
              Tem certeza que deseja deletar o agente <strong>{agentToDelete?.name}</strong>? 
              Esta ação não pode ser desfeita e todos os dados do agente serão perdidos.
            </DialogDescription>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <Button
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
              variant="outline"
              className="flex-1"
            >
              Cancelar
            </Button>
            
            <Button
              onClick={confirmDelete}
              disabled={isDeleting}
              variant="destructive"
              className="flex-1"
            >
              {isDeleting ? 'Deletando...' : 'Deletar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}