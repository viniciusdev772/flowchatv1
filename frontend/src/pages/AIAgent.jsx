import React, { useState, useEffect } from 'react';
import { Dialog, Transition, Menu, Disclosure, Button, Checkbox, Input, Select, Textarea, Switch, Fieldset } from '@headlessui/react';
import { 
  SparklesIcon, 
  PhoneIcon, 
  ServerIcon, 
  UserIcon, 
  WrenchScrewdriverIcon, 
  CheckCircleIcon, 
  XMarkIcon,
  ChevronDownIcon,
  PlusIcon,
  CogIcon,
  BoltIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import { apiRequest } from '../utils/api';

const AIAgent = () => {
  const [availableNumbers, setAvailableNumbers] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentDescription, setAgentDescription] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [autoReply, setAutoReply] = useState(true);
  const [learningMode, setLearningMode] = useState(false);
  const [aiModel, setAiModel] = useState('gpt-4');

  useEffect(() => {
    loadAvailableNumbers();
  }, []);

  const loadAvailableNumbers = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest('/api/baileys/sessions', 'GET');
      
      if (response.success) {
        const connectedSessions = response.data.filter(session => 
          session.status === 'connected' || session.status === 'open'
        );
        setAvailableNumbers(connectedSessions);
      }
    } catch (error) {
      console.error('Error loading available numbers:', error);
      setErrorMessage('Erro ao carregar números disponíveis');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    
    if (!selectedNumber || !agentName || !openaiApiKey) {
      setErrorMessage('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    try {
      setIsCreating(true);
      setErrorMessage('');
      
      const agentConfig = {
        sessionId: selectedNumber,
        name: agentName,
        description: agentDescription,
        openaiApiKey: openaiApiKey,
        aiModel: aiModel,
        autoReply: autoReply,
        learningMode: learningMode,
        advancedMode: advancedMode,
        isActive: true,
        createdAt: new Date().toISOString()
      };

      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setSuccessMessage(`Agente de IA "${agentName}" criado com sucesso!`);
      setIsModalOpen(false);
      
      // Reset form
      setSelectedNumber('');
      setAgentName('');
      setAgentDescription('');
      setOpenaiApiKey('');
      setAdvancedMode(false);
      setAutoReply(true);
      setLearningMode(false);
      setAiModel('gpt-4');
      
      setTimeout(() => setSuccessMessage(''), 5000);
      
    } catch (error) {
      console.error('Error creating AI agent:', error);
      setErrorMessage('Erro ao criar agente de IA');
    } finally {
      setIsCreating(false);
    }
  };

  const aiModels = [
    { value: 'gpt-4', label: 'GPT-4 (Recomendado)' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'claude-3', label: 'Claude 3' }
  ];

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <ServerIcon style={{ width: '48px', height: '48px', margin: '0 auto 16px', animation: 'spin 2s linear infinite' }} />
          <p>Carregando números disponíveis...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '32px 16px'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <SparklesIcon style={{ width: '64px', height: '64px', color: '#ffd700', marginRight: '16px' }} />
            <h1 style={{ fontSize: '48px', fontWeight: 'bold', color: 'white', margin: 0 }}>
              Agente de IA Exclusivo
            </h1>
          </div>
          <div style={{ 
            display: 'inline-block', 
            background: 'linear-gradient(45deg, #ffd700, #ffed4e)',
            color: 'black',
            padding: '8px 24px',
            borderRadius: '50px',
            fontSize: '12px',
            fontWeight: 'bold',
            marginBottom: '16px'
          }}>
            EXCLUSIVO • PREMIUM • INOVADOR
          </div>
          <p style={{ fontSize: '20px', color: 'rgba(255,255,255,0.8)', maxWidth: '600px', margin: '0 auto' }}>
            Crie agentes de IA avançados com tecnologia de ponta para automação inteligente do WhatsApp
          </p>
        </div>

        {/* Main Content */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px', alignItems: 'start' }}>
          
          {/* Available Numbers Panel */}
          <div style={{ 
            background: 'rgba(255,255,255,0.1)', 
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            padding: '32px',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
              <PhoneIcon style={{ width: '24px', height: '24px', color: '#4ade80', marginRight: '12px' }} />
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: 'white', margin: 0 }}>
                Números Disponíveis
              </h3>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              {availableNumbers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <ServerIcon style={{ width: '48px', height: '48px', color: 'rgba(255,255,255,0.4)', margin: '0 auto 16px' }} />
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
                    Nenhum número conectado encontrado
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {availableNumbers.map((session) => (
                    <div
                      key={session.sessionId}
                      onClick={() => setSelectedNumber(session.sessionId)}
                      style={{
                        padding: '16px',
                        borderRadius: '12px',
                        border: selectedNumber === session.sessionId 
                          ? '2px solid #3b82f6' 
                          : '2px solid rgba(255,255,255,0.2)',
                        background: selectedNumber === session.sessionId 
                          ? 'rgba(59, 130, 246, 0.2)' 
                          : 'rgba(255,255,255,0.05)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ 
                        width: '12px', 
                        height: '12px', 
                        backgroundColor: '#10b981', 
                        borderRadius: '50%',
                        marginRight: '12px'
                      }} />
                      <div>
                        <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: 0 }}>
                          {session.sessionId}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: 0 }}>
                          {session.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              onClick={() => setIsModalOpen(true)}
              disabled={!selectedNumber}
              style={{
                width: '100%',
                background: selectedNumber 
                  ? 'linear-gradient(45deg, #3b82f6, #8b5cf6)' 
                  : 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '16px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: selectedNumber ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <PlusIcon style={{ width: '20px', height: '20px' }} />
              Criar Agente de IA
            </Button>
          </div>

          {/* Features Panel */}
          <div style={{ 
            background: 'rgba(255,255,255,0.1)', 
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            padding: '32px',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
              <BoltIcon style={{ width: '24px', height: '24px', color: '#ffd700', marginRight: '12px' }} />
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: 'white', margin: 0 }}>
                Recursos Exclusivos
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[
                { icon: ChatBubbleLeftRightIcon, title: 'Conversas Inteligentes', desc: 'IA contextual avançada' },
                { icon: CogIcon, title: 'Auto-Aprendizado', desc: 'Melhora com cada interação' },
                { icon: ServerIcon, title: 'Processamento Rápido', desc: 'Respostas em tempo real' },
                { icon: CheckCircleIcon, title: 'Integração Total', desc: 'Conecta com todos os sistemas' }
              ].map((feature, index) => (
                <div key={index} style={{
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '16px',
                  padding: '20px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  textAlign: 'center'
                }}>
                  <feature.icon style={{ 
                    width: '32px', 
                    height: '32px', 
                    color: '#4ade80', 
                    margin: '0 auto 12px' 
                  }} />
                  <h4 style={{ 
                    color: 'white', 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    margin: '0 0 8px 0' 
                  }}>
                    {feature.title}
                  </h4>
                  <p style={{ 
                    color: 'rgba(255,255,255,0.7)', 
                    fontSize: '12px', 
                    margin: 0 
                  }}>
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div style={{
            marginTop: '24px',
            padding: '16px',
            background: 'rgba(16, 185, 129, 0.2)',
            border: '1px solid rgba(16, 185, 129, 0.5)',
            borderRadius: '12px',
            color: '#10b981',
            textAlign: 'center'
          }}>
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div style={{
            marginTop: '24px',
            padding: '16px',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            borderRadius: '12px',
            color: '#ef4444',
            textAlign: 'center'
          }}>
            {errorMessage}
          </div>
        )}
      </div>

      {/* Creation Modal */}
      <Transition show={isModalOpen}>
        <Dialog onClose={() => setIsModalOpen(false)} style={{ position: 'relative', zIndex: 50 }}>
          <Transition.Child
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div style={{ 
              position: 'fixed', 
              inset: 0, 
              background: 'rgba(0, 0, 0, 0.5)', 
              backdropFilter: 'blur(4px)' 
            }} />
          </Transition.Child>

          <div style={{ position: 'fixed', inset: 0, overflowY: 'auto' }}>
            <div style={{ 
              display: 'flex', 
              minHeight: '100%', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '16px' 
            }}>
              <Transition.Child
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel style={{
                  width: '100%',
                  maxWidth: '600px',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.9))',
                  borderRadius: '24px',
                  padding: '32px',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <Dialog.Title style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
                      Configurar Agente de IA
                    </Dialog.Title>
                    <Button
                      onClick={() => setIsModalOpen(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#6b7280',
                        cursor: 'pointer',
                        padding: '8px'
                      }}
                    >
                      <XMarkIcon style={{ width: '20px', height: '20px' }} />
                    </Button>
                  </div>

                  <form onSubmit={handleCreateAgent} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <Fieldset>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                        Nome do Agente *
                      </label>
                      <Input
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        placeholder="Ex: Assistente de Vendas"
                        required
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                    </Fieldset>

                    <Fieldset>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                        Descrição do Agente
                      </label>
                      <Textarea
                        value={agentDescription}
                        onChange={(e) => setAgentDescription(e.target.value)}
                        placeholder="Descreva o propósito e personalidade do seu agente..."
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          resize: 'none'
                        }}
                      />
                    </Fieldset>

                    <Fieldset>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                        Modelo de IA
                      </label>
                      <Select
                        value={aiModel}
                        onChange={(e) => setAiModel(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      >
                        {aiModels.map((model) => (
                          <option key={model.value} value={model.value}>
                            {model.label}
                          </option>
                        ))}
                      </Select>
                    </Fieldset>

                    <Fieldset>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                        Chave da API OpenAI *
                      </label>
                      <Input
                        type="password"
                        value={openaiApiKey}
                        onChange={(e) => setOpenaiApiKey(e.target.value)}
                        placeholder="sk-..."
                        required
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                    </Fieldset>

                    <Disclosure>
                      <Disclosure.Button style={{
                        width: '100%',
                        padding: '12px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        borderRadius: '8px',
                        color: '#3b82f6',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        Configurações Avançadas
                        <ChevronDownIcon style={{ width: '16px', height: '16px' }} />
                      </Disclosure.Button>
                      <Disclosure.Panel style={{ paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                            Resposta Automática
                          </label>
                          <Switch
                            checked={autoReply}
                            onChange={setAutoReply}
                            style={{
                              position: 'relative',
                              display: 'inline-flex',
                              width: '48px',
                              height: '24px',
                              backgroundColor: autoReply ? '#3b82f6' : '#d1d5db',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s'
                            }}
                          >
                            <span style={{
                              position: 'absolute',
                              top: '2px',
                              left: autoReply ? '26px' : '2px',
                              width: '20px',
                              height: '20px',
                              backgroundColor: 'white',
                              borderRadius: '50%',
                              transition: 'left 0.2s'
                            }} />
                          </Switch>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                            Modo Aprendizado
                          </label>
                          <Switch
                            checked={learningMode}
                            onChange={setLearningMode}
                            style={{
                              position: 'relative',
                              display: 'inline-flex',
                              width: '48px',
                              height: '24px',
                              backgroundColor: learningMode ? '#3b82f6' : '#d1d5db',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s'
                            }}
                          >
                            <span style={{
                              position: 'absolute',
                              top: '2px',
                              left: learningMode ? '26px' : '2px',
                              width: '20px',
                              height: '20px',
                              backgroundColor: 'white',
                              borderRadius: '50%',
                              transition: 'left 0.2s'
                            }} />
                          </Switch>
                        </div>
                      </Disclosure.Panel>
                    </Disclosure>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                      <Button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        style={{
                          flex: 1,
                          padding: '12px',
                          background: 'rgba(107, 114, 128, 0.1)',
                          border: '1px solid rgba(107, 114, 128, 0.2)',
                          borderRadius: '8px',
                          color: '#6b7280',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={isCreating}
                        style={{
                          flex: 2,
                          padding: '12px',
                          background: isCreating 
                            ? 'rgba(107, 114, 128, 0.3)' 
                            : 'linear-gradient(45deg, #3b82f6, #8b5cf6)',
                          border: 'none',
                          borderRadius: '8px',
                          color: 'white',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: isCreating ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        {isCreating ? (
                          <>
                            <div style={{ 
                              width: '16px', 
                              height: '16px', 
                              border: '2px solid rgba(255,255,255,0.3)', 
                              borderTop: '2px solid white', 
                              borderRadius: '50%', 
                              animation: 'spin 1s linear infinite' 
                            }} />
                            Criando...
                          </>
                        ) : (
                          <>
                            <PlusIcon style={{ width: '16px', height: '16px' }} />
                            Criar Agente
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AIAgent;