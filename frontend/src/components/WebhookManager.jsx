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
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';

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
    events: ['messages.upsert', 'connection.update']
  });
  const [testingWebhook, setTestingWebhook] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [token, setToken] = useState('');
  const [tokenLoading, setTokenLoading] = useState(true);

  // Performance mode - consistent with Dashboard
  const [performanceMode] = useState(() => {
    const isLowEnd = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    const isSlowConnection = navigator.connection && 
      (navigator.connection.effectiveType === 'slow-2g' || 
       navigator.connection.effectiveType === '2g' || 
       navigator.connection.effectiveType === '3g');
    const isOldBrowser = !CSS.supports('backdrop-filter', 'blur(1px)');
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return isLowEnd || isSlowConnection || isOldBrowser || isMobile;
  });

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
      events: ['messages.upsert', 'connection.update']
    });
  };

  const startEdit = (webhook) => {
    setEditingWebhook(webhook.id);
    setWebhookForm({
      name: webhook.name || '',
      url: webhook.url,
      active: webhook.active,
      priority: webhook.priority,
      events: webhook.events || ['messages.upsert', 'connection.update']
    });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 1: return 'text-red-400 bg-red-500/20';
      case 2: return 'text-yellow-400 bg-yellow-500/20';
      case 3: return 'text-green-400 bg-green-500/20';
      default: return 'text-white/70 bg-white/10';
    }
  };

  const getStatusColor = (active) => {
    return active ? 'text-green-400 bg-green-500/20' : 'text-white/70 bg-white/10';
  };

  if (tokenLoading || loading) {
    return (
      <div className="fixed inset-0 bg-black/60  flex items-center justify-center z-50">
        <div className={`${performanceMode ? 'glass-performance' : 'glass-card'} p-8 max-w-md w-full mx-4 rounded-xl`}>
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
      <div className="fixed inset-0 bg-black/60  flex items-center justify-center z-50">
        <div className={`${performanceMode ? 'glass-performance' : 'glass-card'} p-8 max-w-md w-full mx-4 rounded-xl`}>
          <div className="flex items-center justify-center text-center">
            <div>
              <ExclamationTriangleIcon className="h-16 w-16 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Erro de Autenticação</h3>
              <p className="text-white/70 mb-6">
                Não foi possível obter o token de acesso. O token pode ter expirado ou sido excluído.
                <br />
                <span className="text-sm">Crie um novo token na aba "Tokens de API".</span>
              </p>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors"
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
      <motion.div 
        className="fixed inset-0 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ 
            duration: 0.4, 
            ease: [0.16, 1, 0.3, 1],
            scale: { type: "spring", damping: 20, stiffness: 300 }
          }}
          className={`relative h-full ${performanceMode ? 'glass-performance' : 'glass-card'} overflow-y-auto modal-scroll`}
          style={{
            borderRadius: '20px',
            margin: '12px',
            height: 'calc(100vh - 24px)'
          }}
        >
        {/* Header */}
        <div className={`sticky top-0 ${performanceMode ? 'glass-performance' : 'glass-performance'} border-b border-white/10 px-4 md:px-8 py-4 md:py-6 z-10`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <LinkIcon className="h-8 w-8 text-blue-400 mr-3" />
              <div>
                <h2 className="text-2xl font-bold text-white">Gerenciar Webhooks</h2>
                <p className="text-white/70">Sessão: {sessionId}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                onClick={() => setShowCreateModal(true)}
                disabled={webhooks.length >= 3}
                className="flex items-center px-4 py-2 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                whileHover={performanceMode ? {} : { scale: 1.05 }}
                whileTap={performanceMode ? {} : { scale: 0.95 }}
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Novo Webhook
              </motion.button>
              <motion.button
                onClick={onClose}
                className="relative w-7 h-7 rounded-full bg-red-500/80 hover:bg-red-500 transition-all duration-200 flex items-center justify-center group"
                whileHover={{ 
                  scale: 1.15,
                  rotate: [0, -10, 10, 0],
                  transition: { 
                    type: "spring", 
                    damping: 8, 
                    stiffness: 400,
                    rotate: { duration: 0.4, ease: "easeInOut" }
                  }
                }}
                whileTap={{ 
                  scale: 0.85,
                  rotate: 180,
                  transition: { 
                    type: "spring", 
                    damping: 12, 
                    stiffness: 600,
                    rotate: { duration: 0.2 }
                  }
                }}
              >
                <div className="absolute inset-0 rounded-full border-2 border-red-400 group-hover:border-red-300" />
                <XCircleIcon className="h-4 w-4 text-white" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-8">

          {/* Webhooks List */}
          <div className="space-y-4">
            {webhooks.length === 0 ? (
              <motion.div 
                className="text-center py-12"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <LinkIcon className="h-16 w-16 text-white/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Nenhum webhook configurado</h3>
                <p className="text-white/70 mb-6">Configure webhooks para receber eventos em tempo real</p>
                <motion.button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-6 py-3 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 transition-all duration-200"
                  whileHover={performanceMode ? {} : { scale: 1.05 }}
                  whileTap={performanceMode ? {} : { scale: 0.95 }}
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Criar Primeiro Webhook
                </motion.button>
              </motion.div>
            ) : (
              webhooks.map((webhook, index) => (
                <motion.div
                  key={webhook.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ 
                    delay: index * 0.1,
                    duration: 0.3,
                    ease: [0.16, 1, 0.3, 1]
                  }}
                  className={`${performanceMode ? 'glass-performance' : 'glass-performance'} rounded-xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-[1.01]`}
                >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-white">
                        {webhook.name || 'Webhook'}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(webhook.active)}`}>
                        {webhook.active ? 'Ativo' : 'Inativo'}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(webhook.priority)}`}>
                        Prioridade {webhook.priority}
                      </span>
                    </div>
                    
                    <div className="space-y-2 text-sm text-white/70">
                      <div className="flex items-center">
                        <span className="font-medium w-16">URL:</span>
                        <span className="font-mono bg-white/10 px-2 py-1 rounded text-xs text-white/90">
                          {webhook.url}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-medium w-16">Eventos:</span>
                        <div className="flex flex-wrap gap-1">
                          {webhook.events.map((event, index) => (
                            <span key={index} className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs">
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
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {testResults[webhook.id].success ? 'Sucesso' : 'Falha'} 
                            ({testResults[webhook.id].status})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <motion.button
                      onClick={() => testWebhook(webhook.id)}
                      disabled={testingWebhook === webhook.id}
                      className="p-2 text-purple-400 hover:bg-purple-500/20 rounded-xl transition-colors disabled:opacity-50"
                      title="Testar webhook"
                      whileHover={performanceMode ? {} : { scale: 1.1 }}
                      whileTap={performanceMode ? {} : { scale: 0.9 }}
                    >
                      {testingWebhook === webhook.id ? (
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                      ) : (
                        <BoltIcon className="h-5 w-5" />
                      )}
                    </motion.button>
                    
                    <motion.button
                      onClick={() => toggleWebhook(webhook.id)}
                      className={`p-2 rounded-xl transition-colors ${
                        webhook.active 
                          ? 'text-yellow-400 hover:bg-yellow-500/20' 
                          : 'text-green-400 hover:bg-green-500/20'
                      }`}
                      title={webhook.active ? 'Desativar' : 'Ativar'}
                      whileHover={performanceMode ? {} : { scale: 1.1 }}
                      whileTap={performanceMode ? {} : { scale: 0.9 }}
                    >
                      {webhook.active ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
                    </motion.button>
                    
                    <motion.button
                      onClick={() => startEdit(webhook)}
                      className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-xl transition-colors"
                      title="Editar"
                      whileHover={performanceMode ? {} : { scale: 1.1 }}
                      whileTap={performanceMode ? {} : { scale: 0.9 }}
                    >
                      <PencilIcon className="h-5 w-5" />
                    </motion.button>
                    
                    <motion.button
                      onClick={() => deleteWebhook(webhook.id)}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-xl transition-colors"
                      title="Remover"
                      whileHover={performanceMode ? {} : { scale: 1.1 }}
                      whileTap={performanceMode ? {} : { scale: 0.9 }}
                    >
                      <TrashIcon className="h-5 w-5" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
          </div>

          {/* Footer Info */}
          {webhooks.length > 0 && (
            <motion.div 
              className="mt-6 p-4 bg-yellow-500/20 rounded-xl border border-yellow-500/30"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2" />
                <span className="text-sm text-yellow-300">
                  Máximo de 3 webhooks por sessão. {3 - webhooks.length} restante(s).
                </span>
              </div>
            </motion.div>
          )}
        </div>
        </motion.div>
      </motion.div>

      {/* Create/Edit Modal */}
      <AnimatePresence mode="wait">
      {(showCreateModal || editingWebhook) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ 
            duration: 0.2,
            ease: [0.16, 1, 0.3, 1]
          }}
          className="fixed inset-0 bg-black/60  flex items-center justify-center z-[60]"
          onClick={() => {
            setShowCreateModal(false);
            setEditingWebhook(null);
            resetForm();
          }}
        >
          <motion.div
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
              rotateX: 10,
              transition: {
                duration: 0.25,
                ease: [0.4, 0, 1, 1],
                scale: { 
                  type: "spring", 
                  damping: 25, 
                  stiffness: 400,
                  mass: 0.8
                }
              }
            }}
            transition={{ 
              duration: 0.4, 
              ease: [0.16, 1, 0.3, 1],
              scale: { 
                type: "spring", 
                damping: 18, 
                stiffness: 300,
                mass: 0.9
              }
            }}
            className={`${performanceMode ? 'glass-performance' : 'glass-card'} p-8 max-w-md w-full mx-4 rounded-xl`}
            onClick={(e) => e.stopPropagation()}
            style={{ perspective: 1000 }}
          >
                <h3 className="text-xl font-bold text-gray-900 mb-6">
                  {editingWebhook ? 'Editar Webhook' : 'Novo Webhook'}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Nome (opcional)
                    </label>
                    <input
                      type="text"
                      value={webhookForm.name}
                      onChange={(e) => setWebhookForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Webhook Principal"
                      className={`w-full px-4 py-3 ${performanceMode ? 'glass-performance' : 'glass-performance'} rounded-xl text-white placeholder-white/50 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-white/10 focus:border-blue-400`}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      URL do Webhook *
                    </label>
                    <input
                      type="url"
                      value={webhookForm.url}
                      onChange={(e) => setWebhookForm(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="https://meusite.com/webhook"
                      className={`w-full px-4 py-3 ${performanceMode ? 'glass-performance' : 'glass-performance'} rounded-xl text-white placeholder-white/50 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-white/10 focus:border-blue-400`}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Prioridade
                    </label>
                    <select
                      value={webhookForm.priority}
                      onChange={(e) => setWebhookForm(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                      className={`w-full px-4 py-3 ${performanceMode ? 'glass-performance' : 'glass-performance'} rounded-xl text-white placeholder-white/50 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-white/10 focus:border-blue-400`}
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
                        className="rounded border-white/30 text-blue-400 focus:ring-blue-500 bg-white/10"
                      />
                      <span className="ml-2 text-sm text-white/90">Webhook ativo</span>
                    </label>
                  </div>

                  <div className="bg-blue-500/20 p-4 rounded-xl border border-blue-500/30">
                    <div className="flex items-center mb-2">
                      <CogIcon className="h-5 w-5 text-blue-600 mr-2" />
                      <span className="text-sm font-medium text-blue-300">Eventos Padrão</span>
                    </div>
                    <p className="text-xs text-blue-300">
                      Os eventos 'messages.upsert' e 'connection.update' serão configurados automaticamente para receber mensagens e mudanças de conexão.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  <motion.button
                    onClick={() => {
                      if (editingWebhook) {
                        updateWebhook(editingWebhook);
                      } else {
                        createWebhook();
                      }
                    }}
                    disabled={!webhookForm.url}
                    className="flex-1 py-3 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 border border-blue-500/30"
                    whileHover={{ 
                      scale: 1.05,
                      transition: { type: "spring", damping: 10, stiffness: 400 }
                    }}
                    whileTap={{ 
                      scale: 0.95,
                      transition: { type: "spring", damping: 15, stiffness: 600 }
                    }}
                  >
                    {editingWebhook ? 'Atualizar' : 'Criar'}
                  </motion.button>
                  <motion.button
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingWebhook(null);
                      resetForm();
                    }}
                    className={`flex-1 py-3 ${performanceMode ? 'glass-performance' : 'glass-performance'} rounded-xl text-white/70 hover:text-white transition-all duration-200 border border-white/10`}
                    whileHover={{ 
                      scale: 1.05,
                      transition: { type: "spring", damping: 10, stiffness: 400 }
                    }}
                    whileTap={{ 
                      scale: 0.95,
                      transition: { type: "spring", damping: 15, stiffness: 600 }
                    }}
                  >
                    Cancelar
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
    </>
  );
  }