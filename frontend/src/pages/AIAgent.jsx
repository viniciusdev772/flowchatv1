import {
  Button,
  Description,
  Dialog,
  Disclosure,
  Field,
  Fieldset,
  Input,
  Label,
  Legend,
  Listbox,
  RadioGroup,
  Switch,
  Tab,
  Textarea,
  Transition,
} from '@headlessui/react';
import {
  AcademicCapIcon,
  ArrowRightIcon,
  BeakerIcon,
  BoltIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  Cog6ToothIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  PhoneIcon,
  PlusIcon,
  RocketLaunchIcon,
  SparklesIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import React, { Fragment, useEffect, useState } from 'react';
import AgentsList from '../components/AgentsList';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function AIAgent() {
  const [currentTab, setCurrentTab] = useState('create'); // 'create' or 'manage'
  const [currentStep, setCurrentStep] = useState(0);
  const [availableSessions, setAvailableSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [deploymentProgress, setDeploymentProgress] = useState(0);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState('idle');
  const [deploymentError, setDeploymentError] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [token, setToken] = useState('');
  const [tokenLoading, setTokenLoading] = useState(true);

  const [agentConfig, setAgentConfig] = useState({
    name: '',
    description: '',
    apiKey: '',
    model: 'gpt-4.1',
    personality: 'professional',
    specialization: 'general',
    creativity: 70,
    learningEnabled: true,
    autoReply: true,
    smartReplies: true,
    replyToGroups: true,
  });

  const steps = [
    {
      id: 0,
      name: 'Sessão WhatsApp',
      icon: PhoneIcon,
      description: 'Selecione a sessão para seu agente',
    },
    {
      id: 1,
      name: 'Identidade',
      icon: AcademicCapIcon,
      description: 'Defina nome e especialização',
    },
    {
      id: 2,
      name: 'Inteligência',
      icon: CpuChipIcon,
      description: 'Configure modelo e parâmetros',
    },
    {
      id: 3,
      name: 'Personalidade',
      icon: BeakerIcon,
      description: 'Escolha comportamento do agente',
    },
    {
      id: 4,
      name: 'Implantação',
      icon: RocketLaunchIcon,
      description: 'Revisar e implantar',
    },
  ];

  const aiModels = [
    {
      id: 'gpt-4.1',
      name: 'gpt-4.1 (Recomendado)',
      description: 'Modelo mais avançado da OpenAI',
    },
    {
      id: 'gpt-4.1',
      name: 'GPT-3.5 Turbo',
      description: 'Rápido e eficiente',
    },
    { id: 'claude-3', name: 'Claude 3', description: 'Modelo da Anthropic' },
    { id: 'gemini-pro', name: 'Gemini Pro', description: 'Modelo do Google' },
  ];

  const personalities = [
    {
      id: 'professional',
      name: 'Profissional',
      emoji: '🎯',
      description: 'Formal e objetivo',
    },
    {
      id: 'friendly',
      name: 'Amigável',
      emoji: '😊',
      description: 'Caloroso e acolhedor',
    },
    {
      id: 'creative',
      name: 'Criativo',
      emoji: '🎨',
      description: 'Inovador e artístico',
    },
    {
      id: 'analytical',
      name: 'Analítico',
      emoji: '📊',
      description: 'Lógico e detalhado',
    },
    {
      id: 'casual',
      name: 'Descontraído',
      emoji: '😎',
      description: 'Informal e relaxado',
    },
    {
      id: 'empathetic',
      name: 'Empático',
      emoji: '❤️',
      description: 'Compreensivo e sensível',
    },
  ];

  const specializations = [
    {
      id: 'general',
      name: 'Assistente Geral',
      emoji: '🤖',
      description: 'Multipropósito',
    },
    {
      id: 'sales',
      name: 'Vendas & Marketing',
      emoji: '💼',
      description: 'Conversão e vendas',
    },
    {
      id: 'support',
      name: 'Suporte ao Cliente',
      emoji: '🛠️',
      description: 'Atendimento e suporte',
    },
    {
      id: 'education',
      name: 'Educação & Ensino',
      emoji: '📚',
      description: 'Ensino e treinamento',
    },
    {
      id: 'health',
      name: 'Saúde & Bem-estar',
      emoji: '🏥',
      description: 'Orientações de saúde',
    },
    {
      id: 'finance',
      name: 'Finanças & Consultoria',
      emoji: '💰',
      description: 'Consultoria financeira',
    },
  ];

  useEffect(() => {
    const initializeAgent = async () => {
      await fetchToken();
    };
    initializeAgent();
  }, []);

  useEffect(() => {
    if (token) {
      loadAvailableSessions();
    } else if (!tokenLoading) {
      setIsLoading(false);
    }
  }, [token, tokenLoading]);

  const fetchToken = async () => {
    try {
      setTokenLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

      // Get first available token for AI agent
      const response = await fetch(`${apiUrl}/api/management/tokens/list`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.tokens && result.tokens.length > 0) {
          // Get the full token value for the first token
          const firstToken = result.tokens[0];

          // Fetch the actual token value
          const tokenResponse = await fetch(
            `${apiUrl}/api/management/tokens/${firstToken._id}/full`,
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
              setToken(tokenResult.token);
            } else {
              console.error('Failed to get token value:', tokenResult.message);
            }
          } else {
            console.error('Error fetching token value:', tokenResponse.status);
          }
        } else {
          console.error('No tokens available for AI agent');
        }
      } else {
        console.error('Error fetching tokens:', response.status);
      }
    } catch (error) {
      console.error('Error fetching token:', error);
    } finally {
      setTokenLoading(false);
    }
  };

  const loadAvailableSessions = async () => {
    try {
      setIsLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

      const response = await fetch(`${apiUrl}/api/baileys/sessions`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Sessions API response:', result);

        if (result.success) {
          // Get sessions from the API response
          let sessionsData = result.sessions || [];

          // Filter for connected sessions
          const connectedSessions = sessionsData.filter(
            (session) =>
              session.connectionState === 'connected' ||
              session.isConnected === true
          );

          console.log('Available sessions:', sessionsData);
          console.log('Connected sessions:', connectedSessions);
          setAvailableSessions(connectedSessions);
        } else {
          console.error('Sessions API returned error:', result.message);
        }
      } else {
        console.error('Sessions request failed with status:', response.status);
      }
    } catch (error) {
      console.error('Error loading available sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!selectedSession) {
      errors.session = 'Selecione uma sessão WhatsApp';
    }

    if (!agentConfig.name.trim()) {
      errors.name = 'Nome do agente é obrigatório';
    } else if (agentConfig.name.length < 3) {
      errors.name = 'Nome deve ter pelo menos 3 caracteres';
    }

    if (!agentConfig.apiKey.trim()) {
      errors.apiKey = 'Chave da API OpenAI é obrigatória';
    } else if (!agentConfig.apiKey.startsWith('sk-')) {
      errors.apiKey = 'Chave da API deve começar com "sk-"';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleDeploy = async () => {
    try {
      // Clear previous errors
      setDeploymentError(null);
      setFormErrors({});

      // Validate form
      if (!validateForm()) {
        return;
      }

      setIsCreating(true);
      setDeploymentProgress(0);
      setDeploymentStatus('initializing');
      setShowDeployModal(true);

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

      // Create AI agent via backend API
      const agentData = {
        sessionId: selectedSession.sessionId,
        name: agentConfig.name.trim(),
        description: agentConfig.description.trim(),
        model: agentConfig.model,
        personality: agentConfig.personality,
        specialization: agentConfig.specialization,
        creativity: agentConfig.creativity,
        learningEnabled: agentConfig.learningEnabled,
        autoReply: agentConfig.autoReply,
        smartReplies: agentConfig.smartReplies,
        replyToGroups: agentConfig.replyToGroups,
        openaiApiKey: agentConfig.apiKey.trim(),
        tools: ['web_search'], // Initial tools
      };

      // Deployment progress simulation with real API call
      setDeploymentProgress(20);
      setDeploymentStatus('configuring');
      await new Promise((resolve) => setTimeout(resolve, 800));

      setDeploymentProgress(40);
      setDeploymentStatus('training');
      await new Promise((resolve) => setTimeout(resolve, 800));

      setDeploymentProgress(60);
      setDeploymentStatus('testing');

      const response = await fetch(`${apiUrl}/api/baileys/agents/create`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agentData),
      });

      setDeploymentProgress(80);
      setDeploymentStatus('deploying');
      await new Promise((resolve) => setTimeout(resolve, 800));

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setDeploymentProgress(100);
          setDeploymentStatus('completed');
        } else {
          throw new Error(result.message || 'Falha ao criar agente');
        }
      } else {
        const errorResult = await response.json().catch(() => ({}));
        const errorMessage =
          errorResult.message ||
          `Erro HTTP ${response.status}: ${response.statusText}`;

        // Handle specific error types
        if (response.status === 400) {
          if (errorMessage.includes('Já existe um agente ativo')) {
            throw new Error(
              'Já existe um agente ativo para esta sessão. Desative o agente atual primeiro.'
            );
          } else if (errorMessage.includes('API key')) {
            throw new Error(
              'Chave da API OpenAI inválida. Verifique se a chave está correta.'
            );
          } else if (errorMessage.includes('sessão')) {
            throw new Error('Sessão WhatsApp inválida ou não conectada.');
          }
        } else if (response.status === 401) {
          throw new Error('Erro de autenticação. Faça login novamente.');
        } else if (response.status === 403) {
          throw new Error('Permissão negada. Verifique suas credenciais.');
        } else if (response.status >= 500) {
          throw new Error(
            'Erro interno do servidor. Tente novamente em alguns minutos.'
          );
        }

        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Error deploying agent:', error);
      setDeploymentStatus('error');
      setDeploymentError(error.message);

      // Reset after showing error
      setTimeout(() => {
        if (deploymentStatus === 'error') {
          setShowDeployModal(false);
          setDeploymentStatus('idle');
          setDeploymentError(null);
        }
      }, 5000);
    } finally {
      setIsCreating(false);
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return selectedSession !== null;
      case 1:
        return agentConfig.name.trim() !== '';
      case 2:
        return agentConfig.apiKey.trim() !== '';
      default:
        return true;
    }
  };

  const getStatusMessage = (status) => {
    const messages = {
      initializing: 'Inicializando sistema...',
      configuring: 'Configurando modelo de IA...',
      training: 'Treinando personalidade...',
      testing: 'Testando conectividade...',
      deploying: 'Implantando agente...',
      completed: 'Agente implantado com sucesso!',
      error: 'Erro durante a implantação',
    };
    return messages[status] || 'Processando...';
  };

  const resetForm = () => {
    setCurrentStep(0);
    setSelectedSession(null);
    setAgentConfig({
      name: '',
      description: '',
      apiKey: '',
      model: 'gpt-4.1',
      personality: 'professional',
      specialization: 'general',
      creativity: 70,
      learningEnabled: true,
      autoReply: true,
      smartReplies: true,
      replyToGroups: true,
    });
    setFormErrors({});
    setDeploymentError(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-6">
              <CpuChipIcon className="w-8 h-8 text-white animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Inicializando Sistema de IA
            </h2>
            <p className="text-gray-600">
              {tokenLoading
                ? 'Autenticando...'
                : 'Carregando sessões disponíveis...'}
            </p>
            <div className="mt-6">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full animate-pulse"
                  style={{ width: '60%' }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <SparklesIcon className="w-10 h-10 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Agentes de IA FlowChat
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Crie e gerencie assistentes inteligentes personalizados com
              tecnologia de ponta
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="mb-8">
            <Tab.Group
              selectedIndex={currentTab === 'create' ? 0 : 1}
              onChange={(index) =>
                setCurrentTab(index === 0 ? 'create' : 'manage')
              }
            >
              <Tab.List className="flex space-x-1 rounded-xl bg-white p-1 shadow-lg max-w-md mx-auto">
                <Tab
                  className={({ selected }) =>
                    classNames(
                      'w-full rounded-lg py-3 px-4 text-sm font-medium leading-5 transition-all duration-200',
                      selected
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow'
                        : 'text-gray-600 hover:bg-gray-100'
                    )
                  }
                >
                  <div className="flex items-center justify-center">
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Criar Agente
                  </div>
                </Tab>
                <Tab
                  className={({ selected }) =>
                    classNames(
                      'w-full rounded-lg py-3 px-4 text-sm font-medium leading-5 transition-all duration-200',
                      selected
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow'
                        : 'text-gray-600 hover:bg-gray-100'
                    )
                  }
                >
                  <div className="flex items-center justify-center">
                    <SparklesIcon className="w-5 h-5 mr-2" />
                    Gerenciar Agentes
                  </div>
                </Tab>
              </Tab.List>
            </Tab.Group>
          </div>

          {currentTab === 'manage' ? (
            <AgentsList onRefresh={() => {}} />
          ) : (
            <div>
              {/* Premium Badge */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 text-black text-sm font-bold">
                  ⭐ CRIADOR EXCLUSIVO & PREMIUM
                </div>
              </div>

              {/* Progress Indicator */}
              <div className="mb-12">
                <div className="flex items-center justify-between">
                  {steps.map((step, index) => (
                    <div
                      key={step.id}
                      className="flex flex-col items-center flex-1"
                    >
                      <div
                        className={classNames(
                          'w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-all duration-300',
                          currentStep === index
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white scale-110'
                            : currentStep > index
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 text-gray-400'
                        )}
                      >
                        {currentStep > index ? (
                          <CheckIcon className="w-6 h-6" />
                        ) : (
                          <step.icon className="w-6 h-6" />
                        )}
                      </div>
                      <span
                        className={classNames(
                          'text-sm font-medium text-center',
                          currentStep >= index
                            ? 'text-gray-900'
                            : 'text-gray-400'
                        )}
                      >
                        {step.name}
                      </span>
                      {index < steps.length - 1 && (
                        <div
                          className={classNames(
                            'hidden sm:block absolute h-0.5 w-full mt-6 transform translate-y-6',
                            currentStep > index ? 'bg-green-500' : 'bg-gray-200'
                          )}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-6 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${((currentStep + 1) / steps.length) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-3">
                  <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-8 py-6">
                      <div className="flex items-center">
                        {React.createElement(steps[currentStep].icon, {
                          className: 'w-8 h-8 text-white mr-4',
                        })}
                        <div>
                          <h2 className="text-2xl font-bold text-white">
                            {steps[currentStep].name}
                          </h2>
                          <p className="text-purple-100 mt-1">
                            {steps[currentStep].description}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-8">
                      {/* Step 0: Number Selection */}
                      {currentStep === 0 && (
                        <div className="space-y-8">
                          <div className="text-center">
                            <InformationCircleIcon className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                              Selecione uma Sessão WhatsApp
                            </h3>
                            <p className="text-gray-600">
                              Escolha qual sessão será usada pelo seu agente de
                              IA
                            </p>
                          </div>

                          {formErrors.session && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                              <p className="text-sm text-red-600">
                                {formErrors.session}
                              </p>
                            </div>
                          )}

                          {availableSessions.length > 0 ? (
                            <Listbox
                              value={selectedSession}
                              onChange={(value) => {
                                setSelectedSession(value);
                                setFormErrors((prev) => ({
                                  ...prev,
                                  session: null,
                                }));
                              }}
                            >
                              <div className="relative">
                                <Listbox.Button
                                  className={classNames(
                                    'relative w-full cursor-pointer rounded-xl bg-gray-50 border-2 py-4 pl-6 pr-10 text-left focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200',
                                    formErrors.session
                                      ? 'border-red-300 hover:border-red-400'
                                      : 'border-gray-200 hover:border-purple-300'
                                  )}
                                >
                                  <span className="flex items-center">
                                    {selectedSession ? (
                                      <>
                                        <div className="w-3 h-3 bg-green-500 rounded-full mr-3" />
                                        <span className="block truncate font-medium">
                                          {selectedSession.sessionId}
                                        </span>
                                        <span className="ml-2 text-sm text-gray-500">
                                          ({selectedSession.status})
                                        </span>
                                      </>
                                    ) : (
                                      <span className="block truncate text-gray-400">
                                        Selecione uma sessão...
                                      </span>
                                    )}
                                  </span>
                                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                                    <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
                                  </span>
                                </Listbox.Button>

                                <Transition
                                  as={Fragment}
                                  leave="transition ease-in duration-100"
                                  leaveFrom="opacity-100"
                                  leaveTo="opacity-0"
                                >
                                  <Listbox.Options className="absolute z-10 mt-2 max-h-60 w-full overflow-auto rounded-xl bg-white py-2 shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none">
                                    {availableSessions.map((session) => (
                                      <Listbox.Option
                                        key={session.sessionId}
                                        className={({ active }) =>
                                          classNames(
                                            active
                                              ? 'bg-purple-50 text-purple-900'
                                              : 'text-gray-900',
                                            'relative cursor-pointer select-none py-3 pl-6 pr-10 hover:bg-purple-50 transition-colors duration-150'
                                          )
                                        }
                                        value={session}
                                      >
                                        {({ selected }) => (
                                          <>
                                            <div className="flex items-center">
                                              <div className="w-3 h-3 bg-green-500 rounded-full mr-3" />
                                              <span
                                                className={classNames(
                                                  selected
                                                    ? 'font-semibold'
                                                    : 'font-normal',
                                                  'block truncate'
                                                )}
                                              >
                                                {session.sessionId}
                                              </span>
                                              <span className="ml-2 text-sm text-gray-500">
                                                ({session.status})
                                              </span>
                                            </div>
                                            {selected && (
                                              <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-purple-600">
                                                <CheckIcon className="h-5 w-5" />
                                              </span>
                                            )}
                                          </>
                                        )}
                                      </Listbox.Option>
                                    ))}
                                  </Listbox.Options>
                                </Transition>
                              </div>
                            </Listbox>
                          ) : (
                            <div className="text-center py-12 bg-yellow-50 rounded-xl border-2 border-yellow-200">
                              <ExclamationTriangleIcon className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                              <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                                Nenhuma sessão disponível
                              </h3>
                              <p className="text-yellow-700">
                                Conecte pelo menos uma sessão WhatsApp para
                                continuar
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Step 1: Identity */}
                      {currentStep === 1 && (
                        <div className="space-y-8">
                          <Fieldset>
                            <Legend className="text-lg font-semibold text-gray-900 mb-6">
                              Identidade do Agente
                            </Legend>

                            <div className="space-y-6">
                              <Field>
                                <Label className="block text-sm font-medium text-gray-700 mb-2">
                                  Nome do Agente *
                                </Label>
                                <div className="relative">
                                  <UserIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                  <Input
                                    type="text"
                                    value={agentConfig.name}
                                    onChange={(e) => {
                                      setAgentConfig((prev) => ({
                                        ...prev,
                                        name: e.target.value,
                                      }));
                                      setFormErrors((prev) => ({
                                        ...prev,
                                        name: null,
                                      }));
                                    }}
                                    className={classNames(
                                      'block w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200',
                                      formErrors.name
                                        ? 'border-red-300 bg-red-50'
                                        : 'border-gray-200'
                                    )}
                                    placeholder="Ex: Aurora Assistant"
                                    required
                                  />
                                </div>
                                {formErrors.name && (
                                  <p className="mt-1 text-sm text-red-600">
                                    {formErrors.name}
                                  </p>
                                )}
                                <Description className="mt-2 text-sm text-gray-500">
                                  Escolha um nome único e memorável para seu
                                  assistente
                                </Description>
                              </Field>

                              <Field>
                                <Label className="block text-sm font-medium text-gray-700 mb-4">
                                  Especialização
                                </Label>
                                <RadioGroup
                                  value={agentConfig.specialization}
                                  onChange={(value) =>
                                    setAgentConfig((prev) => ({
                                      ...prev,
                                      specialization: value,
                                    }))
                                  }
                                >
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {specializations.map((spec) => (
                                      <RadioGroup.Option
                                        key={spec.id}
                                        value={spec.id}
                                        className={({ checked }) =>
                                          classNames(
                                            checked
                                              ? 'ring-2 ring-purple-500 bg-purple-50 border-purple-200'
                                              : 'border-gray-200 hover:border-purple-300',
                                            'relative cursor-pointer rounded-xl border-2 p-4 focus:outline-none transition-all duration-200'
                                          )
                                        }
                                      >
                                        {({ checked }) => (
                                          <div className="flex items-center text-center">
                                            <div className="text-center flex-1">
                                              <div className="text-3xl mb-2">
                                                {spec.emoji}
                                              </div>
                                              <h4 className="text-sm font-semibold text-gray-900">
                                                {spec.name}
                                              </h4>
                                              <p className="text-xs text-gray-500 mt-1">
                                                {spec.description}
                                              </p>
                                            </div>
                                            {checked && (
                                              <CheckIcon className="h-5 w-5 text-purple-600 absolute top-2 right-2" />
                                            )}
                                          </div>
                                        )}
                                      </RadioGroup.Option>
                                    ))}
                                  </div>
                                </RadioGroup>
                              </Field>

                              <Field>
                                <Label className="block text-sm font-medium text-gray-700 mb-2">
                                  Descrição (Opcional)
                                </Label>
                                <Textarea
                                  value={agentConfig.description}
                                  onChange={(e) =>
                                    setAgentConfig((prev) => ({
                                      ...prev,
                                      description: e.target.value,
                                    }))
                                  }
                                  rows={4}
                                  className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-none"
                                  placeholder="Descreva a personalidade e objetivos do seu agente..."
                                />
                                <Description className="mt-2 text-sm text-gray-500">
                                  Esta descrição ajudará a definir o
                                  comportamento do agente
                                </Description>
                              </Field>
                            </div>
                          </Fieldset>
                        </div>
                      )}

                      {/* Step 2: Intelligence */}
                      {currentStep === 2 && (
                        <div className="space-y-8">
                          <Fieldset>
                            <Legend className="text-lg font-semibold text-gray-900 mb-6">
                              Configuração de Inteligência
                            </Legend>

                            <div className="space-y-6">
                              <Field>
                                <Label className="block text-sm font-medium text-gray-700 mb-2">
                                  Modelo de IA
                                </Label>
                                <Listbox
                                  value={agentConfig.model}
                                  onChange={(value) =>
                                    setAgentConfig((prev) => ({
                                      ...prev,
                                      model: value,
                                    }))
                                  }
                                >
                                  <div className="relative">
                                    <Listbox.Button className="relative w-full cursor-pointer rounded-xl bg-gray-50 border-2 border-gray-200 hover:border-purple-300 py-3 pl-10 pr-10 text-left focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200">
                                      <CpuChipIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                      <span className="block truncate font-medium">
                                        {aiModels.find(
                                          (m) => m.id === agentConfig.model
                                        )?.name || 'Selecione...'}
                                      </span>
                                      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                                        <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
                                      </span>
                                    </Listbox.Button>

                                    <Transition
                                      as={Fragment}
                                      leave="transition ease-in duration-100"
                                      leaveFrom="opacity-100"
                                      leaveTo="opacity-0"
                                    >
                                      <Listbox.Options className="absolute z-10 mt-2 max-h-60 w-full overflow-auto rounded-xl bg-white py-2 shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none">
                                        {aiModels.map((model) => (
                                          <Listbox.Option
                                            key={model.id}
                                            className={({ active }) =>
                                              classNames(
                                                active
                                                  ? 'bg-purple-50 text-purple-900'
                                                  : 'text-gray-900',
                                                'relative cursor-pointer select-none py-3 pl-4 pr-10 hover:bg-purple-50 transition-colors duration-150'
                                              )
                                            }
                                            value={model.id}
                                          >
                                            {({ selected }) => (
                                              <>
                                                <div>
                                                  <span
                                                    className={classNames(
                                                      selected
                                                        ? 'font-semibold'
                                                        : 'font-normal',
                                                      'block truncate'
                                                    )}
                                                  >
                                                    {model.name}
                                                  </span>
                                                  <span className="text-sm text-gray-500">
                                                    {model.description}
                                                  </span>
                                                </div>
                                                {selected && (
                                                  <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-purple-600">
                                                    <CheckIcon className="h-5 w-5" />
                                                  </span>
                                                )}
                                              </>
                                            )}
                                          </Listbox.Option>
                                        ))}
                                      </Listbox.Options>
                                    </Transition>
                                  </div>
                                </Listbox>
                              </Field>

                              <Field>
                                <Label className="block text-sm font-medium text-gray-700 mb-2">
                                  Chave da API OpenAI *
                                </Label>
                                <div className="relative">
                                  <Cog6ToothIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                  <Input
                                    type="password"
                                    value={agentConfig.apiKey}
                                    onChange={(e) => {
                                      setAgentConfig((prev) => ({
                                        ...prev,
                                        apiKey: e.target.value,
                                      }));
                                      setFormErrors((prev) => ({
                                        ...prev,
                                        apiKey: null,
                                      }));
                                    }}
                                    className={classNames(
                                      'block w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200',
                                      formErrors.apiKey
                                        ? 'border-red-300 bg-red-50'
                                        : 'border-gray-200'
                                    )}
                                    placeholder="sk-..."
                                    required
                                  />
                                </div>
                                {formErrors.apiKey && (
                                  <p className="mt-1 text-sm text-red-600">
                                    {formErrors.apiKey}
                                  </p>
                                )}
                                <Description className="mt-2 text-sm text-gray-500">
                                  Sua chave será criptografada e armazenada com
                                  segurança
                                </Description>
                              </Field>

                              <Field>
                                <Label className="block text-sm font-medium text-gray-700 mb-4">
                                  Nível de Criatividade:{' '}
                                  {agentConfig.creativity}%
                                </Label>
                                <div className="space-y-2">
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="10"
                                    value={agentConfig.creativity}
                                    onChange={(e) =>
                                      setAgentConfig((prev) => ({
                                        ...prev,
                                        creativity: parseInt(e.target.value),
                                      }))
                                    }
                                    className="w-full h-3 bg-gradient-to-r from-blue-200 to-purple-200 rounded-lg appearance-none cursor-pointer slider"
                                  />
                                  <div className="flex justify-between text-xs text-gray-500">
                                    <span>Conservador</span>
                                    <span>Equilibrado</span>
                                    <span>Criativo</span>
                                  </div>
                                </div>
                                <Description className="mt-2 text-sm text-gray-500">
                                  Controla quão criativas serão as respostas do
                                  agente
                                </Description>
                              </Field>
                            </div>
                          </Fieldset>
                        </div>
                      )}

                      {/* Step 3: Personality */}
                      {currentStep === 3 && (
                        <div className="space-y-8">
                          <Fieldset>
                            <Legend className="text-lg font-semibold text-gray-900 mb-6">
                              Personalidade do Agente
                            </Legend>

                            <div className="space-y-6">
                              <Field>
                                <Label className="block text-sm font-medium text-gray-700 mb-4">
                                  Personalidade Principal
                                </Label>
                                <RadioGroup
                                  value={agentConfig.personality}
                                  onChange={(value) =>
                                    setAgentConfig((prev) => ({
                                      ...prev,
                                      personality: value,
                                    }))
                                  }
                                >
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {personalities.map((personality) => (
                                      <RadioGroup.Option
                                        key={personality.id}
                                        value={personality.id}
                                        className={({ checked }) =>
                                          classNames(
                                            checked
                                              ? 'ring-2 ring-purple-500 bg-purple-50 border-purple-200'
                                              : 'border-gray-200 hover:border-purple-300',
                                            'relative cursor-pointer rounded-xl border-2 p-4 focus:outline-none transition-all duration-200'
                                          )
                                        }
                                      >
                                        {({ checked }) => (
                                          <div className="text-center">
                                            <div className="text-3xl mb-3">
                                              {personality.emoji}
                                            </div>
                                            <h4 className="text-sm font-semibold text-gray-900 mb-1">
                                              {personality.name}
                                            </h4>
                                            <p className="text-xs text-gray-500">
                                              {personality.description}
                                            </p>
                                            {checked && (
                                              <CheckIcon className="h-5 w-5 text-purple-600 absolute top-2 right-2" />
                                            )}
                                          </div>
                                        )}
                                      </RadioGroup.Option>
                                    ))}
                                  </div>
                                </RadioGroup>
                              </Field>

                              <Disclosure>
                                {({ open }) => (
                                  <>
                                    <Disclosure.Button className="flex justify-between w-full px-6 py-4 text-sm font-medium text-left text-purple-900 bg-purple-50 rounded-xl hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200">
                                      <span className="flex items-center">
                                        <BoltIcon className="w-5 h-5 mr-2" />
                                        Configurações Avançadas
                                      </span>
                                      <ChevronDownIcon
                                        className={classNames(
                                          open ? 'rotate-180 transform' : '',
                                          'h-5 w-5 text-purple-500 transition-transform duration-200'
                                        )}
                                      />
                                    </Disclosure.Button>
                                    <Transition
                                      enter="transition duration-200 ease-out"
                                      enterFrom="transform scale-95 opacity-0"
                                      enterTo="transform scale-100 opacity-100"
                                      leave="transition duration-150 ease-out"
                                      leaveFrom="transform scale-100 opacity-100"
                                      leaveTo="transform scale-95 opacity-0"
                                    >
                                      <Disclosure.Panel className="px-6 py-4 mt-2 bg-gray-50 rounded-xl">
                                        <div className="space-y-4">
                                          <Field className="flex items-center justify-between">
                                            <div>
                                              <Label className="text-sm font-medium text-gray-900">
                                                Aprendizado Contínuo
                                              </Label>
                                              <Description className="text-sm text-gray-500">
                                                Permite que o agente aprenda com
                                                conversas
                                              </Description>
                                            </div>
                                            <Switch
                                              checked={
                                                agentConfig.learningEnabled
                                              }
                                              onChange={(checked) =>
                                                setAgentConfig((prev) => ({
                                                  ...prev,
                                                  learningEnabled: checked,
                                                }))
                                              }
                                              className={classNames(
                                                agentConfig.learningEnabled
                                                  ? 'bg-purple-600'
                                                  : 'bg-gray-200',
                                                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2'
                                              )}
                                            >
                                              <span
                                                className={classNames(
                                                  agentConfig.learningEnabled
                                                    ? 'translate-x-6'
                                                    : 'translate-x-1',
                                                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform'
                                                )}
                                              />
                                            </Switch>
                                          </Field>

                                          <Field className="flex items-center justify-between">
                                            <div>
                                              <Label className="text-sm font-medium text-gray-900">
                                                Respostas Automáticas
                                              </Label>
                                              <Description className="text-sm text-gray-500">
                                                Responde automaticamente às
                                                mensagens
                                              </Description>
                                            </div>
                                            <Switch
                                              checked={agentConfig.autoReply}
                                              onChange={(checked) =>
                                                setAgentConfig((prev) => ({
                                                  ...prev,
                                                  autoReply: checked,
                                                }))
                                              }
                                              className={classNames(
                                                agentConfig.autoReply
                                                  ? 'bg-purple-600'
                                                  : 'bg-gray-200',
                                                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2'
                                              )}
                                            >
                                              <span
                                                className={classNames(
                                                  agentConfig.autoReply
                                                    ? 'translate-x-6'
                                                    : 'translate-x-1',
                                                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform'
                                                )}
                                              />
                                            </Switch>
                                          </Field>

                                          <Field className="flex items-center justify-between">
                                            <div>
                                              <Label className="text-sm font-medium text-gray-900">
                                                Responder em Grupos
                                              </Label>
                                              <Description className="text-sm text-gray-500">
                                                Permite que o agente responda
                                                mensagens de grupos
                                              </Description>
                                            </div>
                                            <Switch
                                              checked={
                                                agentConfig.replyToGroups
                                              }
                                              onChange={(checked) =>
                                                setAgentConfig((prev) => ({
                                                  ...prev,
                                                  replyToGroups: checked,
                                                }))
                                              }
                                              className={classNames(
                                                agentConfig.replyToGroups
                                                  ? 'bg-purple-600'
                                                  : 'bg-gray-200',
                                                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2'
                                              )}
                                            >
                                              <span
                                                className={classNames(
                                                  agentConfig.replyToGroups
                                                    ? 'translate-x-6'
                                                    : 'translate-x-1',
                                                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform'
                                                )}
                                              />
                                            </Switch>
                                          </Field>
                                        </div>
                                      </Disclosure.Panel>
                                    </Transition>
                                  </>
                                )}
                              </Disclosure>
                            </div>
                          </Fieldset>
                        </div>
                      )}

                      {/* Step 4: Deploy */}
                      {currentStep === 4 && (
                        <div className="space-y-8">
                          <div className="text-center">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <CheckIcon className="w-8 h-8 text-green-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                              Configuração Concluída
                            </h3>
                            <p className="text-gray-600">
                              Seu agente está pronto para ser implantado
                            </p>
                          </div>

                          <div className="bg-gray-50 rounded-xl p-6">
                            <h4 className="text-lg font-semibold text-gray-900 mb-4">
                              Resumo da Configuração
                            </h4>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600">
                                  Sessão WhatsApp:
                                </span>
                                <span className="font-medium bg-gray-200 px-3 py-1 rounded-lg text-sm">
                                  {selectedSession?.sessionId}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600">Nome:</span>
                                <span className="font-medium">
                                  {agentConfig.name}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600">
                                  Especialização:
                                </span>
                                <span className="font-medium">
                                  {
                                    specializations.find(
                                      (s) => s.id === agentConfig.specialization
                                    )?.name
                                  }
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600">
                                  Modelo de IA:
                                </span>
                                <span className="font-medium bg-blue-100 px-3 py-1 rounded-lg text-sm">
                                  {
                                    aiModels.find(
                                      (m) => m.id === agentConfig.model
                                    )?.name
                                  }
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600">
                                  Personalidade:
                                </span>
                                <span className="font-medium">
                                  {
                                    personalities.find(
                                      (p) => p.id === agentConfig.personality
                                    )?.name
                                  }
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600">
                                  Responde em Grupos:
                                </span>
                                <span
                                  className={`font-medium px-2 py-1 rounded-lg text-sm ${
                                    agentConfig.replyToGroups
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {agentConfig.replyToGroups ? 'Sim' : 'Não'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <Button
                            onClick={handleDeploy}
                            disabled={isCreating}
                            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:from-purple-600 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
                          >
                            <RocketLaunchIcon className="w-6 h-6 mr-2" />
                            {isCreating ? 'Implantando...' : 'Implantar Agente'}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Navigation */}
                    <div className="bg-gray-50 px-8 py-6 flex justify-between">
                      <Button
                        onClick={prevStep}
                        disabled={currentStep === 0}
                        className="px-6 py-2 text-gray-600 bg-white border-2 border-gray-200 rounded-xl hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      >
                        Anterior
                      </Button>

                      {currentStep < steps.length - 1 && (
                        <Button
                          onClick={nextStep}
                          disabled={!canProceed()}
                          className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center"
                        >
                          Próximo
                          <ArrowRightIcon className="w-4 h-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-1">
                  <div className="bg-white rounded-2xl shadow-xl p-6 sticky top-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">
                      Recursos Exclusivos
                    </h3>
                    <div className="space-y-4">
                      {[
                        {
                          icon: '🧠',
                          title: 'IA Avançada',
                          desc: 'Modelos de última geração',
                        },
                        {
                          icon: '📚',
                          title: 'Aprendizado',
                          desc: 'Melhora com cada conversa',
                        },
                        {
                          icon: '⚡',
                          title: 'Respostas Rápidas',
                          desc: 'Processamento em tempo real',
                        },
                        {
                          icon: '🔒',
                          title: 'Segurança',
                          desc: 'Dados criptografados',
                        },
                        {
                          icon: '🚀',
                          title: 'Deploy Rápido',
                          desc: 'Ativo em minutos',
                        },
                      ].map((feature, index) => (
                        <div key={index} className="flex items-start space-x-3">
                          <div className="text-2xl">{feature.icon}</div>
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {feature.title}
                            </h4>
                            <p className="text-sm text-gray-500">
                              {feature.desc}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Deployment Modal */}
          <Transition show={showDeployModal} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={() => {}}>
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
                    <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-8 text-center shadow-2xl transition-all">
                      <div className="mb-6">
                        {deploymentStatus === 'completed' ? (
                          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckIcon className="w-8 h-8 text-green-600" />
                          </div>
                        ) : deploymentStatus === 'error' ? (
                          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ExclamationTriangleIcon className="w-8 h-8 text-red-600" />
                          </div>
                        ) : (
                          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <RocketLaunchIcon className="w-8 h-8 text-white animate-pulse" />
                          </div>
                        )}

                        <Dialog.Title
                          className={classNames(
                            'text-xl font-bold mb-2',
                            deploymentStatus === 'completed'
                              ? 'text-green-900'
                              : deploymentStatus === 'error'
                              ? 'text-red-900'
                              : 'text-gray-900'
                          )}
                        >
                          {deploymentStatus === 'completed'
                            ? 'Agente Implantado!'
                            : deploymentStatus === 'error'
                            ? 'Erro na Implantação'
                            : 'Implantando Agente'}
                        </Dialog.Title>

                        <p
                          className={classNames(
                            'mb-6',
                            deploymentStatus === 'error'
                              ? 'text-red-600'
                              : 'text-gray-600'
                          )}
                        >
                          {deploymentStatus === 'error' && deploymentError
                            ? deploymentError
                            : getStatusMessage(deploymentStatus)}
                        </p>

                        {deploymentStatus !== 'completed' && (
                          <div className="mb-6">
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div
                                className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500"
                                style={{ width: `${deploymentProgress}%` }}
                              />
                            </div>
                            <p className="text-sm text-gray-500 mt-2">
                              {deploymentProgress}% concluído
                            </p>
                          </div>
                        )}
                      </div>

                      {deploymentStatus === 'completed' && (
                        <div className="space-y-3">
                          <Button
                            onClick={() => window.open('/dashboard', '_blank')}
                            className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                          >
                            Ver Dashboard
                          </Button>
                          <Button
                            onClick={() => {
                              setShowDeployModal(false);
                              resetForm();
                            }}
                            className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-xl hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all duration-200"
                          >
                            Criar Novo Agente
                          </Button>
                        </div>
                      )}

                      {deploymentStatus === 'error' && (
                        <div className="space-y-3">
                          <Button
                            onClick={() => {
                              setShowDeployModal(false);
                              setDeploymentStatus('idle');
                              setDeploymentError(null);
                            }}
                            className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-xl hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all duration-200"
                          >
                            Fechar
                          </Button>
                          <Button
                            onClick={() => {
                              setShowDeployModal(false);
                              setDeploymentStatus('idle');
                              setDeploymentError(null);
                              // Retry deployment
                              setTimeout(() => handleDeploy(), 500);
                            }}
                            className="w-full bg-purple-600 text-white py-3 px-4 rounded-xl hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200"
                          >
                            Tentar Novamente
                          </Button>
                        </div>
                      )}
                    </Dialog.Panel>
                  </Transition.Child>
                </div>
              </div>
            </Dialog>
          </Transition>
        </div>
      </div>
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(to right, #8b5cf6, #ec4899);
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(to right, #8b5cf6, #ec4899);
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </>
  );
}
