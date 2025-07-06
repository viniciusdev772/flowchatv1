import React, { useState, useEffect, Fragment } from 'react';
import {
  Dialog,
  Transition,
  Tab,
  Switch,
  Button
} from '@headlessui/react';
import {
  TrashIcon,
  EyeIcon,
  PauseIcon,
  PlayIcon,
  ChatBubbleLeftRightIcon,
  CpuChipIcon,
  UsersIcon,
  CalendarIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

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
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando agentes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <SparklesIcon className="w-6 h-6 text-white mr-3" />
            <h2 className="text-xl font-bold text-white">Agentes de IA</h2>
          </div>
          <div className="text-white text-sm">
            {agents.length} agente{agents.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 m-6">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="p-6">
        {agents.length === 0 ? (
          <div className="text-center py-12">
            <CpuChipIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum agente criado
            </h3>
            <p className="text-gray-500">
              Crie seu primeiro agente de IA para começar
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => {
              const personality = personalities[agent.personality] || {};
              const specialization = specializations[agent.specialization] || {};
              
              return (
                <div
                  key={agent.id}
                  className="bg-gray-50 rounded-xl p-6 border-2 border-gray-200 hover:border-purple-300 transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl bg-${personality.color || 'gray'}-100`}>
                        {personality.emoji || '🤖'}
                      </div>
                      <div className="ml-3">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {agent.name}
                        </h3>
                        <div className="flex items-center mt-1">
                          <div className={`w-2 h-2 rounded-full mr-2 ${
                            agent.isActive ? 'bg-green-500' : 'bg-gray-400'
                          }`} />
                          <span className={`text-xs font-medium ${
                            agent.isActive ? 'text-green-700' : 'text-gray-500'
                          }`}>
                            {agent.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <Switch
                      checked={agent.isActive}
                      onChange={() => toggleAgentStatus(agent)}
                      className={classNames(
                        agent.isActive ? 'bg-green-600' : 'bg-gray-200',
                        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500'
                      )}
                    >
                      <span
                        className={classNames(
                          agent.isActive ? 'translate-x-5' : 'translate-x-1',
                          'inline-block h-3 w-3 transform rounded-full bg-white transition-transform'
                        )}
                      />
                    </Switch>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <span className="text-lg mr-2">{specialization.emoji || '🤖'}</span>
                      <span>{specialization.name || 'Especialização'}</span>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600">
                      <CpuChipIcon className="w-4 h-4 mr-2" />
                      <span>{agent.model}</span>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600">
                      <ChatBubbleLeftRightIcon className="w-4 h-4 mr-2" />
                      <span>{agent.messageCount || 0} mensagens</span>
                    </div>

                    {agent.replyToGroups && (
                      <div className="flex items-center text-sm text-green-600">
                        <UsersIcon className="w-4 h-4 mr-2" />
                        <span>Responde em grupos</span>
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      onClick={() => handleViewDetails(agent)}
                      className="flex-1 bg-blue-50 text-blue-700 py-2 px-3 rounded-lg hover:bg-blue-100 transition-colors duration-200 flex items-center justify-center text-sm font-medium"
                    >
                      <EyeIcon className="w-4 h-4 mr-1" />
                      Detalhes
                    </Button>
                    
                    <Button
                      onClick={() => handleDeleteAgent(agent)}
                      className="bg-red-50 text-red-700 py-2 px-3 rounded-lg hover:bg-red-100 transition-colors duration-200 flex items-center justify-center"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Transition show={showDetailModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={setShowDetailModal}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
                  {selectedAgent && (
                    <div>
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-2xl mr-4">
                              {personalities[selectedAgent.personality]?.emoji || '🤖'}
                            </div>
                            <div>
                              <Dialog.Title className="text-xl font-bold text-white">
                                {selectedAgent.name}
                              </Dialog.Title>
                              <p className="text-purple-100">
                                {specializations[selectedAgent.specialization]?.name}
                              </p>
                            </div>
                          </div>
                          
                          <Button
                            onClick={() => setShowDetailModal(false)}
                            className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                          >
                            <XMarkIcon className="w-6 h-6" />
                          </Button>
                        </div>
                      </div>

                      <div className="p-6">
                        <Tab.Group>
                          <Tab.List className="flex space-x-1 rounded-xl bg-gray-100 p-1">
                            <Tab className={({ selected }) =>
                              classNames(
                                'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                                selected
                                  ? 'bg-white text-purple-700 shadow'
                                  : 'text-gray-600 hover:bg-white/[0.12] hover:text-gray-700'
                              )
                            }>
                              Configuração
                            </Tab>
                            <Tab className={({ selected }) =>
                              classNames(
                                'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                                selected
                                  ? 'bg-white text-purple-700 shadow'
                                  : 'text-gray-600 hover:bg-white/[0.12] hover:text-gray-700'
                              )
                            }>
                              Estatísticas
                            </Tab>
                          </Tab.List>
                          
                          <Tab.Panels className="mt-6">
                            <Tab.Panel className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 rounded-lg p-4">
                                  <div className="text-sm text-gray-600 mb-1">Modelo de IA</div>
                                  <div className="font-medium">{selectedAgent.model}</div>
                                </div>
                                
                                <div className="bg-gray-50 rounded-lg p-4">
                                  <div className="text-sm text-gray-600 mb-1">Personalidade</div>
                                  <div className="font-medium">
                                    {personalities[selectedAgent.personality]?.name}
                                  </div>
                                </div>
                                
                                <div className="bg-gray-50 rounded-lg p-4">
                                  <div className="text-sm text-gray-600 mb-1">Sessão WhatsApp</div>
                                  <div className="font-medium text-sm">{selectedAgent.sessionId}</div>
                                </div>
                                
                                <div className="bg-gray-50 rounded-lg p-4">
                                  <div className="text-sm text-gray-600 mb-1">Status</div>
                                  <div className={`font-medium flex items-center ${
                                    selectedAgent.isActive ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    <div className={`w-2 h-2 rounded-full mr-2 ${
                                      selectedAgent.isActive ? 'bg-green-500' : 'bg-red-500'
                                    }`} />
                                    {selectedAgent.isActive ? 'Ativo' : 'Inativo'}
                                  </div>
                                </div>
                              </div>
                              
                              {selectedAgent.description && (
                                <div className="bg-gray-50 rounded-lg p-4">
                                  <div className="text-sm text-gray-600 mb-2">Descrição</div>
                                  <div className="text-sm">{selectedAgent.description}</div>
                                </div>
                              )}
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 rounded-lg p-4">
                                  <div className="text-sm text-gray-600 mb-1">Criado em</div>
                                  <div className="text-sm">{formatDate(selectedAgent.createdAt)}</div>
                                </div>
                                
                                <div className="bg-gray-50 rounded-lg p-4">
                                  <div className="text-sm text-gray-600 mb-1">Atualizado em</div>
                                  <div className="text-sm">{formatDate(selectedAgent.updatedAt)}</div>
                                </div>
                              </div>
                            </Tab.Panel>
                            
                            <Tab.Panel className="space-y-4">
                              {selectedAgent.conversations ? (
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-blue-50 rounded-lg p-4">
                                    <div className="flex items-center">
                                      <ChatBubbleLeftRightIcon className="w-6 h-6 text-blue-600 mr-2" />
                                      <div>
                                        <div className="text-2xl font-bold text-blue-600">
                                          {selectedAgent.conversations.totalMessages}
                                        </div>
                                        <div className="text-sm text-blue-600">Total de Mensagens</div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="bg-green-50 rounded-lg p-4">
                                    <div className="flex items-center">
                                      <UsersIcon className="w-6 h-6 text-green-600 mr-2" />
                                      <div>
                                        <div className="text-2xl font-bold text-green-600">
                                          {selectedAgent.conversations.uniqueChats}
                                        </div>
                                        <div className="text-sm text-green-600">Chats Únicos</div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="bg-purple-50 rounded-lg p-4">
                                    <div className="flex items-center">
                                      <UsersIcon className="w-6 h-6 text-purple-600 mr-2" />
                                      <div>
                                        <div className="text-2xl font-bold text-purple-600">
                                          {selectedAgent.conversations.groupMessages}
                                        </div>
                                        <div className="text-sm text-purple-600">Mensagens em Grupos</div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="bg-indigo-50 rounded-lg p-4">
                                    <div className="flex items-center">
                                      <ChatBubbleLeftRightIcon className="w-6 h-6 text-indigo-600 mr-2" />
                                      <div>
                                        <div className="text-2xl font-bold text-indigo-600">
                                          {selectedAgent.conversations.privateMessages}
                                        </div>
                                        <div className="text-sm text-indigo-600">Mensagens Privadas</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-8">
                                  <ChartBarIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                  <p className="text-gray-500">Estatísticas não disponíveis</p>
                                </div>
                              )}
                            </Tab.Panel>
                          </Tab.Panels>
                        </Tab.Group>
                      </div>
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Delete Modal */}
      <Transition show={showDeleteModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={setShowDeleteModal}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all">
                  <div className="flex items-center">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                      <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                  
                  <div className="mt-4 text-center">
                    <Dialog.Title className="text-lg font-medium text-gray-900">
                      Deletar Agente
                    </Dialog.Title>
                    
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Tem certeza que deseja deletar o agente <strong>{agentToDelete?.name}</strong>? 
                        Esta ação não pode ser desfeita e todos os dados do agente serão perdidos.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex space-x-3">
                    <Button
                      onClick={() => setShowDeleteModal(false)}
                      disabled={isDeleting}
                      className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                    >
                      Cancelar
                    </Button>
                    
                    <Button
                      onClick={confirmDelete}
                      disabled={isDeleting}
                      className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors duration-200 disabled:opacity-50"
                    >
                      {isDeleting ? 'Deletando...' : 'Deletar'}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}