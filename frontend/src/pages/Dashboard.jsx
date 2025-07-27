import {
  ArrowRightOnRectangleIcon,
  BellIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  ClockIcon,
  CogIcon,
  DocumentIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  FilmIcon,
  KeyIcon,
  LinkIcon,
  PaperAirplaneIcon,
  PhoneIcon,
  PhotoIcon,
  PlusIcon,
  QrCodeIcon,
  ServerIcon,
  TrashIcon,
  UserGroupIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
  XCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import WebhookManager from '../components/WebhookManager';
import MediaManager from '../components/MediaManager';
import { getApiUrl, apiRequest } from '../utils/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export default function Dashboard() {
  // Estado principal
  const [activeTab, setActiveTab] = useState('overview');
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    activeSessions: 0,
    totalMessages: 0,
    totalGroups: 0,
    activeWebhooks: 0,
    uptime: '0h 0m',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [apiTokens, setApiTokens] = useState([]);
  const [userSessions, setUserSessions] = useState([]);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [showCreateTokenModal, setShowCreateTokenModal] = useState(false);
  const [tokenForm, setTokenForm] = useState({ name: '', expiresIn: 'never' });

  // Funções de formatação e validação de número brasileiro
  const formatBrazilianPhone = (value) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');
    
    // Limita a 11 dígitos (55 + DDD + número)
    const limited = numbers.slice(0, 13);
    
    // Aplica formatação: +55 (11) 99999-9999
    if (limited.length === 0) return '';
    if (limited.length <= 2) return `+${limited}`;
    if (limited.length <= 4) return `+${limited.slice(0, 2)} (${limited.slice(2)}`;
    if (limited.length <= 9) return `+${limited.slice(0, 2)} (${limited.slice(2, 4)}) ${limited.slice(4)}`;
    if (limited.length <= 13) {
      return `+${limited.slice(0, 2)} (${limited.slice(2, 4)}) ${limited.slice(4, 9)}-${limited.slice(9)}`;
    }
    
    return `+${limited.slice(0, 2)} (${limited.slice(2, 4)}) ${limited.slice(4, 9)}-${limited.slice(9, 13)}`;
  };

  const validateBrazilianPhone = (phoneNumber) => {
    const numbers = phoneNumber.replace(/\D/g, '');
    
    // Deve ter exatamente 13 dígitos (55 + 11 dígitos do número)
    if (numbers.length !== 13) return false;
    
    // Deve começar com 55 (código do Brasil)
    if (!numbers.startsWith('55')) return false;
    
    // DDD deve estar entre 11 e 99
    const ddd = parseInt(numbers.slice(2, 4));
    if (ddd < 11 || ddd > 99) return false;
    
    // Número deve ter 9 dígitos e começar com 9
    const phoneNum = numbers.slice(4);
    if (phoneNum.length !== 9 || !phoneNum.startsWith('9')) return false;
    
    return true;
  };

  const getPhoneValidationMessage = (phoneNumber) => {
    const numbers = phoneNumber.replace(/\D/g, '');
    
    if (numbers.length === 0) return 'Digite o número do telefone';
    if (numbers.length < 2) return 'Digite o código do país (55)';
    if (!numbers.startsWith('55')) return 'Código do país deve ser 55';
    if (numbers.length < 4) return 'Digite o DDD (11-99)';
    
    const ddd = parseInt(numbers.slice(2, 4));
    if (ddd < 11 || ddd > 99) return 'DDD inválido (deve ser entre 11-99)';
    
    if (numbers.length < 13) return `Digite mais ${13 - numbers.length} dígitos`;
    if (numbers.length === 13) {
      const phoneNum = numbers.slice(4);
      if (!phoneNum.startsWith('9')) return 'Número deve começar com 9';
      return '✓ Número válido';
    }
    
    return 'Número muito longo';
  };

  // Função para regenerar código de pareamento
  const regeneratePairingCode = async () => {
    if (!pairingCodeData || isRegenerating) return;
    
    setIsRegenerating(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

      // Get active token for API authentication (mesma lógica da createWhatsAppSession)
      let authHeaders = {
        'Content-Type': 'application/json',
      };

      const tokensResponse = await fetch(`${apiUrl}/api/management/tokens/list`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (tokensResponse.ok) {
        const tokensResult = await tokensResponse.json();
        if (tokensResult.success && tokensResult.tokens) {
          const activeToken = tokensResult.tokens.find(
            (token) => token.isActive && !token.isExpired
          );

          if (activeToken) {
            try {
              // Get the full token
              const tokenResponse = await fetch(
                `${apiUrl}/api/management/tokens/${activeToken._id}/full`,
                {
                  method: 'GET',
                  credentials: 'include',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                }
              );

              if (tokenResponse.ok) {
                const tokenResult = await tokenResponse.json();
                if (tokenResult.success && tokenResult.token) {
                  authHeaders.Authorization = `Bearer ${tokenResult.token}`;
                }
              }
            } catch (error) {
              console.log('Error fetching token for regenerating pairing code:', error);
            }
          }
        }
      }

      const response = await fetch(`${apiUrl}/api/baileys/session/create`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          sessionId: pairingCodeData.sessionId,
          pairingMethod: 'code',
          phoneNumber: pairingCodeData.phoneNumber.replace(/\D/g, ''),
          proxy: null,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success && result.pairingCode) {
        setPairingCodeData(prev => ({
          ...prev,
          code: result.pairingCode
        }));
        setTimeRemaining(60); // Reset timer
        setCodeCopied(false);
        setShowRegeneratedMessage(true);
        setTimeout(() => setShowRegeneratedMessage(false), 3000);
      } else {
        console.error('Erro ao regenerar código:', result.message);
      }
    } catch (error) {
      console.error('Erro ao regenerar código de pareamento:', error);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Função para formatar tempo restante
  const formatTimeRemaining = (seconds) => {
    return `${seconds}s`;
  };

  // Função para formatar código de pareamento (XXXX-XXXX)
  const formatPairingCode = (code) => {
    if (!code || code.length !== 8) return code;
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  };

  // Performance mode - detecta dispositivos menos potentes
  const [performanceMode, setPerformanceMode] = useState(() => {
    const isLowEnd =
      navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    const isSlowConnection =
      navigator.connection &&
      (navigator.connection.effectiveType === 'slow-2g' ||
        navigator.connection.effectiveType === '2g' ||
        navigator.connection.effectiveType === '3g');
    const isOldBrowser = !CSS.supports('backdrop-filter', 'blur(1px)');
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
    return isLowEnd || isSlowConnection || isOldBrowser || isMobile;
  });

  // Modal states
  const [showNewSession, setShowNewSession] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [loadingQrCode, setLoadingQrCode] = useState(false);
  const [showCreateSessionModal, setShowCreateSessionModal] = useState(false);
  const [sessionForm, setSessionForm] = useState({ 
    sessionId: '',
    pairingMethod: 'qr', // 'qr' ou 'code'
    phoneNumber: '',
    proxy: {
      enabled: false,
      type: 'http',
      host: '',
      port: '',
      username: '',
      password: ''
    }
  });
  const [creatingSession, setCreatingSession] = useState(false);
  const [showPairingCodeModal, setShowPairingCodeModal] = useState(false);
  const [pairingCodeData, setPairingCodeData] = useState(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(60); // 60 segundos (mais realista)
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegeneratedMessage, setShowRegeneratedMessage] = useState(false);

  // Timer effect for pairing code
  useEffect(() => {
    let timer;
    if (showPairingCodeModal && timeRemaining > 0 && !isRegenerating) {
      timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Tempo esgotado, regenerar automaticamente
            regeneratePairingCode();
            return 60; // Reset para 60 segundos
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showPairingCodeModal, timeRemaining, isRegenerating]);

  // Reset timer when modal opens/closes
  useEffect(() => {
    if (showPairingCodeModal) {
      setTimeRemaining(60);
      setIsRegenerating(false);
      setShowRegeneratedMessage(false);
    } else {
      // Reset all states when modal closes
      setTimeRemaining(60);
      setIsRegenerating(false);
      setShowRegeneratedMessage(false);
      setCodeCopied(false);
    }
  }, [showPairingCodeModal]);

  // Webhook management state
  const [showWebhookManager, setShowWebhookManager] = useState(false);
  const [selectedSessionForWebhooks, setSelectedSessionForWebhooks] =
    useState(null);

  // Media management state
  const [showMediaManager, setShowMediaManager] = useState(false);

  // Session configuration state
  const [showSessionConfig, setShowSessionConfig] = useState(false);
  const [selectedSessionForConfig, setSelectedSessionForConfig] =
    useState(null);
  const [selectedTokenForExamples, setSelectedTokenForExamples] = useState('');
  const [fullTokenForExamples, setFullTokenForExamples] = useState('');

  // Carregar dados reais do usuário da API
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await apiRequest('/api/management/auth/profile', {
          method: 'GET'
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data.user) {
            const userData = result.data.user;
            setUser(userData);

            // Atualizar stats com dados reais do usuário
            setStats({
              totalSessions: userData.stats?.totalSessions || 0,
              activeSessions: userData.stats?.activeConnections || 0,
              totalMessages: userData.stats?.messagesCount || 0,
              totalGroups: 0, // Will be updated when we fetch groups data
              activeWebhooks: 0, // Will be updated when we fetch webhooks data
              uptime: '0h 0m', // Will be calculated from session data
            });
          } else {
            console.error('Erro ao carregar perfil:', result.message);
            // Fallback para dados de exemplo
            setUser({
              name: 'Usuário Demo',
              email: 'demo@whatsapp-api.com',
              role: 'user',
            });
          }
        } else if (response.status === 401) {
          // Usuário não autenticado, redirecionar para login
          console.log('Usuário não autenticado, redirecionando...');
          window.location.href = '/login';
          return;
        } else {
          console.error('Erro ao buscar perfil do usuário:', response.status);
          // Fallback para dados de exemplo
          setUser({
            name: 'Usuário Demo',
            email: 'demo@whatsapp-api.com',
            role: 'user',
          });
        }
      } catch (error) {
        console.error('Erro de conexão ao buscar perfil:', error);
        // Fallback para dados de exemplo em caso de erro
        setUser({
          name: 'Usuário Demo',
          email: 'demo@whatsapp-api.com',
          role: 'user',
        });
      }
    };

    const fetchApiTokens = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const response = await fetch(`${apiUrl}/api/management/tokens/list`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setApiTokens(result.tokens || []);
            setUserSessions(result.sessions || []); // Store sessions with QR codes
          }
        }
      } catch (error) {
        console.error('Erro ao carregar tokens:', error);
      }
    }; // Executar todas as funções
    const initializeData = async () => {
      await fetchUserProfile();
      await fetchApiTokens(); // Load tokens first to get userSessions
      await fetchRealSessions(); // Then load all sessions including userSessions
      setIsLoading(false); // Set loading to false after everything is loaded
    };

    initializeData();

    // Auto-refresh das sessões com intervalo baseado no performance mode
    const refreshInterval = performanceMode ? 30000 : 15000; // 30s em modo performance, 15s normal

    const interval = setInterval(async () => {
      // Só atualiza se a página estiver visível para economizar recursos
      if (!document.hidden) {
        await fetchApiTokens(); // Refresh tokens to get updated userSessions
        await fetchRealSessions(); // Then refresh all sessions
      }
    }, refreshInterval);

    // Cleanup do interval
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected':
        return 'text-green-400 bg-green-500/10 border-green-500/30';
      case 'connecting':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'disconnected':
        return 'text-red-400 bg-red-500/10 border-red-500/30';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected':
        return <CheckCircleIcon className="w-4 h-4" />;
      case 'connecting':
        return <ClockIcon className="w-4 h-4 animate-spin" />;
      case 'disconnected':
        return <XCircleIcon className="w-4 h-4" />;
      default:
        return <ExclamationTriangleIcon className="w-4 h-4" />;
    }
  };

  const tabs = [
    { id: 'overview', name: 'Visão Geral', icon: ChartBarIcon },
    { id: 'ai-agent', name: 'Agente de IA', icon: ServerIcon, exclusive: true },
    { id: 'sessions', name: 'Sessões', icon: PhoneIcon },
    { id: 'tokens', name: 'Tokens API', icon: KeyIcon },
    { id: 'messages', name: 'Mensagens', icon: ChatBubbleLeftRightIcon },
    { id: 'groups', name: 'Grupos', icon: UserGroupIcon },
    { id: 'webhooks', name: 'Webhooks', icon: BellIcon },
    { id: 'media', name: 'Mídia', icon: PhotoIcon },
    { id: 'settings', name: 'Configurações', icon: CogIcon },
  ];

  const handleLogout = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

      // Fazer logout na API
      await fetch(`${apiUrl}/api/management/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Erro ao fazer logout na API:', error);
    } finally {
      // Limpar dados locais e redirecionar independentemente do resultado da API
      sessionStorage.removeItem('user');
      window.location.href = '/login';
    }
  };

  const generateApiToken = async () => {
    try {
      const { name, expiresIn } = tokenForm;

      if (!name.trim()) {
        return; // Validation handled by disabled button
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/management/tokens/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          expiresIn: expiresIn,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setNewToken(result.token);
          setShowTokenModal(true);
          setShowCreateTokenModal(false);
          setTokenForm({ name: '', expiresIn: 'never' });
          // Reload tokens list
          const tokensResponse = await fetch(
            `${apiUrl}/api/management/tokens/list`,
            {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );
          if (tokensResponse.ok) {
            const tokensResult = await tokensResponse.json();
            if (tokensResult.success) {
              setApiTokens(tokensResult.tokens || []);
              setUserSessions(tokensResult.sessions || []);
            }
          }
        }
      }
    } catch (error) {
      console.error('Erro ao gerar token:', error);
    }
  };

  const revokeApiToken = async (tokenId) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(
        `${apiUrl}/api/management/tokens/${tokenId}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        // Reload tokens list
        const tokensResponse = await fetch(
          `${apiUrl}/api/management/tokens/list`,
          {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
        if (tokensResponse.ok) {
          const tokensResult = await tokensResponse.json();
          if (tokensResult.success) {
            setApiTokens(tokensResult.tokens || []);
            setUserSessions(tokensResult.sessions || []);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao revogar token:', error);
    }
  };

  const getActiveApiToken = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const tokensResponse = await fetch(
        `${apiUrl}/api/management/tokens/list`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (tokensResponse.ok) {
        const tokensResult = await tokensResponse.json();
        if (tokensResult.success && tokensResult.tokens.length > 0) {
          const activeToken = tokensResult.tokens.find(
            (token) => token.isActive && !token.isExpired
          );

          if (activeToken) {
            // Get the full token
            const tokenResponse = await fetch(
              `${apiUrl}/api/management/tokens/${activeToken._id}/full`,
              {
                method: 'GET',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                },
              }
            );

            if (tokenResponse.ok) {
              const tokenResult = await tokenResponse.json();
              if (tokenResult.success && tokenResult.token) {
                return tokenResult.token;
              }
            }
          }
        }
      }
      return null;
    } catch (error) {
      console.error('Erro ao obter token ativo:', error);
      return null;
    }
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      if (
        !confirm(
          'Tem certeza que deseja excluir esta sessão? Esta ação não pode ser desfeita.'
        )
      ) {
        return;
      }

      // Get active API token
      const token = await getActiveApiToken();
      if (!token) {
        alert(
          'Erro: Nenhum token de API ativo encontrado. Crie um token primeiro.'
        );
        return;
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(
        `${apiUrl}/api/baileys/session/${sessionId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Close the session config modal
          setShowSessionConfig(false);
          setSelectedSessionForConfig(null);

          // Reload sessions to reflect the deletion
          await fetchRealSessions();
          await fetchApiTokens();

          console.log('Sessão excluída com sucesso');
        } else {
          console.error('Erro ao excluir sessão:', result.message);
          alert('Erro ao excluir sessão: ' + result.message);
        }
      } else {
        console.error('Erro HTTP ao excluir sessão:', response.status);
        alert('Erro ao excluir sessão. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao excluir sessão:', error);
      alert('Erro ao excluir sessão. Verifique sua conexão e tente novamente.');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here
    });
  };

  const fetchQRCodeForSession = async (sessionId) => {
    setLoadingQrCode(true);
    setQrCodeData(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

      // Try management API first
      const managementResponse = await fetch(
        `${apiUrl}/api/management/sessions/list`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (managementResponse.ok) {
        const managementResult = await managementResponse.json();
        if (managementResult.success) {
          const sessionData = managementResult.sessions.find(
            (s) => s.sessionId === sessionId
          );
          if (sessionData && (sessionData.qrCode || sessionData.qrCodeImage)) {
            setQrCodeData({
              qrCode: sessionData.qrCode,
              qrCodeImage: sessionData.qrCodeImage,
              hasQrCode: sessionData.hasQrCode,
            });
            setLoadingQrCode(false);
            return;
          }
        }
      }

      // Try to get an active API token and use Baileys API as fallback
      const tokensResponse = await fetch(
        `${apiUrl}/api/management/tokens/list`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (tokensResponse.ok) {
        const tokensResult = await tokensResponse.json();
        if (tokensResult.success && tokensResult.tokens.length > 0) {
          const activeToken = tokensResult.tokens.find(
            (token) => token.isActive && !token.isExpired
          );

          if (activeToken) {
            // Get the full token
            const tokenResponse = await fetch(
              `${apiUrl}/api/management/tokens/${activeToken._id}/full`,
              {
                method: 'GET',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                },
              }
            );

            if (tokenResponse.ok) {
              const tokenResult = await tokenResponse.json();
              if (tokenResult.success && tokenResult.token) {
                // Get session status from Baileys API
                const statusResponse = await fetch(
                  `${apiUrl}/api/baileys/session/${sessionId}/status`,
                  {
                    method: 'GET',
                    headers: {
                      Authorization: `Bearer ${tokenResult.token}`,
                      'Content-Type': 'application/json',
                    },
                  }
                );

                if (statusResponse.ok) {
                  const statusResult = await statusResponse.json();
                  if (statusResult.success && statusResult.hasQrCode) {
                    // Try to regenerate QR if no current QR code
                    const regenerateResponse = await fetch(
                      `${apiUrl}/api/baileys/session/${sessionId}/regenerate-qr`,
                      {
                        method: 'POST',
                        headers: {
                          Authorization: `Bearer ${tokenResult.token}`,
                          'Content-Type': 'application/json',
                        },
                      }
                    );

                    if (regenerateResponse.ok) {
                      const regenerateResult = await regenerateResponse.json();
                      if (regenerateResult.success) {
                        setQrCodeData({
                          qrCode: regenerateResult.qrCode,
                          qrCodeImage: regenerateResult.qrCodeImage,
                          hasQrCode: true,
                        });
                        setLoadingQrCode(false);
                        return;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // If no QR code found
      setQrCodeData({ hasQrCode: false });
      setLoadingQrCode(false);
    } catch (error) {
      console.error('Erro ao buscar QR Code:', error);
      setQrCodeData({ hasQrCode: false });
      setLoadingQrCode(false);
    }
  };
  const createWhatsAppSession = async () => {
    try {
      const { sessionId } = sessionForm;

      if (!sessionId.trim()) {
        alert('Por favor, digite um ID para a sessão');
        return;
      }

      if (sessionForm.pairingMethod === 'code') {
        if (!sessionForm.phoneNumber.trim()) {
          alert('Por favor, digite o número de telefone para pareamento por código');
          return;
        }
        if (!validateBrazilianPhone(sessionForm.phoneNumber)) {
          alert('Por favor, digite um número de telefone brasileiro válido');
          return;
        }
      }

      setCreatingSession(true);

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

      // Get active token for API authentication
      let authHeaders = {
        'Content-Type': 'application/json',
      };

      const tokensResponse = await fetch(`${apiUrl}/api/management/tokens/list`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (tokensResponse.ok) {
        const tokensResult = await tokensResponse.json();
        if (tokensResult.success && tokensResult.tokens.length > 0) {
          const activeToken = tokensResult.tokens.find(
            (token) => token.isActive && !token.isExpired
          );
          
          if (activeToken) {
            try {
              const tokenResponse = await fetch(
                `${apiUrl}/api/management/tokens/${activeToken._id}/full`,
                {
                  method: 'GET',
                  credentials: 'include',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                }
              );

              if (tokenResponse.ok) {
                const tokenResult = await tokenResponse.json();
                if (tokenResult.success && tokenResult.token) {
                  authHeaders.Authorization = `Bearer ${tokenResult.token}`;
                }
              }
            } catch (error) {
              console.log('Error fetching token for session creation:', error);
            }
          }
        }
      }

      // Create session using token authentication
      const response = await fetch(`${apiUrl}/api/baileys/session/create`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          sessionId: sessionId.trim(),
          pairingMethod: sessionForm.pairingMethod,
          phoneNumber: sessionForm.pairingMethod === 'code' ? sessionForm.phoneNumber.replace(/\D/g, '') : null,
          proxy: sessionForm.proxy.enabled ? sessionForm.proxy : null,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Session created successfully
        setShowCreateSessionModal(false);
        setSessionForm({ 
          sessionId: '',
          pairingMethod: 'qr',
          phoneNumber: '',
          proxy: {
            enabled: false,
            type: 'http',
            host: '',
            port: '',
            username: '',
            password: ''
          }
        });

        // Show QR code if available
        if (result.qrCode) {
          setSelectedSession({
            id: sessionId,
            name: sessionId,
            qrCode: result.qrCode,
            qrCodeImage: result.qrCodeImage,
          });
          setShowQRCode(true);
        }

        // Show pairing code if available
        if (result.pairingCode) {
          setPairingCodeData({
            code: result.pairingCode,
            sessionId: sessionId,
            phoneNumber: formatBrazilianPhone(sessionForm.phoneNumber.replace(/\D/g, ''))
          });
          setShowPairingCodeModal(true);
        } else if (result.qrCode) {
          alert('Sessão WhatsApp criada com sucesso! QR Code gerado para escaneamento.');
        } else {
          alert('Sessão WhatsApp criada com sucesso!');
        }

        // Refresh sessions list
        fetchRealSessions();
      } else {
        alert(`Erro ao criar sessão: ${result.message}`);
      }
    } catch (error) {
      console.error('Erro ao criar sessão:', error);
      alert('Erro ao criar sessão. Verifique a conexão e tente novamente.');
    } finally {
      setCreatingSession(false);
    }
  };

  const fetchRealSessions = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

      // Try to fetch from the Baileys API directly (requires token) first
      const tokensResponse = await fetch(
        `${apiUrl}/api/management/tokens/list`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      let baileysSessionsData = [];
      let activeToken = null;

      if (tokensResponse.ok) {
        const tokensResult = await tokensResponse.json();
        if (tokensResult.success && tokensResult.tokens.length > 0) {
          // Get first active token to fetch Baileys sessions
          activeToken = tokensResult.tokens.find(
            (token) => token.isActive && !token.isExpired
          );
          if (activeToken) {
            try {
              // Get the full token to make Baileys API request
              const tokenResponse = await fetch(
                `${apiUrl}/api/management/tokens/${activeToken._id}/full`,
                {
                  method: 'GET',
                  credentials: 'include',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                }
              );

              if (tokenResponse.ok) {
                const tokenResult = await tokenResponse.json();
                if (tokenResult.success && tokenResult.token) {
                  // Fetch sessions from Baileys API
                  const baileysResponse = await fetch(
                    `${apiUrl}/api/baileys/sessions`,
                    {
                      method: 'GET',
                      headers: {
                        Authorization: `Bearer ${tokenResult.token}`,
                        'Content-Type': 'application/json',
                      },
                    }
                  );

                  if (baileysResponse.ok) {
                    const baileysResult = await baileysResponse.json();
                    if (baileysResult.success) {
                      baileysSessionsData = baileysResult.sessions || [];
                    }
                  }
                }
              }
            } catch (error) {
              console.log('Error fetching from Baileys API:', error);
            }
          }
        }
      }

      // Also try the management API sessions endpoint as fallback
      const response = await fetch(`${apiUrl}/api/management/sessions/list`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      let managementSessionsData = [];
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          managementSessionsData = result.sessions || [];
        }
      }

      // Also include userSessions data (from tokens API with QR codes)
      const userSessionsData = userSessions || [];

      // Debug logs
      console.log('📱 Sessions data:', {
        baileysSessionsData: baileysSessionsData.length,
        managementSessionsData: managementSessionsData.length,
        userSessionsData: userSessionsData.length,
        userSessions: userSessions,
        managementSessions: managementSessionsData,
      });

      // Merge and transform sessions from all sources
      // Prioritize managementSessionsData as it has QR code data
      const allSessions = [
        ...baileysSessionsData,
        ...managementSessionsData,
        ...userSessionsData,
      ];
      const uniqueSessions = allSessions.reduce((acc, session) => {
        const sessionId = session.sessionId || session.id;
        if (!acc.find((s) => s.id === sessionId)) {
          const sessionData = {
            id: sessionId,
            name: session.name || sessionId,
            status: session.isConnected
              ? 'connected'
              : session.connectionState === 'connecting' ||
                session.connectionState === 'qr_generated'
              ? 'connecting'
              : 'disconnected',
            lastSeen: session.connectedAt
              ? new Date(session.connectedAt).toLocaleString('pt-BR')
              : session.createdAt
              ? new Date(session.createdAt).toLocaleString('pt-BR')
              : 'N/A',
            messages: session.messageCount || session.messages || 0,
            groups: session.groups || 0,
            webhooks: session.webhooks || 0,
            qrCode: session.qrCode || '',
            qrCodeImage: session.qrCodeImage || '',
            uptime: session.connectedAt
              ? Math.floor(
                  (Date.now() - new Date(session.connectedAt).getTime()) /
                    (1000 * 60)
                ) + 'm'
              : '0m',
            user: session.user,
            lastError: session.lastError,
          };
          // Debug log for QR code data
          if (sessionId === 'ddeed') {
            console.log('🔍 Session ddeed data:', {
              sessionData,
              originalSession: session,
              hasQrCode: !!sessionData.qrCode,
              hasQrCodeImage: !!sessionData.qrCodeImage,
            });
          }
          acc.push(sessionData);
        }
        return acc;
      }, []);
      setSessions(uniqueSessions);

      // Fetch detailed stats for each session if we have an active token
      if (activeToken && uniqueSessions.length > 0) {
        await fetchDetailedStats(uniqueSessions, activeToken);
      } else {
        // Update basic stats based on sessions
        setStats((prev) => ({
          ...prev,
          totalSessions: uniqueSessions.length,
          activeSessions: uniqueSessions.filter((s) => s.status === 'connected')
            .length,
        }));
      }
    } catch (error) {
      console.error('Erro ao buscar sessões:', error);
    }
  };

  const fetchDetailedStats = async (sessions, activeToken) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

      // Get the full token
      const tokenResponse = await fetch(
        `${apiUrl}/api/management/tokens/${activeToken._id}/full`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!tokenResponse.ok) {
        throw new Error('Failed to get full token');
      }

      const tokenResult = await tokenResponse.json();
      if (!tokenResult.success || !tokenResult.token) {
        throw new Error('Invalid token result');
      }

      const token = tokenResult.token;
      let totalMessages = 0;
      let totalGroups = 0;
      let totalWebhooks = 0;

      // Fetch detailed data for each session in parallel - but limit to connected sessions for better performance
      const connectedSessions = sessions.filter(
        (s) => s.status === 'connected'
      );
      const sessionPromises = connectedSessions.map(async (session) => {
        const sessionStats = {
          messages: 0,
          groups: 0,
          webhooks: 0,
        };

        try {
          // Create parallel requests for this session
          const [webhooksResponse, groupsResponse] = await Promise.all([
            // Fetch webhooks for this session
            fetch(`${apiUrl}/api/baileys/session/${session.id}/webhooks`, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }),
            // Fetch groups for this session
            fetch(`${apiUrl}/api/baileys/groups/${session.id}/list`, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }),
          ]);

          // Process webhooks response
          if (webhooksResponse.ok) {
            const webhooksResult = await webhooksResponse.json();
            if (webhooksResult.success) {
              // Count all webhooks (both active and inactive) for total count
              sessionStats.webhooks =
                webhooksResult.total || webhooksResult.webhooks?.length || 0;
            }
          }

          // Process groups response
          if (groupsResponse.ok) {
            const groupsResult = await groupsResponse.json();
            if (groupsResult.success) {
              sessionStats.groups =
                groupsResult.total || groupsResult.groups?.length || 0;
            }
          }

          // For messages, we'll use the messageCount from the session data
          sessionStats.messages = session.messages || 0;
        } catch (error) {
          console.warn(
            `Failed to fetch detailed stats for session ${session.id}:`,
            error
          );
        }

        return sessionStats;
      });

      // Also aggregate from all sessions (including disconnected) for basic counts
      sessions.forEach((session) => {
        totalMessages += session.messages || 0;
      });

      // Wait for all connected session data to be fetched
      const sessionStatsArray = await Promise.all(sessionPromises);

      // Aggregate totals from connected sessions
      sessionStatsArray.forEach((stats) => {
        totalGroups += stats.groups;
        totalWebhooks += stats.webhooks;
      });

      // Update stats with real data
      setStats((prev) => ({
        ...prev,
        totalSessions: sessions.length,
        activeSessions: sessions.filter((s) => s.status === 'connected').length,
        totalMessages,
        totalGroups,
        activeWebhooks: totalWebhooks,
      }));
    } catch (error) {
      console.warn('Failed to fetch detailed stats:', error);
      // Fallback to basic stats
      setStats((prev) => ({
        ...prev,
        totalSessions: sessions.length,
        activeSessions: sessions.filter((s) => s.status === 'connected').length,
      }));
    }
  };

  // Fetch full token for API examples
  const fetchFullTokenForExamples = async (tokenId) => {
    if (!tokenId) {
      setFullTokenForExamples('');
      return;
    }

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const tokenResponse = await fetch(
        `${apiUrl}/api/management/tokens/${tokenId}/full`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!tokenResponse.ok) {
        console.error(
          'Erro ao buscar token completo:',
          tokenResponse.statusText
        );
        setFullTokenForExamples('baileys_erro_ao_carregar_token');
        return;
      }

      const tokenResult = await tokenResponse.json();
      if (!tokenResult.success || !tokenResult.token) {
        console.error('Token inválido retornado pela API');
        setFullTokenForExamples('baileys_token_inválido');
        return;
      }

      setFullTokenForExamples(tokenResult.token);
    } catch (error) {
      console.error('Erro ao buscar token:', error);
      setFullTokenForExamples('baileys_erro_conexão');
    }
  };

  // Effect to fetch token when selection changes
  useEffect(() => {
    fetchFullTokenForExamples(selectedTokenForExamples);
  }, [selectedTokenForExamples]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          className="bg-card border rounded-lg shadow-sm p-8 text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <ServerIcon className="w-8 h-8 text-foreground animate-pulse" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Carregando Dashboard
          </h2>
          <p className="text-muted-foreground">
            Conectando com suas sessões WhatsApp...
          </p>
          <div className="mt-4 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Floating Elements Background - removidos em modo performance */}
      {!performanceMode && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(2)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-gradient-to-r from-blue-500/5 to-purple-500/5"
              style={{
                width: `${100 + i * 50}px`,
                height: `${100 + i * 50}px`,
                left: `${25 + i * 50}%`,
                top: `${25 + i * 50}%`,
              }}
              animate={{
                y: [0, -10, 0],
                opacity: [0.1, 0.2, 0.1],
              }}
              transition={{
                duration: 15 + i * 5,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <motion.header
        className="bg-card border rounded-lg mx-2 md:mx-4 mt-2 md:mt-4 mb-4 md:mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="px-3 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-3 md:space-x-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                <ChatBubbleLeftRightIcon className="w-5 h-5 md:w-6 md:h-6 text-foreground" />
              </div>
              <div>
                <h1 className="text-lg md:text-2xl font-bold text-foreground">
                  FlowChat API
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
                  Gerencie seus fluxos de mensagens
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 md:space-x-4 flex-wrap">
              {/* Performance Mode Toggle */}
              <motion.button
                onClick={() => setPerformanceMode(!performanceMode)}
                className={`px-3 py-2 rounded-lg text-xs transition-colors ${
                  performanceMode
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}
                whileHover={performanceMode ? {} : { scale: 1.02 }}
                whileTap={performanceMode ? {} : { scale: 0.98 }}
                title={
                  performanceMode
                    ? 'Modo Performance Ativo'
                    : 'Ativar Modo Performance'
                }
              >
                {performanceMode ? '🚀 Performance' : '✨ Efeitos'}
              </motion.button>

              {/* Status Indicator */}
              <div
                className={`${
                  'bg-card border rounded-lg'
                } px-4 py-2 rounded-xl`}
              >
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm text-muted-foreground">Sistema Online</span>
                </div>
              </div>

              {/* User Menu */}
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-sm font-medium text-foreground">
                    {user?.name || 'Carregando...'}
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {user?.role === 'user'
                      ? 'Usuário'
                      : user?.role === 'admin'
                      ? 'Administrador'
                      : 'Carregando...'}
                  </div>
                  {user?.email && (
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  )}
                </div>
                <motion.div
                  className="relative cursor-pointer"
                  onClick={() => setShowUserProfile(true)}
                  whileHover={performanceMode ? {} : { scale: 1.05 }}
                  whileTap={performanceMode ? {} : { scale: 0.95 }}
                >
                  {user?.profile?.avatar ? (
                    <img
                      src={user.profile.avatar}
                      alt={user.name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-white/20 hover:border-white/40 transition-colors"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center hover:from-green-300 hover:to-blue-400 transition-colors">
                      <span className="text-foreground font-semibold text-sm">
                        {user?.name
                          ? user.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .substring(0, 2)
                              .toUpperCase()
                          : 'U'}
                      </span>
                    </div>
                  )}
                  {user?.active && (
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 border-2 border-slate-900 rounded-full"></div>
                  )}
                </motion.div>
                <motion.button
                  onClick={handleLogout}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  whileHover={performanceMode ? {} : { scale: 1.05 }}
                  whileTap={performanceMode ? {} : { scale: 0.95 }}
                  title="Sair"
                >
                  <ArrowRightOnRectangleIcon className="w-5 h-5 text-muted-foreground" />
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="flex flex-col lg:flex-row">
        {/* Sidebar Navigation - Desktop */}
        <motion.nav
          className="hidden lg:block lg:w-64 bg-card border rounded-lg mx-2 md:mx-4 mb-4 p-3 md:p-4"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
        
        {/* Mobile Tab Navigation */}
        <motion.nav
          className="lg:hidden bg-card border rounded-lg mx-2 md:mx-4 mb-4 p-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex overflow-x-auto space-x-2 pb-2 scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-foreground border border-blue-500/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium whitespace-nowrap">{tab.name}</span>
                  {tab.exclusive && (
                    <span className="text-xs bg-gradient-to-r from-yellow-400 to-orange-400 text-black px-2 py-0.5 rounded-full font-bold">
                      EXCLUSIVO
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.nav>

          <div className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-foreground border border-blue-500/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.name}</span>
                  {tab.exclusive && (
                    <span className="text-xs bg-gradient-to-r from-yellow-400 to-orange-400 text-black px-2 py-0.5 rounded-full font-bold ml-auto">
                      EXCLUSIVO
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Quick Stats */}
          <div
            className={`mt-8 ${
              'bg-card border rounded-lg'
            } p-4 rounded-xl`}
          >
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              Estatísticas Rápidas
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-foreground/60">Sessões Ativas</span>
                <span className="text-sm font-medium text-green-400">
                  {stats.activeSessions}/{stats.totalSessions}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-foreground/60">Mensagens</span>
                <span className="text-sm font-medium text-blue-400">
                  {stats.totalMessages}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-foreground/60">Uptime</span>
                <span className="text-sm font-medium text-purple-400">
                  {stats.uptime}
                </span>
              </div>
            </div>
          </div>
        </motion.nav>

        {/* Main Content */}
        <motion.main
          className="flex-1 mx-2 md:mx-4 mb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, x: performanceMode ? 0 : 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: performanceMode ? 0 : -10 }}
                transition={{ duration: performanceMode ? 0.1 : 0.2 }}
                className="space-y-6"
              >
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    {
                      label: 'Total de Sessões',
                      value: stats.totalSessions,
                      icon: PhoneIcon,
                      color: 'from-blue-500 to-cyan-500',
                    },
                    {
                      label: 'Mensagens Enviadas',
                      value: stats.totalMessages,
                      icon: PaperAirplaneIcon,
                      color: 'from-green-500 to-emerald-500',
                    },
                    {
                      label: 'Grupos Gerenciados',
                      value: stats.totalGroups,
                      icon: UsersIcon,
                      color: 'from-purple-500 to-pink-500',
                    },
                    {
                      label: 'Webhooks Ativos',
                      value: stats.activeWebhooks,
                      icon: BellIcon,
                      color: 'from-orange-500 to-red-500',
                    },
                  ].map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                      <motion.div
                        key={stat.label}
                        className={`${
                          performanceMode ? 'bg-card border rounded-lg' : 'bg-card border rounded-lg shadow-sm'
                        } p-6 rounded-xl`}
                        initial={{ opacity: 0, y: performanceMode ? 0 : 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: performanceMode ? 0.1 : 0.3,
                          delay: performanceMode ? 0 : index * 0.05,
                        }}
                        whileHover={performanceMode ? {} : { scale: 1.01 }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-muted-foreground text-sm">
                              {stat.label}
                            </p>
                            <p className="text-2xl font-bold text-foreground">
                              {stat.value}
                            </p>
                          </div>
                          <div
                            className={`w-12 h-12 rounded-xl bg-gradient-to-r ${stat.color} flex items-center justify-center`}
                          >
                            <Icon className="w-6 h-6 text-foreground" />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Recent Sessions */}
                <div
                  className={`${
                    performanceMode ? 'bg-card border rounded-lg' : 'bg-card border rounded-lg shadow-sm'
                  } p-6 rounded-xl`}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-foreground">
                      Sessões Recentes
                    </h2>
                    <motion.button
                      onClick={() => setActiveTab('sessions')}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors inline-flex items-center text-sm"
                      whileHover={performanceMode ? {} : { scale: 1.05 }}
                      whileTap={performanceMode ? {} : { scale: 0.95 }}
                    >
                      <EyeIcon className="w-4 h-4 mr-2" />
                      Ver Todas
                    </motion.button>
                  </div>

                  <div className="space-y-4">
                    {sessions.length === 0 ? (
                      <div className="text-center py-8">
                        <PhoneIcon className="w-12 h-12 text-foreground/30 mx-auto mb-4" />
                        <h4 className="text-lg font-semibold text-foreground mb-2">
                          Nenhuma Sessão Ativa
                        </h4>
                        <p className="text-muted-foreground mb-4">
                          Crie sua primeira sessão WhatsApp para começar a
                          enviar mensagens
                        </p>
                        <motion.button
                          onClick={() => setShowCreateSessionModal(true)}
                          className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors inline-flex items-center text-sm"
                          whileHover={performanceMode ? {} : { scale: 1.02 }}
                          whileTap={performanceMode ? {} : { scale: 0.98 }}
                        >
                          <PlusIcon className="w-4 h-4 mr-2" />
                          Criar Primeira Sessão
                        </motion.button>
                      </div>
                    ) : (
                      sessions.slice(0, 3).map((session) => (
                        <motion.div
                          key={session.id}
                          className={`flex items-center justify-between p-4 ${
                            performanceMode
                              ? 'bg-card border rounded-lg'
                              : 'bg-card border rounded-lg'
                          } rounded-xl`}
                          whileHover={performanceMode ? {} : { scale: 1.005 }}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                              <PhoneIcon className="w-5 h-5 text-foreground" />
                            </div>
                            <div>
                              <h3 className="text-foreground font-medium">
                                {session.name}
                              </h3>
                              <p className="text-foreground/60 text-sm">
                                Última atividade: {session.lastSeen}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-4">
                            <div
                              className={`px-3 py-1 rounded-full border ${getStatusColor(
                                session.status
                              )} flex items-center space-x-1`}
                            >
                              {getStatusIcon(session.status)}
                              <span className="text-xs font-medium capitalize">
                                {session.status === 'connected'
                                  ? 'Conectado'
                                  : session.status === 'connecting'
                                  ? 'Conectando'
                                  : 'Desconectado'}
                              </span>
                            </div>

                            <div className="text-right text-sm">
                              <div className="text-muted-foreground">
                                {session.messages} mensagens
                              </div>
                              <div className="text-muted-foreground">
                                {session.groups} grupos
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'ai-agent' && (
              <motion.div
                key="ai-agent"
                initial={{ opacity: 0, x: performanceMode ? 0 : 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: performanceMode ? 0 : -10 }}
                transition={{ duration: performanceMode ? 0.1 : 0.2 }}
                className="space-y-6"
              >
                <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-8 text-center">
                  <ServerIcon className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-foreground mb-2">Agente de IA</h3>
                  <p className="text-muted-foreground mb-6">
                    Configure agentes de IA inteligentes para automatizar suas conversas no WhatsApp
                  </p>
                  <div className="flex items-center justify-center space-x-2 mb-6">
                    <span className="text-xs bg-gradient-to-r from-yellow-400 to-orange-400 text-black px-3 py-1 rounded-full font-bold">
                      EXCLUSIVO
                    </span>
                    <span className="text-xs bg-gradient-to-r from-green-400 to-emerald-400 text-black px-3 py-1 rounded-full font-bold">
                      NOVO
                    </span>
                  </div>
                  <button
                    onClick={() => window.open('/ai-agent', '_blank')}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-foreground px-8 py-3 rounded-lg font-medium transition-all transform hover:scale-105 inline-flex items-center"
                  >
                    <SparklesIcon className="w-5 h-5 mr-2" />
                    Criar Agente de IA
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'sessions' && (
              <motion.div
                key="sessions"
                initial={{ opacity: 0, x: performanceMode ? 0 : 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: performanceMode ? 0 : -10 }}
                transition={{ duration: performanceMode ? 0.1 : 0.2 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-foreground">
                    Gerenciar Sessões
                  </h2>
                  <motion.button
                    onClick={() => setShowCreateSessionModal(true)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors inline-flex items-center"
                    whileHover={performanceMode ? {} : { scale: 1.05 }}
                    whileTap={performanceMode ? {} : { scale: 0.95 }}
                  >
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Nova Sessão
                  </motion.button>
                </div>

                <div className="grid gap-6">
                  {sessions.map((session) => (
                    <motion.div
                      key={session.id}
                      className={`${
                        performanceMode ? 'bg-card border rounded-lg' : 'bg-card border rounded-lg shadow-sm'
                      } p-6 rounded-xl`}
                      initial={{ opacity: 0, y: performanceMode ? 0 : 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={performanceMode ? {} : { scale: 1.005 }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                            <PhoneIcon className="w-8 h-8 text-foreground" />
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold text-foreground">
                              {session.name}
                            </h3>
                            <p className="text-muted-foreground">ID: {session.id}</p>
                            <div className="flex items-center space-x-4 mt-2">
                              <div
                                className={`px-3 py-1 rounded-full border ${getStatusColor(
                                  session.status
                                )} flex items-center space-x-1`}
                              >
                                {getStatusIcon(session.status)}
                                <span className="text-xs font-medium capitalize">
                                  {session.status === 'connected'
                                    ? 'Conectado'
                                    : session.status === 'connecting'
                                    ? 'Conectando'
                                    : 'Desconectado'}
                                </span>
                              </div>
                              <span className="text-sm text-foreground/60">
                                Uptime: {session.uptime}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">
                              Mensagens:{' '}
                              <span className="text-foreground font-medium">
                                {session.messages}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Grupos:{' '}
                              <span className="text-foreground font-medium">
                                {session.groups}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Webhooks:{' '}
                              <span className="text-foreground font-medium">
                                {session.webhooks}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col space-y-2">
                            {/* Always show QR Code button if there's QR data or if disconnected (likely has QR) */}
                            {(session.qrCode ||
                              session.qrCodeImage ||
                              session.status === 'disconnected' ||
                              session.status === 'connecting') && (
                              <motion.button
                                onClick={async () => {
                                  setSelectedSession({
                                    id: session.id,
                                    name: session.name,
                                  });
                                  setShowQRCode(true);
                                  await fetchQRCodeForSession(session.id);
                                }}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors inline-flex items-center text-sm"
                                whileHover={
                                  performanceMode ? {} : { scale: 1.05 }
                                }
                                whileTap={
                                  performanceMode ? {} : { scale: 0.95 }
                                }
                              >
                                <QrCodeIcon className="w-4 h-4 mr-2" />
                                {session.qrCode || session.qrCodeImage
                                  ? 'Ver QR Code'
                                  : 'QR Code'}
                              </motion.button>
                            )}

                            <motion.button
                              onClick={() => {
                                setSelectedSessionForConfig({
                                  id: session.id,
                                  name: session.name,
                                  status: session.status,
                                  messages: session.messages,
                                  groups: session.groups,
                                  webhooks: session.webhooks,
                                  uptime: session.uptime,
                                });
                                setShowSessionConfig(true);
                              }}
                              className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors inline-flex items-center text-sm"
                              whileHover={
                                performanceMode ? {} : { scale: 1.05 }
                              }
                              whileTap={performanceMode ? {} : { scale: 0.95 }}
                            >
                              <WrenchScrewdriverIcon className="w-4 h-4 mr-2" />
                              Configurar
                            </motion.button>
                          </div>
                        </div>

                        {/* QR Code Preview */}
                        {session.qrCodeImage && (
                          <div className="mt-4 pt-4 border-t border-white/10">
                            <div className="flex items-center justify-between">
                              <div className="text-sm text-muted-foreground">
                                QR Code disponível para escaneamento:
                              </div>
                              <div className="w-20 h-20 bg-white/10 rounded-lg p-1">
                                <img
                                  src={session.qrCodeImage}
                                  alt={`QR Code - ${session.name}`}
                                  className="w-full h-full object-contain rounded"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'tokens' && (
              <motion.div
                key="tokens"
                initial={{ opacity: 0, x: performanceMode ? 0 : 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: performanceMode ? 0 : -10 }}
                transition={{ duration: performanceMode ? 0.1 : 0.2 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-foreground">
                    Tokens de API
                  </h2>
                  <motion.button
                    onClick={() => setShowCreateTokenModal(true)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors inline-flex items-center"
                    whileHover={performanceMode ? {} : { scale: 1.05 }}
                    whileTap={performanceMode ? {} : { scale: 0.95 }}
                  >
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Gerar Token
                  </motion.button>
                </div>

                <div
                  className={`${
                    performanceMode ? 'bg-card border rounded-lg' : 'bg-card border rounded-lg shadow-sm'
                  } p-6 rounded-xl`}
                >
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      Como usar os tokens de API
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Use seus tokens para criar e gerenciar sessões WhatsApp.
                      Há duas formas principais:
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div
                        className={`${
                          'bg-card border rounded-lg'
                        } p-4 rounded-xl`}
                      >
                        <h4 className="text-foreground font-semibold mb-2 flex items-center">
                          <DocumentTextIcon className="w-4 h-4 mr-2 text-blue-400" />
                          Via Swagger
                        </h4>
                        <p className="text-muted-foreground text-sm mb-2">
                          Acesse /api-docs e use o botão "Authorize"
                        </p>
                        <div className="font-mono text-xs text-green-400">
                          Bearer baileys_xxxxx
                        </div>
                      </div>

                      <div
                        className={`${
                          'bg-card border rounded-lg'
                        } p-4 rounded-xl`}
                      >
                        <h4 className="text-foreground font-semibold mb-2 flex items-center">
                          <ClipboardDocumentIcon className="w-4 h-4 mr-2 text-purple-400" />
                          Via cURL
                        </h4>
                        <p className="text-muted-foreground text-sm mb-2">
                          Use o botão 📋 do token
                        </p>
                        <div className="font-mono text-xs text-purple-400">
                          curl -H "Authorization: Bearer..."
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <motion.a
                        href="/api-docs"
                        target="_blank"
                        className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors inline-flex items-center text-sm"
                        whileHover={performanceMode ? {} : { scale: 1.05 }}
                        whileTap={performanceMode ? {} : { scale: 0.95 }}
                      >
                        <DocumentTextIcon className="w-4 h-4 mr-2" />
                        Abrir Swagger Documentation
                      </motion.a>
                    </div>
                  </div>

                  {apiTokens.length === 0 ? (
                    <div className="text-center py-12">
                      <KeyIcon className="w-16 h-16 text-foreground/30 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        Nenhum token criado
                      </h3>
                      <p className="text-muted-foreground mb-6">
                        Crie seu primeiro token de API para começar a usar o
                        WhatsApp Bot
                      </p>
                      <motion.button
                        onClick={() => setShowCreateTokenModal(true)}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors inline-flex items-center"
                        whileHover={performanceMode ? {} : { scale: 1.05 }}
                        whileTap={performanceMode ? {} : { scale: 0.95 }}
                      >
                        <PlusIcon className="w-5 h-5 mr-2" />
                        Criar Primeiro Token
                      </motion.button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {apiTokens.map((token) => (
                        <motion.div
                          key={token._id}
                          className={`${
                            performanceMode
                              ? 'bg-card border rounded-lg'
                              : 'bg-card border rounded-lg'
                          } p-4 rounded-xl`}
                          whileHover={performanceMode ? {} : { scale: 1.01 }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <h4 className="text-lg font-semibold text-foreground">
                                  {token.name}
                                </h4>
                                <span
                                  className={`px-2 py-1 rounded-full text-xs ${
                                    token.isActive
                                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  }`}
                                >
                                  {token.isActive ? 'Ativo' : 'Inativo'}
                                </span>
                                {token.isExpired && (
                                  <span className="px-2 py-1 rounded-full text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30">
                                    Expirado
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-foreground/60">
                                    Criado em:
                                  </span>
                                  <div className="text-foreground">
                                    {new Date(
                                      token.createdAt
                                    ).toLocaleDateString('pt-BR')}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-foreground/60">
                                    Expira em:
                                  </span>
                                  <div className="text-foreground">
                                    {token.expiresAt
                                      ? new Date(
                                          token.expiresAt
                                        ).toLocaleDateString('pt-BR')
                                      : 'Nunca'}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-foreground/60">
                                    Último uso:
                                  </span>
                                  <div className="text-foreground">
                                    {token.lastUsedAt
                                      ? new Date(
                                          token.lastUsedAt
                                        ).toLocaleDateString('pt-BR')
                                      : 'Nunca'}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2">
                              <motion.button
                                onClick={() => {
                                  const apiUrl =
                                    import.meta.env.VITE_API_URL ||
                                    'http://localhost:3000';
                                  const curlCommand = `curl -X POST '${apiUrl}/api/baileys/session/create' \\
  -H 'Authorization: Bearer seu_token_${token.name
    .toLowerCase()
    .replace(/\s+/g, '_')}' \\
  -H 'Content-Type: application/json' \\
  -d '{"sessionId": "minha-sessao-1"}'`;

                                  navigator.clipboard
                                    .writeText(curlCommand)
                                    .then(() => {
                                      alert(
                                        'Comando curl copiado! Cole no terminal para criar uma sessão.\n\nLembre-se de substituir "seu_token_..." pelo token real gerado.'
                                      );
                                    });
                                }}
                                className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                                whileHover={
                                  performanceMode ? {} : { scale: 1.05 }
                                }
                                whileTap={
                                  performanceMode ? {} : { scale: 0.95 }
                                }
                                title="Copiar comando curl"
                              >
                                <ClipboardDocumentIcon className="w-4 h-4" />
                              </motion.button>
                              <motion.button
                                onClick={() => revokeApiToken(token._id)}
                                className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                whileHover={
                                  performanceMode ? {} : { scale: 1.05 }
                                }
                                whileTap={
                                  performanceMode ? {} : { scale: 0.95 }
                                }
                                title="Revogar token"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </motion.button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Webhooks Tab */}
            {activeTab === 'webhooks' && (
              <motion.div
                key="webhooks"
                initial={{ opacity: 0, x: performanceMode ? 0 : 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: performanceMode ? 0 : -10 }}
                transition={{ duration: performanceMode ? 0.1 : 0.2 }}
                className="space-y-6"
              >
                <div
                  className={`${
                    performanceMode ? 'bg-card border rounded-lg' : 'bg-card border rounded-lg shadow-sm'
                  } p-6 rounded-xl`}
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                      <BellIcon className="w-8 h-8 text-blue-400 mr-3" />
                      <div>
                        <h2 className="text-2xl font-semibold text-foreground">
                          Gerenciar Webhooks
                        </h2>
                        <p className="text-muted-foreground">
                          Configure webhooks para receber eventos em tempo real
                        </p>
                      </div>
                    </div>
                  </div>

                  {userSessions.length === 0 ? (
                    <div className="text-center py-12">
                      <BellIcon className="w-16 h-16 text-foreground/30 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">
                        Nenhuma sessão disponível
                      </h3>
                      <p className="text-muted-foreground">
                        Crie uma sessão primeiro para configurar webhooks
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {userSessions.map((session) => (
                        <motion.div
                          key={session.sessionId}
                          className={`${
                            performanceMode
                              ? 'bg-card border rounded-lg'
                              : 'bg-card border rounded-lg'
                          } p-6 rounded-xl hover:shadow-lg transition-all cursor-pointer`}
                          whileHover={performanceMode ? {} : { scale: 1.02 }}
                          whileTap={performanceMode ? {} : { scale: 0.98 }}
                          onClick={() => {
                            setSelectedSessionForWebhooks(session.sessionId);
                            setShowWebhookManager(true);
                          }}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                              <PhoneIcon className="w-6 h-6 text-blue-400 mr-3" />
                              <h3 className="text-lg font-semibold text-foreground">
                                {session.sessionId}
                              </h3>
                            </div>
                            <div
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                session.status || 'disconnected'
                              )}`}
                            >
                              {getStatusIcon(session.status || 'disconnected')}
                            </div>
                          </div>

                          <div className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex justify-between">
                              <span>Status:</span>
                              <span className="text-foreground">
                                {session.status || 'Desconectado'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Webhooks:</span>
                              <span className="text-blue-400">Configurar</span>
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-white/10">
                            <motion.button
                              className="w-full flex items-center justify-center px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                              whileHover={
                                performanceMode ? {} : { scale: 1.05 }
                              }
                              whileTap={performanceMode ? {} : { scale: 0.95 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSessionForWebhooks(
                                  session.sessionId
                                );
                                setShowWebhookManager(true);
                              }}
                            >
                              <BellIcon className="w-4 h-4 mr-2" />
                              Gerenciar Webhooks
                            </motion.button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'media' && (
              <motion.div
                key="media"
                initial={{ opacity: 0, x: performanceMode ? 0 : 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: performanceMode ? 0 : -10 }}
                transition={{ duration: performanceMode ? 0.1 : 0.2 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-foreground">
                    Gerenciar Mídia
                  </h2>
                  <motion.button
                    onClick={() => setShowMediaManager(true)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors inline-flex items-center"
                    whileHover={performanceMode ? {} : { scale: 1.05 }}
                    whileTap={performanceMode ? {} : { scale: 0.95 }}
                  >
                    <PhotoIcon className="w-5 h-5 mr-2" />
                    Ver Todas as Mídias
                  </motion.button>
                </div>

                <div
                  className={`${
                    performanceMode ? 'bg-card border rounded-lg' : 'bg-card border rounded-lg shadow-sm'
                  } p-6 rounded-xl`}
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                      <PhotoIcon className="w-8 h-8 text-blue-400 mr-3" />
                      <div>
                        <h3 className="text-xl font-semibold text-foreground">
                          Arquivos de Mídia
                        </h3>
                        <p className="text-muted-foreground">
                          Visualize e baixe arquivos de mídia das suas sessões WhatsApp
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6 text-center">
                      <PhotoIcon className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                      <h4 className="text-lg font-semibold text-foreground mb-2">Imagens</h4>
                      <p className="text-muted-foreground text-sm mb-4">
                        Fotos e imagens recebidas via WhatsApp
                      </p>
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                        JPG, PNG, GIF, WEBP
                      </Badge>
                    </div>

                    <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-6 text-center">
                      <FilmIcon className="w-12 h-12 text-purple-400 mx-auto mb-3" />
                      <h4 className="text-lg font-semibold text-foreground mb-2">Vídeos</h4>
                      <p className="text-muted-foreground text-sm mb-4">
                        Vídeos e gravações compartilhadas
                      </p>
                      <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                        MP4, AVI, MOV, WEBM
                      </Badge>
                    </div>

                    <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-6 text-center">
                      <DocumentIcon className="w-12 h-12 text-green-400 mx-auto mb-3" />
                      <h4 className="text-lg font-semibold text-foreground mb-2">Documentos</h4>
                      <p className="text-muted-foreground text-sm mb-4">
                        PDFs, documentos e outros arquivos
                      </p>
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        PDF, DOC, DOCX
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-center">
                    <motion.button
                      onClick={() => setShowMediaManager(true)}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-foreground px-8 py-3 rounded-lg font-medium transition-all transform hover:scale-105 inline-flex items-center"
                      whileHover={performanceMode ? {} : { scale: 1.02 }}
                      whileTap={performanceMode ? {} : { scale: 0.98 }}
                    >
                      <PhotoIcon className="w-5 h-5 mr-2" />
                      Gerenciar Arquivos de Mídia
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Placeholder para outras abas */}
            {activeTab !== 'overview' &&
              activeTab !== 'sessions' &&
              activeTab !== 'tokens' &&
              activeTab !== 'webhooks' &&
              activeTab !== 'media' && (
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: performanceMode ? 0 : 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: performanceMode ? 0 : -10 }}
                  transition={{ duration: performanceMode ? 0.1 : 0.2 }}
                  className={`${
                    performanceMode ? 'bg-card border rounded-lg' : 'bg-card border rounded-lg shadow-sm'
                  } p-8 text-center rounded-xl`}
                >
                  <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center">
                    <CogIcon className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h2 className="text-2xl font-semibold text-foreground mb-2">
                    {tabs.find((tab) => tab.id === activeTab)?.name}
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    Esta seção está em desenvolvimento. Em breve você poderá
                    gerenciar todas as funcionalidades da API aqui.
                  </p>
                  <motion.button
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors inline-flex items-center"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <LinkIcon className="w-5 h-5 mr-2" />
                    Acessar Documentação
                  </motion.button>
                </motion.div>
              )}
          </AnimatePresence>
        </motion.main>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showNewSession && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowNewSession(false)}
          >
            <motion.div
              className={`${
                performanceMode ? 'bg-card border rounded-lg' : 'bg-card border rounded-lg shadow-sm'
              } p-6 max-w-md w-full mx-4 rounded-xl`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold text-foreground mb-4">
                Nova Sessão WhatsApp
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Nome da Sessão
                  </label>
                  <input
                    type="text"
                    className={`w-full px-4 py-3 ${
                      'bg-card border rounded-lg'
                    } rounded-xl text-foreground placeholder-white/50 focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                    placeholder="Ex: Vendas, Suporte, Marketing..."
                  />
                </div>
                <div className="flex space-x-3">
                  <motion.button
                    onClick={() => setShowNewSession(false)}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors-secondary"
                    whileHover={performanceMode ? {} : { scale: 1.02 }}
                    whileTap={performanceMode ? {} : { scale: 0.98 }}
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors"
                    whileHover={performanceMode ? {} : { scale: 1.02 }}
                    whileTap={performanceMode ? {} : { scale: 0.98 }}
                  >
                    Criar Sessão
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showQRCode && selectedSession && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowQRCode(false);
              setQrCodeData(null);
              setSelectedSession(null);
            }}
          >
            <motion.div
              className={`${
                performanceMode ? 'bg-card border rounded-lg' : 'bg-card border rounded-lg shadow-sm'
              } p-6 max-w-md w-full mx-4 text-center rounded-xl`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold text-foreground mb-4">
                QR Code - {selectedSession.name}
              </h3>
              <div
                className={`w-64 h-64 mx-auto mb-4 ${
                  'bg-card border rounded-lg'
                } rounded-xl flex items-center justify-center p-4`}
              >
                {loadingQrCode ? (
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-2 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                    <p className="text-muted-foreground text-sm">
                      Carregando QR Code...
                    </p>
                  </div>
                ) : qrCodeData?.qrCodeImage ? (
                  <img
                    src={qrCodeData.qrCodeImage}
                    alt="QR Code WhatsApp"
                    className="w-full h-full object-contain rounded-lg"
                  />
                ) : qrCodeData?.qrCode ? (
                  <div className="text-center w-full">
                    <QrCodeIcon className="w-16 h-16 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground text-xs mb-2">QR Code Text:</p>
                    <div className="bg-black/20 rounded p-2 max-h-32 overflow-y-auto">
                      <code className="text-foreground/90 text-xs break-all">
                        {qrCodeData.qrCode}
                      </code>
                    </div>
                  </div>
                ) : qrCodeData?.hasQrCode === false ? (
                  <div className="text-center">
                    <QrCodeIcon className="w-16 h-16 text-red-400/50 mx-auto mb-2" />
                    <p className="text-red-400 text-sm">
                      QR Code não disponível
                    </p>
                    <p className="text-foreground/40 text-xs mt-2">
                      Sessão pode já estar conectada
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <QrCodeIcon className="w-16 h-16 text-foreground/30 mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">Gerando QR Code...</p>
                    <p className="text-foreground/40 text-xs mt-2">
                      Aguarde a geração do QR Code...
                    </p>
                  </div>
                )}
              </div>{' '}
              <p className="text-muted-foreground mb-6 text-center">
                {qrCodeData?.qrCode || qrCodeData?.qrCodeImage
                  ? 'Escaneie este QR Code com o WhatsApp Web para conectar a sessão.'
                  : qrCodeData?.hasQrCode === false
                  ? 'QR Code não está disponível. A sessão pode já estar conectada ou há um problema na geração.'
                  : 'Aguarde a geração do QR Code...'}
              </p>
              <div className="flex gap-2">
                {qrCodeData?.qrCode && (
                  <motion.button
                    onClick={() => copyToClipboard(qrCodeData.qrCode)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors flex-1 text-sm"
                    whileHover={performanceMode ? {} : { scale: 1.02 }}
                    whileTap={performanceMode ? {} : { scale: 0.98 }}
                  >
                    Copiar QR Code
                  </motion.button>
                )}
                <motion.button
                  onClick={() => {
                    setShowQRCode(false);
                    setQrCodeData(null);
                    setSelectedSession(null);
                  }}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors flex-1"
                  whileHover={performanceMode ? {} : { scale: 1.02 }}
                  whileTap={performanceMode ? {} : { scale: 0.98 }}
                >
                  Fechar
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showTokenModal && newToken && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowTokenModal(false);
              setNewToken(null);
            }}
          >
            <motion.div
              className={`${
                performanceMode ? 'bg-card border rounded-lg' : 'bg-card border rounded-lg shadow-sm'
              } p-6 max-w-2xl w-full mx-4 rounded-xl`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold text-foreground mb-4">
                Token de API Gerado
              </h3>

              <div className="mb-6">
                <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-4 mb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400" />
                    <span className="text-yellow-400 font-semibold">
                      IMPORTANTE
                    </span>
                  </div>
                  <p className="text-yellow-200 text-sm">
                    Este token será mostrado apenas uma vez. Certifique-se de
                    copiá-lo e guardá-lo em local seguro.
                  </p>
                </div>

                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Seu Token de API:
                </label>
                <div
                  className={`${
                    'bg-card border rounded-lg'
                  } p-4 rounded-xl`}
                >
                  <div className="flex items-center justify-between">
                    <code className="text-green-400 font-mono text-sm break-all mr-4">
                      {newToken}
                    </code>
                    <motion.button
                      onClick={() => copyToClipboard(newToken)}
                      className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors flex-shrink-0"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      title="Copiar token"
                    >
                      <ClipboardDocumentIcon className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-lg font-semibold text-foreground mb-2">
                  Como usar
                </h4>
                <p className="text-muted-foreground mb-4">
                  Inclua este token no header Authorization de suas requisições
                  para as rotas do WhatsApp API:
                </p>
                <div
                  className={`${
                    'bg-card border rounded-lg'
                  } p-4 rounded-xl font-mono text-sm`}
                >
                  <div className="text-muted-foreground">
                    Authorization: Bearer {newToken}
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <motion.button
                  onClick={() => copyToClipboard(newToken)}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors inline-flex items-center justify-center"
                  whileHover={performanceMode ? {} : { scale: 1.02 }}
                  whileTap={performanceMode ? {} : { scale: 0.98 }}
                >
                  <ClipboardDocumentIcon className="w-5 h-5 mr-2" />
                  Copiar Token
                </motion.button>
                <motion.button
                  onClick={() => {
                    setShowTokenModal(false);
                    setNewToken(null);
                  }}
                  className={`px-4 py-3 ${
                    'bg-card border rounded-lg'
                  } rounded-xl text-muted-foreground hover:text-foreground transition-colors`}
                  whileHover={performanceMode ? {} : { scale: 1.02 }}
                  whileTap={performanceMode ? {} : { scale: 0.98 }}
                >
                  Fechar
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showCreateTokenModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowCreateTokenModal(false);
              setTokenForm({ name: '', expiresIn: 'never' });
            }}
          >
            <motion.div
              className={`${
                performanceMode ? 'bg-card border rounded-lg' : 'bg-card border rounded-lg shadow-sm'
              } p-6 max-w-md w-full mx-4 rounded-xl`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold text-foreground mb-6">
                Criar Token de API
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Nome do Token *
                  </label>
                  <input
                    type="text"
                    value={tokenForm.name}
                    onChange={(e) =>
                      setTokenForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className={`w-full px-4 py-3 ${
                      'bg-card border rounded-lg'
                    } rounded-xl text-foreground placeholder-white/50 focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                    placeholder="Ex: API Principal, Bot Vendas, Sistema..."
                    maxLength={50}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Prazo de Expiração
                  </label>
                  <select
                    value={tokenForm.expiresIn}
                    onChange={(e) =>
                      setTokenForm((prev) => ({
                        ...prev,
                        expiresIn: e.target.value,
                      }))
                    }
                    className={`w-full px-4 py-3 ${
                      'bg-card border rounded-lg'
                    } rounded-xl text-foreground bg-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                  >
                    <option value="never" className="bg-slate-800">
                      Nunca expira
                    </option>
                    <option value="7" className="bg-slate-800">
                      7 dias
                    </option>
                    <option value="30" className="bg-slate-800">
                      30 dias
                    </option>
                    <option value="90" className="bg-slate-800">
                      90 dias
                    </option>
                    <option value="365" className="bg-slate-800">
                      1 ano
                    </option>
                  </select>
                </div>

                <div
                  className={`${
                    'bg-card border rounded-lg'
                  } p-4 rounded-xl`}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <KeyIcon className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-blue-400">
                      Informações Importantes
                    </span>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>
                      • O token será mostrado apenas uma vez após a criação
                    </li>
                    <li>• Guarde-o em local seguro</li>
                    <li>• Use no header: Authorization: Bearer seu_token</li>
                    <li>• Você pode revogar o token a qualquer momento</li>
                  </ul>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <motion.button
                  onClick={() => {
                    setShowCreateTokenModal(false);
                    setTokenForm({ name: '', expiresIn: 'never' });
                  }}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors-secondary"
                  whileHover={performanceMode ? {} : { scale: 1.02 }}
                  whileTap={performanceMode ? {} : { scale: 0.98 }}
                >
                  Cancelar
                </motion.button>
                <motion.button
                  onClick={generateApiToken}
                  disabled={!tokenForm.name.trim()}
                  className={`flex-1 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors ${
                    !tokenForm.name.trim()
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  }`}
                  whileHover={
                    tokenForm.name.trim() && !performanceMode
                      ? { scale: 1.02 }
                      : {}
                  }
                  whileTap={
                    tokenForm.name.trim() && !performanceMode
                      ? { scale: 0.98 }
                      : {}
                  }
                >
                  <KeyIcon className="w-4 h-4 mr-2" />
                  Criar Token
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showCreateSessionModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowCreateSessionModal(false);
              setSessionForm({ 
          sessionId: '',
          proxy: {
            enabled: false,
            type: 'http',
            host: '',
            port: '',
            username: '',
            password: ''
          }
        });
            }}
          >
            <motion.div
              className={`${
                performanceMode ? 'bg-card border rounded-lg' : 'bg-card border rounded-lg shadow-sm'
              } w-full max-w-sm sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] mx-2 sm:mx-4 rounded-xl overflow-hidden flex flex-col`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header fixo */}
              <div className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-border/50">
                <h3 className="text-lg sm:text-xl font-semibold text-foreground">
                  Criar Sessão WhatsApp
                </h3>
              </div>

              {/* Conteúdo com scroll */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-3 sm:pt-4 space-y-4 custom-scrollbar"
                   style={{ 
                     scrollbarWidth: 'thin', 
                     scrollbarColor: 'rgba(255,255,255,0.3) transparent',
                     scrollBehavior: 'smooth'
                   }}
              >
                <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    ID da Sessão *
                  </label>
                  <input
                    type="text"
                    value={sessionForm.sessionId}
                    onChange={(e) =>
                      setSessionForm((prev) => ({
                        ...prev,
                        sessionId: e.target.value,
                      }))
                    }
                    className={`w-full px-4 py-3 ${
                      'bg-card border rounded-lg'
                    } rounded-xl text-foreground placeholder-white/50 focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                    placeholder="Ex: vendas-bot, suporte-cliente, marketing..."
                    maxLength={30}
                  />
                </div>

                {/* Método de Pareamento */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <QrCodeIcon className="w-5 h-5 text-green-400" />
                    <label className="text-sm font-medium text-foreground">
                      Método de Pareamento
                    </label>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setSessionForm((prev) => ({
                          ...prev,
                          pairingMethod: 'qr',
                        }))
                      }
                      className={`p-3 rounded-lg border-2 transition-all ${
                        sessionForm.pairingMethod === 'qr'
                          ? 'border-green-500 bg-green-500/10 text-green-400'
                          : 'border-gray-600 bg-card hover:border-gray-500'
                      }`}
                    >
                      <QrCodeIcon className="w-6 h-6 mx-auto mb-2" />
                      <div className="text-sm font-medium">QR Code</div>
                      <div className="text-xs text-muted-foreground">Escaneie com WhatsApp</div>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() =>
                        setSessionForm((prev) => ({
                          ...prev,
                          pairingMethod: 'code',
                        }))
                      }
                      className={`p-3 rounded-lg border-2 transition-all ${
                        sessionForm.pairingMethod === 'code'
                          ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                          : 'border-gray-600 bg-card hover:border-gray-500'
                      }`}
                    >
                      <PhoneIcon className="w-6 h-6 mx-auto mb-2" />
                      <div className="text-sm font-medium">Código</div>
                      <div className="text-xs text-muted-foreground">Digite código no app</div>
                    </button>
                  </div>

                  {sessionForm.pairingMethod === 'code' && (
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Número de Telefone *
                      </label>
                      <input
                        type="tel"
                        value={formatBrazilianPhone(sessionForm.phoneNumber)}
                        onChange={(e) => {
                          const rawValue = e.target.value.replace(/\D/g, '');
                          setSessionForm((prev) => ({
                            ...prev,
                            phoneNumber: rawValue,
                          }));
                        }}
                        className={`w-full px-4 py-3 bg-card border rounded-lg text-foreground placeholder-white/50 focus:ring-2 transition-colors ${
                          sessionForm.phoneNumber && validateBrazilianPhone(sessionForm.phoneNumber)
                            ? 'focus:ring-green-500 border-green-500/50'
                            : sessionForm.phoneNumber
                            ? 'focus:ring-red-500 border-red-500/50'
                            : 'focus:ring-blue-500'
                        } focus:outline-none`}
                        placeholder="+55 (11) 99999-9999"
                        maxLength={19}
                      />
                      <div className="flex items-center justify-between mt-1">
                        <p className={`text-xs transition-colors ${
                          sessionForm.phoneNumber && validateBrazilianPhone(sessionForm.phoneNumber)
                            ? 'text-green-400'
                            : sessionForm.phoneNumber
                            ? 'text-red-400'
                            : 'text-muted-foreground'
                        }`}>
                          {sessionForm.phoneNumber ? getPhoneValidationMessage(sessionForm.phoneNumber) : 'Digite o número brasileiro completo'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {sessionForm.phoneNumber.replace(/\D/g, '').length}/13
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Configuração de Proxy */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <ServerIcon className="w-5 h-5 text-blue-400" />
                    <label className="text-sm font-medium text-foreground">
                      Configuração de Proxy (Opcional)
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="proxyEnabled"
                      checked={sessionForm.proxy.enabled}
                      onChange={(e) =>
                        setSessionForm((prev) => ({
                          ...prev,
                          proxy: {
                            ...prev.proxy,
                            enabled: e.target.checked,
                          },
                        }))
                      }
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="proxyEnabled" className="text-sm text-foreground">
                      Usar proxy para esta sessão
                    </label>
                  </div>

                  {sessionForm.proxy.enabled && (
                    <div className="space-y-3 p-4 bg-card/50 rounded-lg border">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-foreground mb-1 block">
                            Tipo de Proxy
                          </label>
                          <select
                            value={sessionForm.proxy.type}
                            onChange={(e) =>
                              setSessionForm((prev) => ({
                                ...prev,
                                proxy: {
                                  ...prev.proxy,
                                  type: e.target.value,
                                },
                              }))
                            }
                            className="w-full px-3 py-2 bg-card border rounded text-sm text-foreground"
                          >
                            <option value="http">HTTP</option>
                            <option value="https">HTTPS</option>
                            <option value="socks4">SOCKS4</option>
                            <option value="socks5">SOCKS5</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-foreground mb-1 block">
                            Porta
                          </label>
                          <input
                            type="number"
                            value={sessionForm.proxy.port}
                            onChange={(e) =>
                              setSessionForm((prev) => ({
                                ...prev,
                                proxy: {
                                  ...prev.proxy,
                                  port: e.target.value,
                                },
                              }))
                            }
                            className="w-full px-3 py-2 bg-card border rounded text-sm text-foreground"
                            placeholder="8080"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium text-foreground mb-1 block">
                          Host do Proxy
                        </label>
                        <input
                          type="text"
                          value={sessionForm.proxy.host}
                          onChange={(e) =>
                            setSessionForm((prev) => ({
                              ...prev,
                              proxy: {
                                ...prev.proxy,
                                host: e.target.value,
                              },
                            }))
                          }
                          className="w-full px-3 py-2 bg-card border rounded text-sm text-foreground"
                          placeholder="proxy.exemplo.com"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-foreground mb-1 block">
                            Usuário (Opcional)
                          </label>
                          <input
                            type="text"
                            value={sessionForm.proxy.username}
                            onChange={(e) =>
                              setSessionForm((prev) => ({
                                ...prev,
                                proxy: {
                                  ...prev.proxy,
                                  username: e.target.value,
                                },
                              }))
                            }
                            className="w-full px-3 py-2 bg-card border rounded text-sm text-foreground"
                            placeholder="usuario"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-foreground mb-1 block">
                            Senha (Opcional)
                          </label>
                          <input
                            type="password"
                            value={sessionForm.proxy.password}
                            onChange={(e) =>
                              setSessionForm((prev) => ({
                                ...prev,
                                proxy: {
                                  ...prev.proxy,
                                  password: e.target.value,
                                },
                              }))
                            }
                            className="w-full px-3 py-2 bg-card border rounded text-sm text-foreground"
                            placeholder="senha"
                          />
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground bg-blue-50/10 p-2 rounded">
                        <p><strong>Dica:</strong> Use proxy para contornar restrições de rede ou geográficas. SOCKS5 é geralmente mais estável.</p>
                      </div>
                    </div>
                  )}
                </div>

                <div
                  className={`${
                    'bg-card border rounded-lg'
                  } p-4 rounded-xl`}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-blue-400">
                      Como Usar
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Digite um nome único para identificar sua sessão</p>
                    <p>
                      • Após criar, um QR Code será gerado para escaneamento
                    </p>
                    <p>
                      • Use a aba "Tokens de API" para criar tokens para
                      automação
                    </p>
                    <p>• Configure webhooks na seção "Configurar" da sessão</p>
                  </div>
                </div>
              </div>
              </div>

              {/* Footer fixo com botões */}
              <div className="p-4 sm:p-6 pt-3 sm:pt-4 border-t border-border/50 bg-card">
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <motion.button
                  onClick={() => {
                    setShowCreateSessionModal(false);
                    setSessionForm({ 
          sessionId: '',
          proxy: {
            enabled: false,
            type: 'http',
            host: '',
            port: '',
            username: '',
            password: ''
          }
        });
                  }}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors-secondary"
                  whileHover={performanceMode ? {} : { scale: 1.02 }}
                  whileTap={performanceMode ? {} : { scale: 0.98 }}
                >
                  Cancelar
                </motion.button>
                <motion.button
                  onClick={createWhatsAppSession}
                  disabled={
                    !sessionForm.sessionId.trim() || 
                    creatingSession ||
                    (sessionForm.pairingMethod === 'code' && !validateBrazilianPhone(sessionForm.phoneNumber))
                  }
                  className={`flex-1 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors ${
                    !sessionForm.sessionId.trim() || 
                    creatingSession ||
                    (sessionForm.pairingMethod === 'code' && !validateBrazilianPhone(sessionForm.phoneNumber))
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  }`}
                  whileHover={
                    !sessionForm.sessionId.trim() ||
                    creatingSession ||
                    (sessionForm.pairingMethod === 'code' && !validateBrazilianPhone(sessionForm.phoneNumber)) ||
                    performanceMode
                      ? {}
                      : { scale: 1.02 }
                  }
                  whileTap={
                    !sessionForm.sessionId.trim() ||
                    creatingSession ||
                    (sessionForm.pairingMethod === 'code' && !validateBrazilianPhone(sessionForm.phoneNumber)) ||
                    performanceMode
                      ? {}
                      : { scale: 0.98 }
                  }
                >
                  {creatingSession ? (
                    <>
                      <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Criando...
                    </>
                  ) : (
                    <>Criar Sessão</>
                  )}
                </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Pairing Code Modal */}
        {showPairingCodeModal && pairingCodeData && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowPairingCodeModal(false);
              setPairingCodeData(null);
              setCodeCopied(false);
              setTimeRemaining(60);
            }}
          >
            <motion.div
              className={`${
                performanceMode ? 'bg-card border rounded-lg' : 'bg-card border rounded-lg shadow-sm'
              } w-full max-w-sm sm:max-w-md mx-2 sm:mx-4 rounded-xl overflow-hidden`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-6">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center">
                    <PhoneIcon className="w-8 h-8 text-white" />
                  </div>
                  
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Código de Pareamento
                  </h3>
                  
                  <p className="text-muted-foreground mb-4">
                    Sessão criada para {pairingCodeData.phoneNumber}
                  </p>
                  
                  {/* Mensagem de código regenerado */}
                  {showRegeneratedMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-3 mb-4 flex items-center"
                    >
                      <CheckCircleIcon className="w-5 h-5 text-blue-400 mr-2 flex-shrink-0" />
                      <span className="text-sm text-blue-400">
                        Novo código gerado automaticamente!
                      </span>
                    </motion.div>
                  )}
                  
                  <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-xl p-6 mb-4 border border-green-500/30">
                    <div className="text-3xl font-mono font-bold text-foreground tracking-wider mb-2">
                      {isRegenerating ? '••••-••••' : formatPairingCode(pairingCodeData.code)}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {isRegenerating ? 'Gerando novo código...' : 'Digite este código no WhatsApp'}
                      </p>
                      <div className={`flex items-center text-sm font-medium ${
                        timeRemaining <= 10 ? 'text-red-400' : timeRemaining <= 30 ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        <ClockIcon className="w-4 h-4 mr-1" />
                        {formatTimeRemaining(timeRemaining)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress bar para o timer */}
                  <div className="w-full bg-muted rounded-full h-2 mb-6">
                    <div 
                      className={`h-2 rounded-full transition-all duration-1000 ${
                        timeRemaining <= 10 ? 'bg-red-500' : timeRemaining <= 30 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${(timeRemaining / 60) * 100}%` }}
                    ></div>
                  </div>
                  
                  <div className="bg-card/50 rounded-lg p-4 mb-4 text-left">
                    <h4 className="font-semibold text-foreground mb-3 flex items-center">
                      <SparklesIcon className="w-4 h-4 mr-2 text-blue-400" />
                      Como conectar:
                    </h4>
                    <ol className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-start">
                        <span className="inline-block w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">1</span>
                        Abra o WhatsApp no seu celular
                      </li>
                      <li className="flex items-start">
                        <span className="inline-block w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">2</span>
                        Toque em <strong>Configurações</strong> → <strong>Dispositivos conectados</strong>
                      </li>
                      <li className="flex items-start">
                        <span className="inline-block w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">3</span>
                        Toque em <strong>Conectar dispositivo</strong>
                      </li>
                      <li className="flex items-start">
                        <span className="inline-block w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">4</span>
                        Digite o código: <strong className="font-mono">{formatPairingCode(pairingCodeData.code)}</strong>
                      </li>
                    </ol>
                  </div>
                  
                  {/* Warning sobre validade do código */}
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-6">
                    <div className="flex items-start">
                      <ExclamationTriangleIcon className="w-5 h-5 text-amber-400 mr-2 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="text-amber-400 font-medium mb-1">Importante:</p>
                        <ul className="text-amber-300 space-y-1">
                          <li>• Digite o código exatamente como mostrado (com hífen)</li>
                          <li>• Use o código rapidamente - ele expira automaticamente</li>
                          <li>• Se não funcionar, aguarde a regeneração automática</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row">
                    <motion.button
                      onClick={async () => {
                        if (isRegenerating) return;
                        try {
                          await navigator.clipboard.writeText(pairingCodeData.code);
                          setCodeCopied(true);
                          setTimeout(() => setCodeCopied(false), 2000);
                        } catch (err) {
                          console.error('Erro ao copiar código:', err);
                        }
                      }}
                      disabled={isRegenerating}
                      className={`flex-1 px-4 py-2 rounded-md transition-colors flex items-center justify-center ${
                        isRegenerating
                          ? 'bg-muted text-muted-foreground cursor-not-allowed'
                          : codeCopied 
                          ? 'bg-green-500 text-white' 
                          : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      }`}
                      whileHover={!isRegenerating && performanceMode ? {} : { scale: 1.02 }}
                      whileTap={!isRegenerating && performanceMode ? {} : { scale: 0.98 }}
                    >
                      {isRegenerating ? (
                        <>
                          <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                          Aguarde...
                        </>
                      ) : codeCopied ? (
                        <>
                          <CheckCircleIcon className="w-4 h-4 mr-2" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <ClipboardDocumentIcon className="w-4 h-4 mr-2" />
                          Copiar Código
                        </>
                      )}
                    </motion.button>
                    
                    <motion.button
                      onClick={regeneratePairingCode}
                      disabled={isRegenerating}
                      className={`flex-1 px-4 py-2 rounded-md transition-colors flex items-center justify-center ${
                        isRegenerating
                          ? 'bg-muted text-muted-foreground cursor-not-allowed'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                      whileHover={!isRegenerating && performanceMode ? {} : { scale: 1.02 }}
                      whileTap={!isRegenerating && performanceMode ? {} : { scale: 0.98 }}
                    >
                      {isRegenerating ? (
                        <>
                          <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                          Gerando...
                        </>
                      ) : (
                        <>
                          <SparklesIcon className="w-4 h-4 mr-2" />
                          Novo Código
                        </>
                      )}
                    </motion.button>
                    
                    <motion.button
                      onClick={() => {
                        setShowPairingCodeModal(false);
                        setPairingCodeData(null);
                        setCodeCopied(false);
                        setTimeRemaining(60);
                      }}
                      className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90 px-4 py-2 rounded-md transition-colors"
                      whileHover={performanceMode ? {} : { scale: 1.02 }}
                      whileTap={performanceMode ? {} : { scale: 0.98 }}
                    >
                      Fechar
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Webhook Manager Modal */}
        {showWebhookManager && selectedSessionForWebhooks && (
          <WebhookManager
            sessionId={selectedSessionForWebhooks}
            tokenId={apiTokens.find(token => token.isActive && !token.isExpired)?._id || ''}
            onClose={() => {
              setShowWebhookManager(false);
              setSelectedSessionForWebhooks(null);
            }}
          />
        )}

        {/* Session Configuration Modal */}
        {showSessionConfig && selectedSessionForConfig && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowSessionConfig(false);
              setSelectedSessionForConfig(null);
              setSelectedTokenForExamples('');
              setFullTokenForExamples('');
            }}
          >
            <motion.div
              className={`${
                performanceMode ? 'bg-card border rounded-lg' : 'bg-card border rounded-lg shadow-sm'
              } p-6 max-w-4xl w-full mx-4 rounded-xl max-h-[90vh] overflow-y-auto`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                    <WrenchScrewdriverIcon className="w-6 h-6 text-foreground" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">
                      Configurar Sessão
                    </h3>
                    <p className="text-muted-foreground">
                      {selectedSessionForConfig.name} (
                      {selectedSessionForConfig.id})
                    </p>
                  </div>
                </div>
                <motion.button
                  onClick={() => {
                    setShowSessionConfig(false);
                    setSelectedSessionForConfig(null);
                    setSelectedTokenForExamples('');
                    setFullTokenForExamples('');
                  }}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  whileHover={performanceMode ? {} : { scale: 1.05 }}
                  whileTap={performanceMode ? {} : { scale: 0.95 }}
                >
                  <XCircleIcon className="w-6 h-6 text-muted-foreground" />
                </motion.button>
              </div>

              {/* Session Status Overview */}
              <div
                className={`${
                  'bg-card border rounded-lg'
                } p-4 rounded-xl mb-6`}
              >
                <h4 className="text-lg font-semibold text-foreground mb-4">
                  Status da Sessão
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div
                      className={`w-3 h-3 rounded-full mx-auto mb-2 ${
                        selectedSessionForConfig.status === 'connected'
                          ? 'bg-green-400'
                          : selectedSessionForConfig.status === 'connecting'
                          ? 'bg-yellow-400'
                          : 'bg-red-400'
                      }`}
                    ></div>
                    <div className="text-sm text-foreground/60">Status</div>
                    <div className="text-sm font-medium text-foreground capitalize">
                      {selectedSessionForConfig.status === 'connected'
                        ? 'Conectado'
                        : selectedSessionForConfig.status === 'connecting'
                        ? 'Conectando'
                        : 'Desconectado'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-400">
                      {selectedSessionForConfig.messages}
                    </div>
                    <div className="text-sm text-foreground/60">Mensagens</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-400">
                      {selectedSessionForConfig.groups}
                    </div>
                    <div className="text-sm text-foreground/60">Grupos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-400">
                      {selectedSessionForConfig.webhooks}
                    </div>
                    <div className="text-sm text-foreground/60">Webhooks</div>
                  </div>
                </div>
              </div>

              {/* Configuration Tabs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Session Actions */}
                <div
                  className={`${
                    'bg-card border rounded-lg'
                  } p-4 rounded-xl`}
                >
                  <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                    <ServerIcon className="w-5 h-5 mr-2" />
                    Ações da Sessão
                  </h4>
                  <div className="space-y-3">
                    <motion.button
                      onClick={() => {
                        // Regenerar QR Code
                        setSelectedSession({
                          id: selectedSessionForConfig.id,
                          name: selectedSessionForConfig.name,
                        });
                        setShowQRCode(true);
                        setShowSessionConfig(false);
                      }}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors inline-flex items-center justify-center"
                      whileHover={performanceMode ? {} : { scale: 1.02 }}
                      whileTap={performanceMode ? {} : { scale: 0.98 }}
                    >
                      <QrCodeIcon className="w-4 h-4 mr-2" />
                      Regenerar QR Code
                    </motion.button>

                    <motion.button
                      onClick={() => {
                        // Abrir webhook manager
                        setSelectedSessionForWebhooks(
                          selectedSessionForConfig.id
                        );
                        setShowWebhookManager(true);
                        setShowSessionConfig(false);
                      }}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors inline-flex items-center justify-center"
                      whileHover={performanceMode ? {} : { scale: 1.02 }}
                      whileTap={performanceMode ? {} : { scale: 0.98 }}
                    >
                      <LinkIcon className="w-4 h-4 mr-2" />
                      Gerenciar Webhooks
                    </motion.button>

                    <motion.button
                      onClick={() =>
                        handleDeleteSession(selectedSessionForConfig.id)
                      }
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors-danger inline-flex items-center justify-center"
                      whileHover={performanceMode ? {} : { scale: 1.02 }}
                      whileTap={performanceMode ? {} : { scale: 0.98 }}
                    >
                      <TrashIcon className="w-4 h-4 mr-2" />
                      Excluir Sessão
                    </motion.button>
                  </div>
                </div>

                {/* Session Information */}
                <div
                  className={`${
                    'bg-card border rounded-lg'
                  } p-4 rounded-xl`}
                >
                  <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                    <DocumentTextIcon className="w-5 h-5 mr-2" />
                    Informações da Sessão
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm text-foreground/60">ID da Sessão</div>
                      <div className="text-sm font-mono text-foreground bg-white/5 p-2 rounded border">
                        {selectedSessionForConfig.id}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-foreground/60">Nome</div>
                      <div className="text-sm text-foreground">
                        {selectedSessionForConfig.name}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-foreground/60">Tempo Ativo</div>
                      <div className="text-sm text-foreground">
                        {selectedSessionForConfig.uptime}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-foreground/60">
                        Última Atualização
                      </div>
                      <div className="text-sm text-foreground">
                        {new Date().toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* API Usage Examples */}
              <div
                className={`${
                  'bg-card border rounded-lg'
                } p-4 rounded-xl mt-6`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-foreground flex items-center">
                    <ClipboardDocumentIcon className="w-5 h-5 mr-2" />
                    Exemplos de Uso da API
                  </h4>
                  <div className="flex items-center space-x-2">
                    <KeyIcon className="w-4 h-4 text-foreground/60" />
                    <select
                      value={selectedTokenForExamples}
                      onChange={(e) =>
                        setSelectedTokenForExamples(e.target.value)
                      }
                      className={`px-3 py-2 ${
                        'bg-card border rounded-lg'
                      } rounded-lg text-foreground text-sm bg-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[200px]`}
                    >
                      <option value="" className="bg-slate-800">
                        Selecione um token
                      </option>
                      {apiTokens
                        .filter((token) => token.isActive && !token.isExpired)
                        .map((token) => (
                          <option
                            key={token._id}
                            value={token._id}
                            className="bg-slate-800"
                          >
                            {token.name}{' '}
                            {token.expiresAt
                              ? `(expira ${new Date(
                                  token.expiresAt
                                ).toLocaleDateString('pt-BR')})`
                              : '(nunca expira)'}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                {selectedTokenForExamples ? (
                  <div className="space-y-4 text-sm">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-foreground/60">Enviar Mensagem:</div>
                        <motion.button
                          onClick={() => {
                            const command = `curl -X POST "${
                              import.meta.env.VITE_API_URL ||
                              'http://localhost:3000'
                            }/api/baileys/session/${
                              selectedSessionForConfig.id
                            }/send-message" \\
  -H "Authorization: Bearer ${fullTokenForExamples}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "5511999999999",
    "message": "Olá! Como posso ajudar?"
  }'`;
                            copyToClipboard(command);
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <ClipboardDocumentIcon className="w-3 h-3" />
                          <span>Copiar</span>
                        </motion.button>
                      </div>
                      <div className="font-mono text-xs text-foreground bg-white/5 p-3 rounded border overflow-x-auto">
                        {`curl -X POST "${
                          import.meta.env.VITE_API_URL ||
                          'http://localhost:3000'
                        }/api/baileys/session/${
                          selectedSessionForConfig.id
                        }/send-message" \\
  -H "Authorization: Bearer ${fullTokenForExamples}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "5511999999999",
    "message": "Olá! Como posso ajudar?"
  }'`}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-foreground/60">Verificar Status:</div>
                        <motion.button
                          onClick={() => {
                            const command = `curl -X GET "${
                              import.meta.env.VITE_API_URL ||
                              'http://localhost:3000'
                            }/api/baileys/session/${
                              selectedSessionForConfig.id
                            }/status" \\
  -H "Authorization: Bearer ${fullTokenForExamples}"`;
                            copyToClipboard(command);
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <ClipboardDocumentIcon className="w-3 h-3" />
                          <span>Copiar</span>
                        </motion.button>
                      </div>
                      <div className="font-mono text-xs text-foreground bg-white/5 p-3 rounded border overflow-x-auto">
                        {`curl -X GET "${
                          import.meta.env.VITE_API_URL ||
                          'http://localhost:3000'
                        }/api/baileys/session/${
                          selectedSessionForConfig.id
                        }/status" \\
  -H "Authorization: Bearer ${fullTokenForExamples}"`}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-foreground/60">Listar Grupos:</div>
                        <motion.button
                          onClick={() => {
                            const command = `curl -X GET "${
                              import.meta.env.VITE_API_URL ||
                              'http://localhost:3000'
                            }/api/baileys/groups/${
                              selectedSessionForConfig.id
                            }/list" \\
  -H "Authorization: Bearer ${fullTokenForExamples}"`;
                            copyToClipboard(command);
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <ClipboardDocumentIcon className="w-3 h-3" />
                          <span>Copiar</span>
                        </motion.button>
                      </div>
                      <div className="font-mono text-xs text-foreground bg-white/5 p-3 rounded border overflow-x-auto">
                        {`curl -X GET "${
                          import.meta.env.VITE_API_URL ||
                          'http://localhost:3000'
                        }/api/baileys/groups/${
                          selectedSessionForConfig.id
                        }/list" \\
  -H "Authorization: Bearer ${fullTokenForExamples}"`}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-foreground/60">Enviar Mídia:</div>
                        <motion.button
                          onClick={() => {
                            const command = `curl -X POST "${
                              import.meta.env.VITE_API_URL ||
                              'http://localhost:3000'
                            }/api/baileys/session/${
                              selectedSessionForConfig.id
                            }/send-media" \\
  -H "Authorization: Bearer ${fullTokenForExamples}" \\
  -F "media=@/caminho/para/arquivo.jpg" \\
  -F "to=5511999999999" \\
  -F "caption=Olha essa foto!"`;
                            copyToClipboard(command);
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <ClipboardDocumentIcon className="w-3 h-3" />
                          <span>Copiar</span>
                        </motion.button>
                      </div>
                      <div className="font-mono text-xs text-foreground bg-white/5 p-3 rounded border overflow-x-auto">
                        {`curl -X POST "${
                          import.meta.env.VITE_API_URL ||
                          'http://localhost:3000'
                        }/api/baileys/session/${
                          selectedSessionForConfig.id
                        }/send-media" \\
  -H "Authorization: Bearer ${fullTokenForExamples}" \\
  -F "media=@/caminho/para/arquivo.jpg" \\
  -F "to=5511999999999" \\
  -F "caption=Olha essa foto!"`}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <KeyIcon className="w-16 h-16 text-foreground/20 mx-auto mb-4" />
                    <h4 className="text-lg font-semibold text-foreground/60 mb-2">
                      Selecione um Token
                    </h4>
                    <p className="text-foreground/40 text-sm">
                      Escolha um token acima para ver os exemplos personalizados
                      com seu token real.
                    </p>
                  </div>
                )}
                <div
                  className={`${
                    'bg-card border rounded-lg'
                  } p-3 rounded-xl mt-4`}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-medium text-yellow-400">
                      Dicas de Uso
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {selectedTokenForExamples ? (
                      <>
                        <p>
                          • ✅ Token selecionado - comandos prontos para uso!
                        </p>
                        <p>
                          • 📋 Use os botões "Copiar" para copiar comandos
                          completos
                        </p>
                        <p>
                          • 🔄 Troque de token no seletor acima para usar outro
                        </p>
                      </>
                    ) : (
                      <>
                        <p>
                          • 🔑 Selecione um token acima para ver comandos
                          personalizados
                        </p>
                        <p>• ⚡ Tokens ativos são carregados automaticamente</p>
                      </>
                    )}
                    <p>
                      • 📚 Documentação completa disponível em{' '}
                      <code className="bg-white/10 px-1 rounded">
                        /api-docs
                      </code>
                    </p>
                    <p>
                      • 🔧 Use a aba "Tokens de API" para gerenciar seus tokens
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <motion.button
                  onClick={() => {
                    setShowSessionConfig(false);
                    setSelectedSessionForConfig(null);
                    setSelectedTokenForExamples('');
                    setFullTokenForExamples('');
                  }}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors inline-flex items-center"
                  whileHover={performanceMode ? {} : { scale: 1.05 }}
                  whileTap={performanceMode ? {} : { scale: 0.95 }}
                >
                  Fechar
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showUserProfile && user && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowUserProfile(false)}
          >
            <motion.div
              className={`${
                performanceMode ? 'bg-card border rounded-lg' : 'bg-card border rounded-lg shadow-sm'
              } rounded-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header fixo */}
              <div className="p-6 pb-4 flex-shrink-0">
                <div className="text-center">
                  <div className="relative mx-auto mb-4">
                    {user.profile?.avatar ? (
                      <img
                        src={user.profile.avatar}
                        alt={user.name}
                        className="w-20 h-20 rounded-full object-cover border-4 border-white/20 mx-auto"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center mx-auto">
                        <span className="text-foreground font-bold text-2xl">
                          {user.name
                            ? user.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .substring(0, 2)
                                .toUpperCase()
                            : 'U'}
                        </span>
                      </div>
                    )}
                    {user.active && (
                      <div className="absolute bottom-2 right-2 w-4 h-4 bg-green-400 border-2 border-slate-900 rounded-full"></div>
                    )}
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {user.name}
                  </h3>
                  <p className="text-muted-foreground mb-1">{user.email}</p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      user.role === 'admin'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`}
                  >
                    {user.role === 'user'
                      ? 'Usuário'
                      : user.role === 'admin'
                      ? 'Administrador'
                      : user.role}
                  </span>
                </div>
              </div>

              {/* Conteúdo com scroll */}
              <div className="flex-1 overflow-y-auto px-6 pb-4 modal-scroll">
                <div className="space-y-4">
                  <div
                    className={`${
                      'bg-card border rounded-lg'
                    } p-4 rounded-xl`}
                  >
                    <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                      Informações da Conta
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-foreground/60">
                          ID do Usuário
                        </span>
                        <span className="text-sm text-foreground font-mono">
                          {user._id?.substring(0, 8)}...
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-foreground/60">
                          Membro desde
                        </span>
                        <span className="text-sm text-foreground">
                          {user.createdAt
                            ? new Date(user.createdAt).toLocaleDateString(
                                'pt-BR'
                              )
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-foreground/60">
                          Último login
                        </span>
                        <span className="text-sm text-foreground">
                          {user.lastLogin
                            ? new Date(user.lastLogin).toLocaleDateString(
                                'pt-BR'
                              )
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-foreground/60">Status</span>
                        <span
                          className={`text-sm font-medium ${
                            user.active ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {user.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Estatísticas da API */}
                  <div
                    className={`${
                      'bg-card border rounded-lg'
                    } p-4 rounded-xl`}
                  >
                    <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                      Estatísticas da API
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-400">
                          {user.stats?.totalSessions || 0}
                        </div>
                        <div className="text-xs text-foreground/60">Sessões</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-400">
                          {user.stats?.activeConnections || 0}
                        </div>
                        <div className="text-xs text-foreground/60">Ativas</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-purple-400">
                          {user.stats?.messagesCount || 0}
                        </div>
                        <div className="text-xs text-foreground/60">Mensagens</div>
                      </div>
                    </div>
                  </div>

                  {/* Configurações */}
                  {user.settings && (
                    <div
                      className={`${
                        'bg-card border rounded-lg'
                      } p-4 rounded-xl`}
                    >
                      <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                        Configurações
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-foreground/60">
                            Notificações
                          </span>
                          <span
                            className={`text-sm ${
                              user.settings.notifications
                                ? 'text-green-400'
                                : 'text-red-400'
                            }`}
                          >
                            {user.settings.notifications
                              ? 'Ativas'
                              : 'Desativadas'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-foreground/60">Idioma</span>
                          <span className="text-sm text-foreground">
                            {user.settings.language || 'pt-BR'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-foreground/60">
                            Modo Escuro
                          </span>
                          <span
                            className={`text-sm ${
                              user.settings.darkMode
                                ? 'text-blue-400'
                                : 'text-gray-400'
                            }`}
                          >
                            {user.settings.darkMode ? 'Ativado' : 'Desativado'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Informações Adicionais */}
                  <div
                    className={`${
                      'bg-card border rounded-lg'
                    } p-4 rounded-xl`}
                  >
                    <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                      Informações do Perfil
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-foreground/60">Telefone</span>
                        <span className="text-sm text-foreground">
                          {user.profile?.phone || 'Não informado'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-foreground/60">Empresa</span>
                        <span className="text-sm text-foreground">
                          {user.profile?.company || 'Não informado'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Atividade Recente */}
                  <div
                    className={`${
                      'bg-card border rounded-lg'
                    } p-4 rounded-xl`}
                  >
                    <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                      Atividade Recente
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        <div className="flex-1">
                          <div className="text-sm text-foreground">
                            Login realizado
                          </div>
                          <div className="text-xs text-foreground/60">
                            {user.lastLogin
                              ? new Date(user.lastLogin).toLocaleString('pt-BR')
                              : 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                        <div className="flex-1">
                          <div className="text-sm text-foreground">Conta criada</div>
                          <div className="text-xs text-foreground/60">
                            {user.createdAt
                              ? new Date(user.createdAt).toLocaleString('pt-BR')
                              : 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                        <div className="flex-1">
                          <div className="text-sm text-foreground">
                            Perfil atualizado
                          </div>
                          <div className="text-xs text-foreground/60">
                            {user.updatedAt
                              ? new Date(user.updatedAt).toLocaleString('pt-BR')
                              : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer fixo */}
              <div className="p-6 pt-4 flex-shrink-0">
                <motion.button
                  onClick={() => setShowUserProfile(false)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors w-full"
                  whileHover={performanceMode ? {} : { scale: 1.02 }}
                  whileTap={performanceMode ? {} : { scale: 0.98 }}
                >
                  Fechar
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Media Manager Modal */}
        {showMediaManager && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMediaManager(false)}
          >
            <div className="w-full h-full max-w-7xl mx-4" onClick={(e) => e.stopPropagation()}>
              <MediaManager
                onClose={() => setShowMediaManager(false)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
