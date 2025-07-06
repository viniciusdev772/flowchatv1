import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Listbox,
  ListboxItem,
  Chip,
  Progress,
  Spacer,
  Divider,
  Avatar,
  Badge,
  Switch,
  Slider,
  Accordion,
  AccordionItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Breadcrumbs,
  BreadcrumbItem,
  Tabs,
  Tab,
  Spinner,
  CircularProgress,
  Alert,
  CheckboxGroup,
  Checkbox,
  RadioGroup,
  Radio,
  Image,
  Link,
  Code,
  Kbd
} from "@heroui/react";
import { 
  SparklesIcon, 
  PhoneIcon, 
  CpuChipIcon, 
  RocketLaunchIcon, 
  BeakerIcon, 
  AcademicCapIcon,
  CheckIcon,
  ArrowRightIcon,
  Cog6ToothIcon,
  UserIcon,
  BoltIcon
} from '@heroicons/react/24/outline';
import { apiRequest } from '../utils/api';

export default function AIAgent() {
  const [currentStep, setCurrentStep] = useState(0);
  const [availableNumbers, setAvailableNumbers] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState(new Set([]));
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [deploymentProgress, setDeploymentProgress] = useState(0);
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  const [agentConfig, setAgentConfig] = useState({
    name: '',
    description: '',
    apiKey: '',
    model: 'gpt-4',
    personality: new Set(['professional']),
    specialization: new Set(['general']),
    creativity: 70,
    responseSpeed: new Set(['fast']),
    learningEnabled: true,
    contextMemory: new Set(['session']),
    autoReply: true,
    smartReplies: true
  });

  const steps = [
    { key: "number", title: "Número WhatsApp", icon: PhoneIcon },
    { key: "identity", title: "Identidade", icon: AcademicCapIcon },
    { key: "intelligence", title: "Inteligência", icon: CpuChipIcon },
    { key: "personality", title: "Personalidade", icon: BeakerIcon },
    { key: "deploy", title: "Implantação", icon: RocketLaunchIcon }
  ];

  const aiModels = [
    { key: "gpt-4", label: "GPT-4 (Recomendado)" },
    { key: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
    { key: "claude-3", label: "Claude 3" },
    { key: "gemini-pro", label: "Gemini Pro" }
  ];

  const personalities = [
    { key: "professional", label: "Profissional", emoji: "🎯", description: "Formal e objetivo" },
    { key: "friendly", label: "Amigável", emoji: "😊", description: "Caloroso e acolhedor" },
    { key: "creative", label: "Criativo", emoji: "🎨", description: "Inovador e artístico" },
    { key: "analytical", label: "Analítico", emoji: "📊", description: "Lógico e detalhado" },
    { key: "casual", label: "Descontraído", emoji: "😎", description: "Informal e relaxado" },
    { key: "empathetic", label: "Empático", emoji: "❤️", description: "Compreensivo e sensível" }
  ];

  const specializations = [
    { key: "general", label: "Assistente Geral", emoji: "🤖", description: "Multipropósito" },
    { key: "sales", label: "Vendas & Marketing", emoji: "💼", description: "Conversão e vendas" },
    { key: "support", label: "Suporte ao Cliente", emoji: "🛠️", description: "Atendimento e suporte" },
    { key: "education", label: "Educação & Ensino", emoji: "📚", description: "Ensino e treinamento" },
    { key: "health", label: "Saúde & Bem-estar", emoji: "🏥", description: "Orientações de saúde" },
    { key: "finance", label: "Finanças & Consultoria", emoji: "💰", description: "Consultoria financeira" }
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
    setDeploymentProgress(0);
    onOpen();
    
    // Simulate deployment progress
    const steps = [20, 40, 60, 80, 100];
    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setDeploymentProgress(steps[i]);
    }
    
    setTimeout(() => {
      setIsCreating(false);
    }, 1000);
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
        return Array.from(selectedNumber).length > 0;
      case 1:
        return agentConfig.name.trim() !== '';
      case 2:
        return agentConfig.apiKey.trim() !== '';
      default:
        return true;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
        <Card className="w-96 p-8">
          <CardBody className="text-center">
            <CircularProgress 
              size="lg" 
              color="secondary" 
              className="mb-4"
              aria-label="Carregando..."
            />
            <h2 className="text-xl font-semibold text-gray-700">
              Inicializando Sistema de IA
            </h2>
            <p className="text-gray-500 mt-2">
              Carregando números disponíveis...
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header with Progress */}
        <Card className="mb-8">
          <CardHeader className="pb-2">
            <div className="w-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    icon={<SparklesIcon className="w-6 h-6" />}
                    className="bg-gradient-to-br from-purple-500 to-pink-500"
                  />
                  <div>
                    <h1 className="text-2xl font-bold text-gray-800">
                      Criador de Agente IA
                    </h1>
                    <p className="text-gray-600">
                      Configure seu assistente inteligente personalizado
                    </p>
                  </div>
                </div>
                <Chip 
                  color="warning" 
                  variant="flat" 
                  size="sm"
                  className="font-semibold"
                >
                  EXCLUSIVO
                </Chip>
              </div>
              
              <Breadcrumbs>
                {steps.map((step, index) => (
                  <BreadcrumbItem 
                    key={step.key}
                    isCurrent={currentStep === index}
                    isDisabled={currentStep < index}
                  >
                    {step.title}
                  </BreadcrumbItem>
                ))}
              </Breadcrumbs>
              
              <Spacer y={4} />
              
              <Progress 
                value={(currentStep + 1) / steps.length * 100} 
                color="secondary"
                className="max-w-md"
                showValueLabel={true}
                formatOptions={{style: "percent"}}
              />
            </div>
          </CardHeader>
        </Card>

        {/* Step Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Card className="h-fit">
              <CardHeader>
                <div className="flex items-center gap-3">
                  {React.createElement(steps[currentStep].icon, { className: "w-6 h-6 text-purple-600" })}
                  <h2 className="text-xl font-semibold">
                    {steps[currentStep].title}
                  </h2>
                </div>
              </CardHeader>
              
              <CardBody>
                {/* Step 0: Number Selection */}
                {currentStep === 0 && (
                  <div className="space-y-6">
                    <Alert 
                      color="primary" 
                      variant="flat"
                      title="Selecione um Número"
                      description="Escolha o número WhatsApp que será usado pelo seu agente de IA"
                    />
                    
                    <Listbox
                      aria-label="Números disponíveis"
                      variant="flat"
                      disallowEmptySelection
                      selectionMode="single"
                      selectedKeys={selectedNumber}
                      onSelectionChange={setSelectedNumber}
                      className="max-w-full"
                    >
                      {availableNumbers.map((session) => (
                        <ListboxItem 
                          key={session.sessionId}
                          startContent={
                            <Badge 
                              content="" 
                              color="success" 
                              shape="circle" 
                              placement="bottom-right"
                            >
                              <Avatar 
                                icon={<PhoneIcon className="w-4 h-4" />}
                                size="sm"
                                className="bg-green-100"
                              />
                            </Badge>
                          }
                          description={`Status: ${session.status}`}
                        >
                          {session.sessionId}
                        </ListboxItem>
                      ))}
                    </Listbox>
                    
                    {availableNumbers.length === 0 && (
                      <Alert 
                        color="warning"
                        title="Nenhum número disponível"
                        description="Conecte pelo menos um número WhatsApp para continuar"
                      />
                    )}
                  </div>
                )}

                {/* Step 1: Identity */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <Input
                      label="Nome do Agente"
                      placeholder="Ex: Aurora Assistant"
                      value={agentConfig.name}
                      onValueChange={(value) => 
                        setAgentConfig(prev => ({ ...prev, name: value }))
                      }
                      startContent={<UserIcon className="w-4 h-4 text-gray-400" />}
                      isRequired
                      description="Escolha um nome único para seu assistente"
                    />
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Especialização
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {specializations.map((spec) => (
                          <Card 
                            key={spec.key}
                            isPressable
                            isHoverable
                            className={`cursor-pointer transition-all ${
                              Array.from(agentConfig.specialization)[0] === spec.key 
                                ? 'ring-2 ring-purple-500 bg-purple-50' 
                                : ''
                            }`}
                            onPress={() => 
                              setAgentConfig(prev => ({ 
                                ...prev, 
                                specialization: new Set([spec.key]) 
                              }))
                            }
                          >
                            <CardBody className="text-center p-4">
                              <div className="text-2xl mb-2">{spec.emoji}</div>
                              <h4 className="font-semibold text-sm">{spec.label}</h4>
                              <p className="text-xs text-gray-500 mt-1">
                                {spec.description}
                              </p>
                            </CardBody>
                          </Card>
                        ))}
                      </div>
                    </div>
                    
                    <Textarea
                      label="Descrição (Opcional)"
                      placeholder="Descreva a personalidade e objetivos do seu agente..."
                      value={agentConfig.description}
                      onValueChange={(value) => 
                        setAgentConfig(prev => ({ ...prev, description: value }))
                      }
                      description="Esta descrição ajudará a definir o comportamento do agente"
                    />
                  </div>
                )}

                {/* Step 2: Intelligence */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <Select
                      label="Modelo de IA"
                      placeholder="Selecione o modelo"
                      selectedKeys={new Set([agentConfig.model])}
                      onSelectionChange={(keys) => 
                        setAgentConfig(prev => ({ 
                          ...prev, 
                          model: Array.from(keys)[0] 
                        }))
                      }
                      startContent={<CpuChipIcon className="w-4 h-4" />}
                    >
                      {aiModels.map((model) => (
                        <SelectItem key={model.key}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </Select>
                    
                    <Input
                      type="password"
                      label="Chave da API OpenAI"
                      placeholder="sk-..."
                      value={agentConfig.apiKey}
                      onValueChange={(value) => 
                        setAgentConfig(prev => ({ ...prev, apiKey: value }))
                      }
                      startContent={<Cog6ToothIcon className="w-4 h-4 text-gray-400" />}
                      isRequired
                      description="Sua chave será criptografada e armazenada com segurança"
                    />
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-4 block">
                        Nível de Criatividade: {agentConfig.creativity}%
                      </label>
                      <Slider
                        step={10}
                        minValue={0}
                        maxValue={100}
                        value={agentConfig.creativity}
                        onChange={(value) => 
                          setAgentConfig(prev => ({ ...prev, creativity: value }))
                        }
                        className="max-w-md"
                        color="secondary"
                        marks={[
                          { value: 0, label: "Conservador" },
                          { value: 50, label: "Equilibrado" },
                          { value: 100, label: "Criativo" }
                        ]}
                      />
                    </div>
                  </div>
                )}

                {/* Step 3: Personality */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-4 block">
                        Personalidade Principal
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {personalities.map((personality) => (
                          <Card
                            key={personality.key}
                            isPressable
                            isHoverable
                            className={`cursor-pointer transition-all ${
                              Array.from(agentConfig.personality)[0] === personality.key
                                ? 'ring-2 ring-purple-500 bg-purple-50'
                                : ''
                            }`}
                            onPress={() => 
                              setAgentConfig(prev => ({ 
                                ...prev, 
                                personality: new Set([personality.key]) 
                              }))
                            }
                          >
                            <CardBody className="text-center p-4">
                              <div className="text-2xl mb-2">{personality.emoji}</div>
                              <h4 className="font-semibold text-sm">{personality.label}</h4>
                              <p className="text-xs text-gray-500 mt-1">
                                {personality.description}
                              </p>
                            </CardBody>
                          </Card>
                        ))}
                      </div>
                    </div>
                    
                    <Accordion variant="splitted">
                      <AccordionItem 
                        key="advanced" 
                        aria-label="Configurações Avançadas"
                        title="Configurações Avançadas"
                        startContent={<BoltIcon className="w-4 h-4" />}
                      >
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">Aprendizado Contínuo</p>
                              <p className="text-sm text-gray-500">
                                Permite que o agente aprenda com conversas
                              </p>
                            </div>
                            <Switch
                              isSelected={agentConfig.learningEnabled}
                              onValueChange={(value) => 
                                setAgentConfig(prev => ({ 
                                  ...prev, 
                                  learningEnabled: value 
                                }))
                              }
                            />
                          </div>
                          
                          <Divider />
                          
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">Respostas Automáticas</p>
                              <p className="text-sm text-gray-500">
                                Responde automaticamente às mensagens
                              </p>
                            </div>
                            <Switch
                              isSelected={agentConfig.autoReply}
                              onValueChange={(value) => 
                                setAgentConfig(prev => ({ 
                                  ...prev, 
                                  autoReply: value 
                                }))
                              }
                            />
                          </div>
                        </div>
                      </AccordionItem>
                    </Accordion>
                  </div>
                )}

                {/* Step 4: Deploy */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    <Alert 
                      color="success"
                      title="Configuração Concluída"
                      description="Seu agente está pronto para ser implantado"
                    />
                    
                    <Card>
                      <CardHeader>
                        <h3 className="font-semibold">Resumo da Configuração</h3>
                      </CardHeader>
                      <CardBody className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Número:</span>
                          <Code size="sm">{Array.from(selectedNumber)[0]}</Code>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Nome:</span>
                          <span className="font-medium">{agentConfig.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Especialização:</span>
                          <Chip size="sm" variant="flat">
                            {specializations.find(s => s.key === Array.from(agentConfig.specialization)[0])?.label}
                          </Chip>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Modelo:</span>
                          <Code size="sm">{agentConfig.model}</Code>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Personalidade:</span>
                          <Chip size="sm" variant="flat" color="secondary">
                            {personalities.find(p => p.key === Array.from(agentConfig.personality)[0])?.label}
                          </Chip>
                        </div>
                      </CardBody>
                    </Card>
                    
                    <Button
                      color="primary"
                      size="lg"
                      className="w-full"
                      startContent={<RocketLaunchIcon className="w-5 h-5" />}
                      onPress={handleDeploy}
                      isDisabled={isCreating}
                    >
                      {isCreating ? "Implantando..." : "Implantar Agente"}
                    </Button>
                  </div>
                )}
              </CardBody>
              
              <CardFooter>
                <div className="flex justify-between w-full">
                  <Button
                    variant="flat"
                    onPress={prevStep}
                    isDisabled={currentStep === 0}
                  >
                    Anterior
                  </Button>
                  
                  {currentStep < steps.length - 1 && (
                    <Button
                      color="primary"
                      endContent={<ArrowRightIcon className="w-4 h-4" />}
                      onPress={nextStep}
                      isDisabled={!canProceed()}
                    >
                      Próximo
                    </Button>
                  )}
                </div>
              </CardFooter>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <h3 className="font-semibold">Progresso</h3>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  {steps.map((step, index) => (
                    <div 
                      key={step.key}
                      className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                        currentStep === index ? 'bg-purple-50' : 
                        currentStep > index ? 'bg-green-50' : 'bg-gray-50'
                      }`}
                    >
                      <Avatar
                        icon={currentStep > index ? 
                          <CheckIcon className="w-4 h-4" /> : 
                          React.createElement(step.icon, { className: "w-4 h-4" })
                        }
                        size="sm"
                        className={
                          currentStep === index ? 'bg-purple-500' :
                          currentStep > index ? 'bg-green-500' : 'bg-gray-300'
                        }
                      />
                      <span className={`text-sm font-medium ${
                        currentStep >= index ? 'text-gray-800' : 'text-gray-400'
                      }`}>
                        {step.title}
                      </span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
            
            <Spacer y={4} />
            
            <Card>
              <CardHeader>
                <h3 className="font-semibold">Recursos Inclusos</h3>
              </CardHeader>
              <CardBody>
                <div className="space-y-3">
                  {[
                    "Conversas inteligentes",
                    "Aprendizado automático", 
                    "Respostas contextuais",
                    "Integração WhatsApp",
                    "Suporte 24/7"
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckIcon className="w-4 h-4 text-green-500" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>

      {/* Deployment Modal */}
      <Modal isOpen={isOpen} onClose={onClose} isDismissable={false}>
        <ModalContent>
          <ModalHeader>
            <h3>Implantando Agente de IA</h3>
          </ModalHeader>
          <ModalBody>
            <div className="text-center space-y-4">
              <CircularProgress
                size="lg"
                value={deploymentProgress}
                color="primary"
                formatOptions={{style: "percent"}}
                showValueLabel={true}
              />
              
              <div>
                <p className="font-medium">
                  {deploymentProgress < 30 ? "Inicializando..." :
                   deploymentProgress < 60 ? "Configurando modelo..." :
                   deploymentProgress < 90 ? "Treinando agente..." :
                   deploymentProgress < 100 ? "Finalizando..." :
                   "Concluído!"}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Por favor, aguarde enquanto seu agente é configurado
                </p>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            {deploymentProgress === 100 && (
              <div className="flex gap-2 w-full">
                <Button
                  color="primary"
                  variant="flat"
                  onPress={() => window.open('/dashboard', '_blank')}
                  className="flex-1"
                >
                  Ver Dashboard
                </Button>
                <Button
                  color="primary"
                  onPress={() => {
                    onClose();
                    window.location.reload();
                  }}
                  className="flex-1"
                >
                  Criar Novo Agente
                </Button>
              </div>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}