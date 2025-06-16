import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  CogIcon
} from '@heroicons/react/24/outline';

export default function WebhookManager({ sessionId, tokenId, onClose }) {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState(null);
  const [webhookForm, setWebhookForm] = useState({
    name: '',
    url: '',
    active: true,
    priority: 1,
    events: ['messages.upsert']
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
    }
  }, [sessionId, token]);

  const fetchToken = async () => {
    if (!tokenId) {
      console.error('Token ID não fornecido');
      setTokenLoading(false);
      return;
    }

    try {
      setTokenLoading(true);
      const response = await fetch(`${apiUrl}/api/management/tokens/${tokenId}/full`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.token) {
          setToken(result.token);
        } else {
          console.error('Erro ao obter token:', result.message);
        }
      } else {
        console.error('Erro na requisição do token:', response.status);
      }
    } catch (error) {
      console.error('Erro ao buscar token:', error);
    } finally {
      setTokenLoading(false);
    }
  };

  const loadWebhooks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/api/baileys/session/${sessionId}/webhooks`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setWebhooks(result.webhooks || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar webhooks:', error);
    } finally {
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
      events: ['messages.upsert']
    });
  };

  const startEdit = (webhook) => {
    setEditingWebhook(webhook.id);
    setWebhookForm({
      name: webhook.name || '',
      url: webhook.url,
      active: webhook.active,
      priority: webhook.priority,
      events: webhook.events || ['messages.upsert']
    });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 1: return 'text-red-600 bg-red-100';
      case 2: return 'text-yellow-600 bg-yellow-100';
      case 3: return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (active) => {
    return active ? 'text-green-600 bg-green-100' : 'text-gray-600 bg-gray-100';
  };

  if (tokenLoading || loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl border border-white/20">
          <div className="flex items-center justify-center">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-lg font-medium text-gray-900">
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
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl border border-white/20">
          <div className="flex items-center justify-center text-center">
            <div>
              <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Erro de Autenticação</h3>
              <p className="text-gray-600 mb-6">Não foi possível obter o token de acesso.</p>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-600 text-white rounded-2xl hover:bg-gray-700 transition-colors"
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 max-w-4xl w-full mx-4 shadow-2xl border border-white/20 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <LinkIcon className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Gerenciar Webhooks</h2>
              <p className="text-gray-600">Sessão: {sessionId}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={webhooks.length >= 3}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Novo Webhook
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <XCircleIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Webhooks List */}
        <div className="space-y-4">
          {webhooks.length === 0 ? (
            <div className="text-center py-12">
              <LinkIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum webhook configurado</h3>
              <p className="text-gray-500 mb-6">Configure webhooks para receber eventos em tempo real</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-colors"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Criar Primeiro Webhook
              </button>
            </div>
          ) : (
            webhooks.map((webhook) => (
              <motion.div
                key={webhook.id}
                layout
                className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 hover:shadow-lg transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {webhook.name || 'Webhook'}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(webhook.active)}`}>
                        {webhook.active ? 'Ativo' : 'Inativo'}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(webhook.priority)}`}>
                        Prioridade {webhook.priority}
                      </span>
                    </div>
                    
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center">
                        <span className="font-medium w-16">URL:</span>
                        <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">
                          {webhook.url}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-medium w-16">Eventos:</span>
                        <div className="flex flex-wrap gap-1">
                          {webhook.events.map((event, index) => (
                            <span key={index} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                              {event}
                            </span>
                          ))}
                        </div>
                      </div>
                      {testResults[webhook.id] && (
                        <div className="flex items-center">
                          <span className="font-medium w-16">Teste:</span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            testResults[webhook.id].success 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
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
                      className="p-2 text-purple-600 hover:bg-purple-100 rounded-xl transition-colors disabled:opacity-50"
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
                      className={`p-2 rounded-xl transition-colors ${
                        webhook.active 
                          ? 'text-yellow-600 hover:bg-yellow-100' 
                          : 'text-green-600 hover:bg-green-100'
                      }`}
                      title={webhook.active ? 'Desativar' : 'Ativar'}
                    >
                      {webhook.active ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
                    </button>
                    
                    <button
                      onClick={() => startEdit(webhook)}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors"
                      title="Editar"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    
                    <button
                      onClick={() => deleteWebhook(webhook.id)}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-xl transition-colors"
                      title="Remover"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Create/Edit Modal */}
        <AnimatePresence>
          {(showCreateModal || editingWebhook) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl border border-white/20"
              >
                <h3 className="text-xl font-bold text-gray-900 mb-6">
                  {editingWebhook ? 'Editar Webhook' : 'Novo Webhook'}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome (opcional)
                    </label>
                    <input
                      type="text"
                      value={webhookForm.name}
                      onChange={(e) => setWebhookForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Webhook Principal"
                      className="w-full px-4 py-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      URL do Webhook *
                    </label>
                    <input
                      type="url"
                      value={webhookForm.url}
                      onChange={(e) => setWebhookForm(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="https://meusite.com/webhook"
                      className="w-full px-4 py-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Prioridade
                    </label>
                    <select
                      value={webhookForm.priority}
                      onChange={(e) => setWebhookForm(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Webhook ativo</span>
                    </label>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-2xl">
                    <div className="flex items-center mb-2">
                      <CogIcon className="h-5 w-5 text-blue-600 mr-2" />
                      <span className="text-sm font-medium text-blue-900">Configuração Padrão</span>
                    </div>
                    <p className="text-xs text-blue-700">
                      O evento 'messages.upsert' será configurado automaticamente para receber todas as mensagens.
                    </p>
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
                    className="flex-1 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {editingWebhook ? 'Atualizar' : 'Criar'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingWebhook(null);
                      resetForm();
                    }}
                    className="flex-1 py-3 bg-gray-300 text-gray-700 rounded-2xl hover:bg-gray-400 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Info */}
        {webhooks.length > 0 && (
          <div className="mt-6 p-4 bg-yellow-50 rounded-2xl border border-yellow-200">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mr-2" />
              <span className="text-sm text-yellow-800">
                Máximo de 3 webhooks por sessão. {3 - webhooks.length} restante(s).
              </span>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}