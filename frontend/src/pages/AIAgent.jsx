import React, { useState, useEffect } from 'react';
import { Dialog, Transition, Menu, Disclosure, Button, Checkbox, Input, Select, Textarea, Switch, Fieldset, Tab } from '@headlessui/react';
import { 
  SparklesIcon, 
  PhoneIcon, 
  CpuChipIcon, 
  RocketLaunchIcon, 
  BeakerIcon, 
  AcademicCapIcon, 
  BoltIcon,
  ArrowRightIcon,
  CheckIcon,
  StarIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { apiRequest } from '../utils/api';

const AIAgent = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [availableNumbers, setAvailableNumbers] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState('');
  const [agentConfig, setAgentConfig] = useState({
    name: '',
    description: '',
    apiKey: '',
    model: 'gpt-4',
    personality: 'professional',
    specialization: 'general',
    creativity: 0.7,
    responseSpeed: 'fast',
    learningEnabled: true,
    memoryRetention: 'session'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState('idle');

  const steps = [
    { id: 0, title: 'Número', icon: PhoneIcon, color: '#ff6b6b' },
    { id: 1, title: 'Identidade', icon: AcademicCapIcon, color: '#4ecdc4' },
    { id: 2, title: 'Inteligência', icon: CpuChipIcon, color: '#45b7d1' },
    { id: 3, title: 'Personalidade', icon: BeakerIcon, color: '#96ceb4' },
    { id: 4, title: 'Deploy', icon: RocketLaunchIcon, color: '#feca57' }
  ];

  const personalities = [
    { id: 'professional', name: 'Profissional', emoji: '🎯', desc: 'Formal e objetivo' },
    { id: 'friendly', name: 'Amigável', emoji: '😊', desc: 'Caloroso e acolhedor' },
    { id: 'creative', name: 'Criativo', emoji: '🎨', desc: 'Inovador e artístico' },
    { id: 'analytical', name: 'Analítico', emoji: '📊', desc: 'Lógico e detalhado' },
    { id: 'casual', name: 'Descontraído', emoji: '😎', desc: 'Informal e relaxado' },
    { id: 'empathetic', name: 'Empático', emoji: '❤️', desc: 'Compreensivo e sensível' }
  ];

  const specializations = [
    { id: 'general', name: 'Assistente Geral', icon: '🤖' },
    { id: 'sales', name: 'Vendas & Marketing', icon: '💼' },
    { id: 'support', name: 'Suporte ao Cliente', icon: '🛠️' },
    { id: 'education', name: 'Educação & Ensino', icon: '📚' },
    { id: 'health', name: 'Saúde & Bem-estar', icon: '🏥' },
    { id: 'finance', name: 'Finanças & Consultoria', icon: '💰' }
  ];

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
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeploy = async () => {
    setIsCreating(true);
    setDeploymentStatus('initializing');
    
    // Simulate deployment steps
    setTimeout(() => setDeploymentStatus('configuring'), 1000);
    setTimeout(() => setDeploymentStatus('training'), 2000);
    setTimeout(() => setDeploymentStatus('testing'), 3000);
    setTimeout(() => setDeploymentStatus('deploying'), 4000);
    setTimeout(() => {
      setDeploymentStatus('completed');
      setIsCreating(false);
    }, 5000);
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

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at 20% 50%, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <CpuChipIcon style={{ 
            width: '80px', 
            height: '80px', 
            color: '#ff6b6b',
            animation: 'pulse 2s infinite',
            margin: '0 auto 20px'
          }} />
          <h2 style={{ color: '#2c3e50', fontSize: '24px', fontWeight: '300' }}>
            Inicializando Sistema de IA
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at 20% 50%, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)',
      padding: '0'
    }}>
      {/* Floating Navigation */}
      <div style={{
        position: 'fixed',
        top: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(20px)',
        borderRadius: '50px',
        padding: '8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = currentStep === index;
            const isCompleted = currentStep > index;
            
            return (
              <div
                key={step.id}
                onClick={() => setCurrentStep(index)}
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: isActive ? step.color : isCompleted ? '#2ecc71' : 'rgba(255,255,255,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                  boxShadow: isActive ? `0 8px 25px ${step.color}40` : 'none'
                }}
              >
                {isCompleted ? (
                  <CheckIcon style={{ width: '24px', height: '24px', color: 'white' }} />
                ) : (
                  <StepIcon style={{ 
                    width: '24px', 
                    height: '24px', 
                    color: isActive ? 'white' : '#7f8c8d'
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ 
        paddingTop: '140px', 
        paddingBottom: '80px',
        paddingLeft: '40px',
        paddingRight: '40px'
      }}>
        {currentStep === 0 && (
          <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '30px',
              padding: '60px 40px',
              color: 'white',
              marginBottom: '40px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute',
                top: '-50px',
                right: '-50px',
                width: '200px',
                height: '200px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '50%'
              }} />
              
              <PhoneIcon style={{ width: '80px', height: '80px', margin: '0 auto 20px' }} />
              <h1 style={{ fontSize: '48px', fontWeight: '100', margin: '0 0 16px' }}>
                Selecione um Número
              </h1>
              <p style={{ fontSize: '20px', opacity: 0.9, fontWeight: '300' }}>
                Escolha o número WhatsApp que será usado pelo seu agente de IA
              </p>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px'
            }}>
              {availableNumbers.map((session) => (
                <div
                  key={session.sessionId}
                  onClick={() => setSelectedNumber(session.sessionId)}
                  style={{
                    background: selectedNumber === session.sessionId 
                      ? 'linear-gradient(135deg, #ff6b6b, #ee5a52)' 
                      : 'white',
                    color: selectedNumber === session.sessionId ? 'white' : '#2c3e50',
                    borderRadius: '20px',
                    padding: '30px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    transform: selectedNumber === session.sessionId ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: selectedNumber === session.sessionId 
                      ? '0 15px 35px rgba(255,107,107,0.3)'
                      : '0 8px 25px rgba(0,0,0,0.1)',
                    border: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ fontSize: '24px', fontWeight: '600', margin: '0 0 8px' }}>
                        {session.sessionId}
                      </h3>
                      <p style={{ 
                        fontSize: '14px', 
                        opacity: 0.8, 
                        margin: 0,
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                      }}>
                        {session.status}
                      </p>
                    </div>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: '#2ecc71'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{
              background: 'white',
              borderRadius: '30px',
              padding: '50px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.1)'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <AcademicCapIcon style={{ 
                  width: '60px', 
                  height: '60px', 
                  color: '#4ecdc4',
                  margin: '0 auto 20px'
                }} />
                <h2 style={{ fontSize: '36px', fontWeight: '300', color: '#2c3e50', margin: '0 0 12px' }}>
                  Identidade do Agente
                </h2>
                <p style={{ color: '#7f8c8d', fontSize: '16px' }}>
                  Defina o nome e propósito do seu assistente de IA
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '16px', 
                    fontWeight: '500', 
                    color: '#2c3e50', 
                    marginBottom: '12px' 
                  }}>
                    Nome do Agente
                  </label>
                  <Input
                    value={agentConfig.name}
                    onChange={(e) => setAgentConfig({...agentConfig, name: e.target.value})}
                    placeholder="Ex: Aurora Assistant"
                    style={{
                      width: '100%',
                      padding: '18px 24px',
                      border: '2px solid #ecf0f1',
                      borderRadius: '15px',
                      fontSize: '16px',
                      background: '#fafbfc',
                      outline: 'none',
                      transition: 'all 0.3s ease'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#4ecdc4'}
                    onBlur={(e) => e.target.style.borderColor = '#ecf0f1'}
                  />
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '16px', 
                    fontWeight: '500', 
                    color: '#2c3e50', 
                    marginBottom: '12px' 
                  }}>
                    Especialização
                  </label>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(2, 1fr)', 
                    gap: '12px' 
                  }}>
                    {specializations.map((spec) => (
                      <div
                        key={spec.id}
                        onClick={() => setAgentConfig({...agentConfig, specialization: spec.id})}
                        style={{
                          padding: '16px',
                          borderRadius: '12px',
                          background: agentConfig.specialization === spec.id ? '#4ecdc4' : '#f8f9fa',
                          color: agentConfig.specialization === spec.id ? 'white' : '#2c3e50',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          textAlign: 'center',
                          border: '2px solid transparent'
                        }}
                      >
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>{spec.icon}</div>
                        <div style={{ fontSize: '14px', fontWeight: '500' }}>{spec.name}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '16px', 
                    fontWeight: '500', 
                    color: '#2c3e50', 
                    marginBottom: '12px' 
                  }}>
                    Descrição (Opcional)
                  </label>
                  <Textarea
                    value={agentConfig.description}
                    onChange={(e) => setAgentConfig({...agentConfig, description: e.target.value})}
                    placeholder="Descreva a personalidade e objetivos do seu agente..."
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '18px 24px',
                      border: '2px solid #ecf0f1',
                      borderRadius: '15px',
                      fontSize: '16px',
                      background: '#fafbfc',
                      outline: 'none',
                      resize: 'none',
                      transition: 'all 0.3s ease'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#4ecdc4'}
                    onBlur={(e) => e.target.style.borderColor = '#ecf0f1'}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div style={{ maxWidth: '700px', margin: '0 auto' }}>
            <div style={{
              background: 'white',
              borderRadius: '30px',
              padding: '50px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.1)'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <CpuChipIcon style={{ 
                  width: '60px', 
                  height: '60px', 
                  color: '#45b7d1',
                  margin: '0 auto 20px'
                }} />
                <h2 style={{ fontSize: '36px', fontWeight: '300', color: '#2c3e50', margin: '0 0 12px' }}>
                  Configuração de IA
                </h2>
                <p style={{ color: '#7f8c8d', fontSize: '16px' }}>
                  Configure os parâmetros de inteligência do seu agente
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '16px', 
                    fontWeight: '500', 
                    color: '#2c3e50', 
                    marginBottom: '12px' 
                  }}>
                    Modelo de IA
                  </label>
                  <Select
                    value={agentConfig.model}
                    onChange={(e) => setAgentConfig({...agentConfig, model: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '18px 24px',
                      border: '2px solid #ecf0f1',
                      borderRadius: '15px',
                      fontSize: '16px',
                      background: '#fafbfc',
                      outline: 'none'
                    }}
                  >
                    <option value="gpt-4">GPT-4 (Recomendado)</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    <option value="claude-3">Claude 3</option>
                    <option value="gemini-pro">Gemini Pro</option>
                  </Select>
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '16px', 
                    fontWeight: '500', 
                    color: '#2c3e50', 
                    marginBottom: '12px' 
                  }}>
                    Chave da API OpenAI
                  </label>
                  <Input
                    type="password"
                    value={agentConfig.apiKey}
                    onChange={(e) => setAgentConfig({...agentConfig, apiKey: e.target.value})}
                    placeholder="sk-..."
                    style={{
                      width: '100%',
                      padding: '18px 24px',
                      border: '2px solid #ecf0f1',
                      borderRadius: '15px',
                      fontSize: '16px',
                      background: '#fafbfc',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '16px', 
                    fontWeight: '500', 
                    color: '#2c3e50', 
                    marginBottom: '12px' 
                  }}>
                    Nível de Criatividade: {Math.round(agentConfig.creativity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={agentConfig.creativity}
                    onChange={(e) => setAgentConfig({...agentConfig, creativity: parseFloat(e.target.value)})}
                    style={{
                      width: '100%',
                      height: '8px',
                      borderRadius: '4px',
                      background: `linear-gradient(to right, #45b7d1 0%, #45b7d1 ${agentConfig.creativity * 100}%, #ecf0f1 ${agentConfig.creativity * 100}%, #ecf0f1 100%)`,
                      outline: 'none',
                      appearance: 'none'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#7f8c8d' }}>Conservador</span>
                    <span style={{ fontSize: '12px', color: '#7f8c8d' }}>Criativo</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{
              background: 'white',
              borderRadius: '30px',
              padding: '50px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.1)'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <BeakerIcon style={{ 
                  width: '60px', 
                  height: '60px', 
                  color: '#96ceb4',
                  margin: '0 auto 20px'
                }} />
                <h2 style={{ fontSize: '36px', fontWeight: '300', color: '#2c3e50', margin: '0 0 12px' }}>
                  Personalidade
                </h2>
                <p style={{ color: '#7f8c8d', fontSize: '16px' }}>
                  Escolha como seu agente irá se comunicar
                </p>
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: '20px',
                marginBottom: '40px'
              }}>
                {personalities.map((personality) => (
                  <div
                    key={personality.id}
                    onClick={() => setAgentConfig({...agentConfig, personality: personality.id})}
                    style={{
                      padding: '24px',
                      borderRadius: '20px',
                      background: agentConfig.personality === personality.id 
                        ? 'linear-gradient(135deg, #96ceb4, #85c1a5)' 
                        : '#f8f9fa',
                      color: agentConfig.personality === personality.id ? 'white' : '#2c3e50',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      textAlign: 'center',
                      transform: agentConfig.personality === personality.id ? 'scale(1.05)' : 'scale(1)',
                      boxShadow: agentConfig.personality === personality.id 
                        ? '0 10px 30px rgba(150,206,180,0.3)' 
                        : 'none'
                    }}
                  >
                    <div style={{ fontSize: '36px', marginBottom: '12px' }}>{personality.emoji}</div>
                    <h4 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 8px' }}>
                      {personality.name}
                    </h4>
                    <p style={{ fontSize: '14px', opacity: 0.8, margin: 0 }}>
                      {personality.desc}
                    </p>
                  </div>
                ))}
              </div>

              <div style={{ 
                background: '#f8f9fa', 
                borderRadius: '15px', 
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <h4 style={{ fontSize: '18px', fontWeight: '600', color: '#2c3e50', margin: 0 }}>
                  Configurações Avançadas
                </h4>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '16px', color: '#2c3e50' }}>Aprendizado Contínuo</span>
                  <Switch
                    checked={agentConfig.learningEnabled}
                    onChange={(checked) => setAgentConfig({...agentConfig, learningEnabled: checked})}
                    style={{
                      position: 'relative',
                      display: 'inline-flex',
                      width: '56px',
                      height: '28px',
                      backgroundColor: agentConfig.learningEnabled ? '#96ceb4' : '#cbd5e0',
                      borderRadius: '14px',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <span style={{
                      position: 'absolute',
                      top: '2px',
                      left: agentConfig.learningEnabled ? '30px' : '2px',
                      width: '24px',
                      height: '24px',
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      transition: 'left 0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }} />
                  </Switch>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{
              background: 'white',
              borderRadius: '30px',
              padding: '60px 40px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.1)'
            }}>
              {deploymentStatus === 'idle' && (
                <>
                  <RocketLaunchIcon style={{ 
                    width: '80px', 
                    height: '80px', 
                    color: '#feca57',
                    margin: '0 auto 30px'
                  }} />
                  <h2 style={{ fontSize: '36px', fontWeight: '300', color: '#2c3e50', margin: '0 0 20px' }}>
                    Pronto para Deploy
                  </h2>
                  <p style={{ color: '#7f8c8d', fontSize: '18px', marginBottom: '40px' }}>
                    Seu agente de IA está configurado e pronto para ser implantado
                  </p>
                  
                  <div style={{
                    background: '#f8f9fa',
                    borderRadius: '20px',
                    padding: '30px',
                    marginBottom: '40px',
                    textAlign: 'left'
                  }}>
                    <h4 style={{ fontSize: '18px', fontWeight: '600', color: '#2c3e50', marginBottom: '20px' }}>
                      Resumo da Configuração
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div><strong>Número:</strong> {selectedNumber}</div>
                      <div><strong>Nome:</strong> {agentConfig.name}</div>
                      <div><strong>Especialização:</strong> {specializations.find(s => s.id === agentConfig.specialization)?.name}</div>
                      <div><strong>Modelo:</strong> {agentConfig.model}</div>
                      <div><strong>Personalidade:</strong> {personalities.find(p => p.id === agentConfig.personality)?.name}</div>
                    </div>
                  </div>

                  <Button
                    onClick={handleDeploy}
                    style={{
                      background: 'linear-gradient(135deg, #feca57, #ff9ff3)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '15px',
                      padding: '18px 40px',
                      fontSize: '18px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      margin: '0 auto',
                      boxShadow: '0 8px 25px rgba(254,202,87,0.3)'
                    }}
                  >
                    <RocketLaunchIcon style={{ width: '24px', height: '24px' }} />
                    Implantar Agente
                  </Button>
                </>
              )}

              {deploymentStatus !== 'idle' && deploymentStatus !== 'completed' && (
                <>
                  <div style={{
                    width: '100px',
                    height: '100px',
                    border: '8px solid #f3f3f3',
                    borderTop: '8px solid #feca57',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 30px'
                  }} />
                  <h3 style={{ fontSize: '24px', fontWeight: '500', color: '#2c3e50', marginBottom: '12px' }}>
                    {deploymentStatus === 'initializing' && 'Inicializando...'}
                    {deploymentStatus === 'configuring' && 'Configurando Sistema...'}
                    {deploymentStatus === 'training' && 'Treinando Modelo...'}
                    {deploymentStatus === 'testing' && 'Executando Testes...'}
                    {deploymentStatus === 'deploying' && 'Fazendo Deploy...'}
                  </h3>
                  <p style={{ color: '#7f8c8d', fontSize: '16px' }}>
                    Por favor, aguarde enquanto seu agente é implantado
                  </p>
                </>
              )}

              {deploymentStatus === 'completed' && (
                <>
                  <div style={{
                    width: '100px',
                    height: '100px',
                    background: 'linear-gradient(135deg, #2ecc71, #27ae60)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 30px'
                  }}>
                    <CheckIcon style={{ width: '50px', height: '50px', color: 'white' }} />
                  </div>
                  <h3 style={{ fontSize: '32px', fontWeight: '600', color: '#2ecc71', marginBottom: '16px' }}>
                    Agente Implantado!
                  </h3>
                  <p style={{ color: '#7f8c8d', fontSize: '18px', marginBottom: '30px' }}>
                    Seu agente de IA está ativo e pronto para receber mensagens
                  </p>
                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'center',
                    flexWrap: 'wrap'
                  }}>
                    <Button
                      onClick={() => window.open('/dashboard', '_blank')}
                      style={{
                        background: 'linear-gradient(135deg, #3498db, #2980b9)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '12px 24px',
                        fontSize: '16px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      Ver Dashboard
                    </Button>
                    <Button
                      onClick={() => window.location.reload()}
                      style={{
                        background: 'transparent',
                        color: '#7f8c8d',
                        border: '2px solid #ecf0f1',
                        borderRadius: '12px',
                        padding: '12px 24px',
                        fontSize: '16px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      Criar Novo Agente
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      {deploymentStatus === 'idle' && (
        <div style={{
          position: 'fixed',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '16px'
        }}>
          {currentStep > 0 && (
            <Button
              onClick={prevStep}
              style={{
                background: 'rgba(255,255,255,0.9)',
                border: '2px solid #ecf0f1',
                borderRadius: '50px',
                padding: '16px 32px',
                fontSize: '16px',
                fontWeight: '500',
                color: '#7f8c8d',
                cursor: 'pointer',
                backdropFilter: 'blur(10px)'
              }}
            >
              Anterior
            </Button>
          )}
          
          {currentStep < steps.length - 1 && (
            <Button
              onClick={nextStep}
              disabled={
                (currentStep === 0 && !selectedNumber) ||
                (currentStep === 1 && !agentConfig.name) ||
                (currentStep === 2 && !agentConfig.apiKey)
              }
              style={{
                background: 'linear-gradient(135deg, #ff6b6b, #ee5a52)',
                color: 'white',
                border: 'none',
                borderRadius: '50px',
                padding: '16px 32px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 8px 25px rgba(255,107,107,0.3)',
                opacity: (currentStep === 0 && !selectedNumber) ||
                        (currentStep === 1 && !agentConfig.name) ||
                        (currentStep === 2 && !agentConfig.apiKey) ? 0.5 : 1
              }}
            >
              Próximo
              <ArrowRightIcon style={{ width: '20px', height: '20px' }} />
            </Button>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #45b7d1;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
        input[type="range"]::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #45b7d1;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
};

export default AIAgent;