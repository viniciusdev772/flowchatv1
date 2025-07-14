import { useState, useEffect } from 'react';
import {
  LinkIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlayIcon,
  PauseIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  BoltIcon,
  CogIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  NoSymbolIcon
} from '@heroicons/react/24/outline';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export default function WebhookManager({ sessionId, tokenId, onClose }) {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState(null);
  // Available events configuration
  const availableEvents = [
    {
      id: 'messages.upsert',
      name: 'Mensagens Recebidas',
      description: 'Novas mensagens recebidas/enviadas',
      icon: ChatBubbleLeftRightIcon,
      category: 'messages',
      color: 'blue'
    },
    {
      id: 'messages.update',
      name: 'Atualizações de Mensagens',
      description: 'Status de entrega, leitura e edições',
      icon: ArrowPathIcon,
      category: 'messages',
      color: 'green'
    },
    {
      id: 'messages.delete',
      name: 'Mensagens Deletadas',
      description: 'Quando mensagens são deletadas',
      icon: NoSymbolIcon,
      category: 'messages',
      color: 'red'
    },
    {
      id: 'group-participants.update',
      name: 'Mudanças em Grupos',
      description: 'Participantes adicionados/removidos/promovidos',
      icon: UserGroupIcon,
      category: 'groups',
      color: 'purple'
    }
  ];

  const [webhookForm, setWebhookForm] = useState({
    name: '',
    url: '',
    active: true,
    priority: 1,
    events: ['messages.upsert', 'messages.update', 'messages.delete', 'group-participants.update']
  });
  const [testingWebhook, setTestingWebhook] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [token, setToken] = useState('');
  const [tokenLoading, setTokenLoading] = useState(true);


  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  useEffect(() => {
    const initializeWebhookManager = async () => {
      await fetchToken();
    };
    initializeWebhookManager();
  }, [tokenId]);

  useEffect(() => {
    if (token) {
      loadWebhooks();
    } else if (!tokenLoading) {
      // If we're not loading token and token is empty, stop loading
      setLoading(false);
    }
  }, [sessionId, token, tokenLoading]);

  const fetchToken = async () => {
    if (!tokenId) {
      console.error('Token ID não fornecido');
      setTokenLoading(false);
      return;
    }

    try {
      console.log('Fetching token with ID:', tokenId);
      setTokenLoading(true);
      const response = await fetch(`${apiUrl}/api/management/tokens/${tokenId}/full`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

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
        
        // If token is not found (404), it might have been deleted
        if (response.status === 404) {
          console.error('Token não encontrado. O token pode ter sido excluído ou não pertence ao usuário.');
        }
      }
    } catch (error) {
      console.error('Erro ao buscar token:', error);
    } finally {
      console.log('Setting tokenLoading to false');
      setTokenLoading(false);
    }
  };

  const loadWebhooks = async () => {
    try {
      console.log('Loading webhooks for session:', sessionId, 'with token:', token ? 'present' : 'missing');
      setLoading(true);
      const response = await fetch(`${apiUrl}/api/baileys/session/${sessionId}/webhooks`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Webhooks response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Webhooks result:', result);
        if (result.success) {
          setWebhooks(result.webhooks || []);
        } else {
          console.error('Webhooks API returned error:', result.message);
        }
      } else {
        console.error('Webhooks request failed with status:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Erro ao carregar webhooks:', error);
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  const createWebhook = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/baileys/session/${sessionId}/webhooks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookForm)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          await loadWebhooks();
          setShowCreateModal(false);
          resetForm();
        }
      }
    } catch (error) {
      console.error('Erro ao criar webhook:', error);
    }
  };

  const updateWebhook = async (webhookId) => {
    try {
      const response = await fetch(`${apiUrl}/api/baileys/session/${sessionId}/webhooks/${webhookId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookForm)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          await loadWebhooks();
          setEditingWebhook(null);
          resetForm();
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar webhook:', error);
    }
  };

  const deleteWebhook = async (webhookId) => {
    if (!confirm('Tem certeza que deseja remover este webhook?')) return;

    try {
      const response = await fetch(`${apiUrl}/api/baileys/session/${sessionId}/webhooks/${webhookId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          await loadWebhooks();
        }
      }
    } catch (error) {
      console.error('Erro ao deletar webhook:', error);
    }
  };

  const toggleWebhook = async (webhookId) => {
    try {
      const response = await fetch(`${apiUrl}/api/baileys/session/${sessionId}/webhooks/${webhookId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          await loadWebhooks();
        }
      }
    } catch (error) {
      console.error('Erro ao alternar webhook:', error);
    }
  };

  const testWebhook = async (webhookId) => {
    try {
      setTestingWebhook(webhookId);
      const response = await fetch(`${apiUrl}/api/baileys/session/${sessionId}/webhooks/${webhookId}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setTestResults(prev => ({
            ...prev,
            [webhookId]: result.testResult
          }));
        }
      }
    } catch (error) {
      console.error('Erro ao testar webhook:', error);
    } finally {
      setTestingWebhook(null);
    }
  };

  const resetForm = () => {
    setWebhookForm({
      name: '',
      url: '',
      active: true,
      priority: 1,
      events: ['messages.upsert', 'messages.update', 'messages.delete', 'group-participants.update']
    });
  };

  const startEdit = (webhook) => {
    setEditingWebhook(webhook.id);
    setWebhookForm({
      name: webhook.name || '',
      url: webhook.url,
      active: webhook.active,
      priority: webhook.priority,
      events: webhook.events || ['messages.upsert', 'messages.update', 'messages.delete', 'group-participants.update']
    });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 1: return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 2: return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 3: return 'text-green-400 bg-green-500/20 border-green-500/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  const getStatusColor = (active) => {
    return active 
      ? 'text-green-400 bg-green-500/20 border-green-500/30' 
      : 'text-gray-400 bg-gray-500/20 border-gray-500/30';
  };

  const getEventColor = (eventId) => {
    const event = availableEvents.find(e => e.id === eventId);
    if (!event) return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    
    const colors = {
      blue: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
      green: 'text-green-400 bg-green-500/20 border-green-500/30',
      red: 'text-red-400 bg-red-500/20 border-red-500/30',
      purple: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
      yellow: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30'
    };
    
    return colors[event.color] || 'text-gray-400 bg-gray-500/20 border-gray-500/30';
  };

  const getEventIcon = (eventId) => {
    const event = availableEvents.find(e => e.id === eventId);
    return event?.icon || CogIcon;
  };

  const getEventName = (eventId) => {
    const event = availableEvents.find(e => e.id === eventId);
    return event?.name || eventId;
  };

  const toggleEventSelection = (eventId) => {
    setWebhookForm(prev => {
      const newEvents = prev.events.includes(eventId)
        ? prev.events.filter(id => id !== eventId)
        : [...prev.events, eventId];
      
      // Ensure at least one event is selected
      return {
        ...prev,
        events: newEvents.length > 0 ? newEvents : ['messages.upsert']
      };
    });
  };

  if (tokenLoading || loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 p-8 max-w-md w-full mx-4 rounded-2xl shadow-2xl">
          <div className="flex items-center justify-center">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-400" />
            <span className="ml-3 text-lg font-medium text-white">
              {tokenLoading ? 'Autenticando...' : 'Carregando webhooks...'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 p-8 max-w-md w-full mx-4 rounded-2xl shadow-2xl">
          <div className="flex items-center justify-center text-center">
            <div>
              <ExclamationTriangleIcon className="h-16 w-16 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Erro de Autenticação</h3>
              <p className="text-gray-300 mb-6">
                Não foi possível obter o token de acesso. O token pode ter expirado ou sido excluído.
                <br />
                <span className="text-sm">Crie um novo token na aba "Tokens de API".</span>
              </p>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors border border-red-500/30"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div
          className="relative h-full bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 overflow-y-auto"
          style={{
            borderRadius: '20px',
            margin: '12px',
            height: 'calc(100vh - 24px)'
          }}
        >
        {/* Header */}
        <div className="sticky top-0 bg-gray-900/90 backdrop-blur-xl border-b border-gray-700/50 px-4 md:px-8 py-4 md:py-6 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <LinkIcon className="h-8 w-8 text-blue-400 mr-3" />
              <div>
                <h2 className="text-2xl font-bold text-white">Gerenciar Webhooks</h2>
                <p className="text-gray-400">Sessão: {sessionId}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCreateModal(true)}
                disabled={webhooks.length >= 3}
                className="flex items-center px-4 py-2 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 border border-blue-500/30"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Novo Webhook
              </button>
              <button
                onClick={onClose}
                className="relative w-10 h-10 rounded-full bg-red-500/20 hover:bg-red-500/30 transition-all duration-200 flex items-center justify-center group border border-red-500/30"
              >
                <XCircleIcon className="h-5 w-5 text-red-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-8">

          {/* Webhooks List */}
          <div className="space-y-4">
            {webhooks.length === 0 ? (
              <div className="text-center py-12">
                <LinkIcon className="h-16 w-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Nenhum webhook configurado</h3>
                <p className="text-gray-400 mb-6">Configure webhooks para receber eventos em tempo real</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-6 py-3 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 transition-all duration-200 border border-blue-500/30"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Criar Primeiro Webhook
                </button>
              </div>
            ) : (
              webhooks.map((webhook, index) => (
                <div
                  key={webhook.id}
                  className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300 shadow-lg"
                >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-white">
                        {webhook.name || 'Webhook'}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(webhook.active)}`}>
                        {webhook.active ? 'Ativo' : 'Inativo'}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(webhook.priority)}`}>
                        Prioridade {webhook.priority}
                      </span>
                    </div>
                    
                    <div className="space-y-2 text-sm text-gray-400">
                      <div className="flex items-center">
                        <span className="font-medium w-16">URL:</span>
                        <span className="font-mono bg-gray-700/50 px-2 py-1 rounded text-xs text-gray-200 break-all">
                          {webhook.url}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-medium w-16">Eventos:</span>
                        <div className="flex flex-wrap gap-1">
                          {webhook.events.map((event, index) => {
                            const EventIcon = getEventIcon(event);
                            return (
                              <span 
                                key={index} 
                                className={`px-2 py-1 rounded text-xs border flex items-center gap-1 ${getEventColor(event)}`}
                                title={availableEvents.find(e => e.id === event)?.description || event}
                              >
                                <EventIcon className="h-3 w-3" />
                                {getEventName(event)}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      {testResults[webhook.id] && (
                        <div className="flex items-center">
                          <span className="font-medium w-16">Teste:</span>
                          <span className={`px-2 py-1 rounded text-xs border ${
                            testResults[webhook.id].success 
                              ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                              : 'bg-red-500/20 text-red-400 border-red-500/30'
                          }`}>
                            {testResults[webhook.id].success ? 'Sucesso' : 'Falha'} 
                            ({testResults[webhook.id].status})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => testWebhook(webhook.id)}
                      disabled={testingWebhook === webhook.id}
                      className="p-2 text-purple-400 hover:bg-purple-500/20 rounded-xl transition-colors disabled:opacity-50 border border-purple-500/30"
                      title="Testar webhook"
                    >
                      {testingWebhook === webhook.id ? (
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                      ) : (
                        <BoltIcon className="h-5 w-5" />
                      )}
                    </button>
                    
                    <button
                      onClick={() => toggleWebhook(webhook.id)}
                      className={`p-2 rounded-xl transition-colors border ${
                        webhook.active 
                          ? 'text-yellow-400 hover:bg-yellow-500/20 border-yellow-500/30' 
                          : 'text-green-400 hover:bg-green-500/20 border-green-500/30'
                      }`}
                      title={webhook.active ? 'Desativar' : 'Ativar'}
                    >
                      {webhook.active ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
                    </button>
                    
                    <button
                      onClick={() => startEdit(webhook)}
                      className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-xl transition-colors border border-blue-500/30"
                      title="Editar"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    
                    <button
                      onClick={() => deleteWebhook(webhook.id)}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-xl transition-colors border border-red-500/30"
                      title="Remover"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
          </div>

          {/* Footer Info */}
          {webhooks.length > 0 && (
            <div className="mt-6 p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/30">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2" />
                <span className="text-sm text-yellow-300">
                  Máximo de 3 webhooks por sessão. {3 - webhooks.length} restante(s).
                </span>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingWebhook) && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]"
          onClick={() => {
            setShowCreateModal(false);
            setEditingWebhook(null);
            resetForm();
          }}
        >
          <div
            className="bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 p-8 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
                <h3 className="text-xl font-bold text-white mb-6">
                  {editingWebhook ? 'Editar Webhook' : 'Novo Webhook'}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">
                      Nome (opcional)
                    </label>
                    <input
                      type="text"
                      value={webhookForm.name}
                      onChange={(e) => setWebhookForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Webhook Principal"
                      className="w-full px-4 py-3 bg-gray-800/50 backdrop-blur-sm rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-600/50 focus:border-blue-400 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">
                      URL do Webhook *
                    </label>
                    <input
                      type="url"
                      value={webhookForm.url}
                      onChange={(e) => setWebhookForm(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="https://meusite.com/webhook"
                      className="w-full px-4 py-3 bg-gray-800/50 backdrop-blur-sm rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-600/50 focus:border-blue-400 transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">
                      Prioridade
                    </label>
                    <select
                      value={webhookForm.priority}
                      onChange={(e) => setWebhookForm(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                      className="w-full px-4 py-3 bg-gray-800/50 backdrop-blur-sm rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-600/50 focus:border-blue-400 transition-all"
                    >
                      <option value={1}>1 - Alta</option>
                      <option value={2}>2 - Média</option>
                      <option value={3}>3 - Baixa</option>
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={webhookForm.active}
                        onChange={(e) => setWebhookForm(prev => ({ ...prev, active: e.target.checked }))}
                        className="rounded border-gray-500 text-blue-400 focus:ring-blue-500 bg-gray-700/50 focus:bg-gray-600/50 transition-all"
                      />
                      <span className="ml-2 text-sm text-gray-200">Webhook ativo</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-3">
                      Eventos para Escutar
                    </label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {availableEvents.map((event) => {
                        const EventIcon = event.icon;
                        const isSelected = webhookForm.events.includes(event.id);
                        
                        return (
                          <div
                            key={event.id}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${
                              isSelected 
                                ? 'bg-blue-500/20 border-blue-500/50' 
                                : 'bg-gray-800/30 border-gray-600/30 hover:border-gray-500/50'
                            }`}
                            onClick={() => toggleEventSelection(event.id)}
                          >
                            <div className="flex items-start">
                              <div className="flex items-center mr-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleEventSelection(event.id)}
                                  className="rounded border-gray-500 text-blue-400 focus:ring-blue-500 bg-gray-700/50 transition-all"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center mb-1">
                                  <EventIcon className={`h-4 w-4 mr-2 ${
                                    isSelected ? 'text-blue-400' : 'text-gray-400'
                                  }`} />
                                  <span className={`text-sm font-medium ${
                                    isSelected ? 'text-blue-200' : 'text-gray-200'
                                  }`}>
                                    {event.name}
                                  </span>
                                  <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                                    isSelected ? getEventColor(event.id) : 'text-gray-500 bg-gray-700/50'
                                  }`}>
                                    {event.category}
                                  </span>
                                </div>
                                <p className={`text-xs ${
                                  isSelected ? 'text-blue-300' : 'text-gray-400'
                                }`}>
                                  {event.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                      <div className="flex items-center">
                        <ExclamationTriangleIcon className="h-4 w-4 text-yellow-400 mr-2" />
                        <span className="text-xs text-yellow-300">
                          Selecione pelo menos um evento. Mais eventos = mais webhooks disparados.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  <button
                    onClick={() => {
                      if (editingWebhook) {
                        updateWebhook(editingWebhook);
                      } else {
                        createWebhook();
                      }
                    }}
                    disabled={!webhookForm.url}
                    className="flex-1 py-3 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 border border-blue-500/30 font-medium"
                  >
                    {editingWebhook ? 'Atualizar' : 'Criar'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingWebhook(null);
                      resetForm();
                    }}
                    className="flex-1 py-3 bg-gray-700/50 rounded-xl text-gray-300 hover:text-white hover:bg-gray-600/50 transition-all duration-200 border border-gray-600/50 font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
    </>
  );
  }