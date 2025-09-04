import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Switch } from '../components/ui/switch'
import { Badge } from '../components/ui/badge'
import { Progress } from '../components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { useToast } from '../hooks/use-toast'
import {
  Bot,
  Sparkles,
  Settings,
  Plus,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  Zap,
  Brain,
  Shield,
  Rocket,
  Users,
  MessageSquare,
  Clock,
  Star,
  Activity
} from 'lucide-react'
import AgentsList from '../components/AgentsList'


export default function AIAgent() {
  const [activeTab, setActiveTab] = useState('create')
  const [currentStep, setCurrentStep] = useState(1)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [validationErrors, setValidationErrors] = useState({})
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    sessionId: '',
    name: '',
    description: '',
    apiKey: '',
    model: 'gpt-4',
    personality: 'professional',
    specialization: 'general',
    creativity: 70,
    learningEnabled: true,
    autoReply: true,
    replyToGroups: true,
    customSystemPrompt: '',
    useCustomPersonality: false,
  })

  const personalities = [
    {
      id: 'professional',
      name: 'Profissional',
      desc: 'Formal e objetivo',
      icon: '💼'
    },
    {
      id: 'friendly',
      name: 'Amigável',
      desc: 'Caloroso e acolhedor',
      icon: '😊'
    },
    {
      id: 'creative',
      name: 'Criativo',
      desc: 'Inovador e artístico',
      icon: '🎨'
    },
    {
      id: 'analytical',
      name: 'Analítico',
      desc: 'Lógico e detalhado',
      icon: '📊'
    },
    {
      id: 'casual',
      name: 'Casual',
      desc: 'Descontraído e informal',
      icon: '😎'
    },
    {
      id: 'empathetic',
      name: 'Empático',
      desc: 'Compreensivo e sensível',
      icon: '❤️'
    },
    {
      id: 'custom',
      name: 'Personalizado',
      desc: 'Defina sua própria personalidade',
      icon: '🎭'
    },
  ]

  const specializations = [
    { id: 'general', name: 'Assistente Geral', icon: Bot },
    { id: 'sales', name: 'Vendas & Marketing', icon: Users },
    { id: 'support', name: 'Suporte ao Cliente', icon: MessageSquare },
    { id: 'education', name: 'Educação & Ensino', icon: Brain },
  ]

  const steps = [
    {
      id: 1,
      name: 'Sessão',
      description: 'Conectar WhatsApp',
      icon: Bot
    },
    {
      id: 2,
      name: 'Configuração',
      description: 'Personalizar agente',
      icon: Settings
    },
    {
      id: 3,
      name: 'Finalização',
      description: 'Revisar e criar',
      icon: Rocket
    }
  ]

  useEffect(() => {
    loadSessions()
  }, [])

  useEffect(() => {

    const stepProgress = ((currentStep - 1) / (steps.length - 1)) * 100
    setProgress(stepProgress)
  }, [currentStep])

  useEffect(() => {

    validateForm()
  }, [formData, currentStep])

  const validateForm = () => {
    const errors = {}

    if (currentStep >= 1 && !formData.sessionId) {
      errors.sessionId = 'Selecione uma sessão WhatsApp'
    }

    if (currentStep >= 2) {
      if (!formData.name.trim()) {
        errors.name = 'Nome é obrigatório'
      } else if (formData.name.length < 2) {
        errors.name = 'Nome deve ter pelo menos 2 caracteres'
      }

      if (!formData.apiKey.trim()) {
        errors.apiKey = 'Chave da API é obrigatória'
      } else if (!formData.apiKey.startsWith('sk-')) {
        errors.apiKey = 'Chave deve começar com "sk-"'
      }

      if (formData.personality === 'custom' && !formData.customSystemPrompt.trim()) {
        errors.customSystemPrompt = 'System prompt personalizado é obrigatório'
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const loadSessions = async () => {
    try {
      setLoading(true)
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'


      const tokenResponse = await fetch(`${apiUrl}/api/management/tokens/list`, {
        credentials: 'include',
      })

      if (!tokenResponse.ok) throw new Error('Failed to get token')

      const tokenData = await tokenResponse.json()
      if (!tokenData.success || !tokenData.tokens.length) {
        throw new Error('No tokens available')
      }

      const firstToken = tokenData.tokens[0]
      const fullTokenResponse = await fetch(`${apiUrl}/api/management/tokens/${firstToken._id}/full`, {
        credentials: 'include',
      })

      if (!fullTokenResponse.ok) throw new Error('Failed to get full token')

      const fullTokenData = await fullTokenResponse.json()
      if (!fullTokenData.success) throw new Error('Invalid token response')

      const token = fullTokenData.token


      const sessionsResponse = await fetch(`${apiUrl}/api/baileys/sessions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!sessionsResponse.ok) throw new Error('Failed to load sessions')

      const sessionsData = await sessionsResponse.json()
      if (sessionsData.success) {
        const connectedSessions = sessionsData.sessions?.filter(
          s => s.connectionState === 'connected' || s.isConnected === true
        ) || []
        setSessions(connectedSessions)
      }
    } catch (err) {
      setError(err.message)
      toast({
        title: "Erro ao carregar sessões",
        description: err.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast({
        title: "Dados inválidos",
        description: "Verifique os campos e tente novamente",
        variant: "destructive"
      })
      return
    }

    try {
      setCreating(true)
      setError(null)
      setProgress(0)

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'


      const progressSteps = [
        { value: 20, message: "Validando dados..." },
        { value: 40, message: "Obtendo token..." },
        { value: 60, message: "Configurando agente..." },
        { value: 80, message: "Criando agente..." },
        { value: 100, message: "Finalizando..." }
      ]

      for (const step of progressSteps) {
        setProgress(step.value)
        await new Promise(resolve => setTimeout(resolve, 500))
      }


      const tokenResponse = await fetch(`${apiUrl}/api/management/tokens/list`, {
        credentials: 'include',
      })
      const tokenData = await tokenResponse.json()
      const firstToken = tokenData.tokens[0]

      const fullTokenResponse = await fetch(`${apiUrl}/api/management/tokens/${firstToken._id}/full`, {
        credentials: 'include',
      })
      const fullTokenData = await fullTokenResponse.json()
      const token = fullTokenData.token


      const response = await fetch(`${apiUrl}/api/baileys/agents/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: formData.sessionId,
          name: formData.name,
          description: formData.description,
          model: formData.model,
          personality: formData.personality === 'custom' ? 'professional' : formData.personality,
          specialization: formData.specialization,
          creativity: formData.creativity,
          learningEnabled: formData.learningEnabled,
          autoReply: formData.autoReply,
          smartReplies: true,
          replyToGroups: formData.replyToGroups,
          openaiApiKey: formData.apiKey,
          tools: ['web_search'],
          customSystemPrompt: formData.personality === 'custom' ? formData.customSystemPrompt : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create agent')
      }


      setShowSuccessDialog(true)
      toast({
        title: "Agente criado com sucesso! 🎉",
        description: "Seu agente de IA está pronto para uso",
      })


      setFormData({
        sessionId: '',
        name: '',
        description: '',
        apiKey: '',
        model: 'gpt-4',
        personality: 'professional',
        specialization: 'general',
        creativity: 70,
        learningEnabled: true,
        autoReply: true,
        replyToGroups: true,
        customSystemPrompt: '',
        useCustomPersonality: false,
      })
      setCurrentStep(1)
    } catch (err) {
      setError(err.message)
      toast({
        title: "Erro ao criar agente",
        description: err.message,
        variant: "destructive"
      })
    } finally {
      setCreating(false)
      setProgress(0)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1: return formData.sessionId && !validationErrors.sessionId
      case 2: return formData.name.trim() && formData.apiKey.trim() && !validationErrors.name && !validationErrors.apiKey &&
        (formData.personality !== 'custom' || (formData.customSystemPrompt.trim() && !validationErrors.customSystemPrompt))
      case 3: return true
      default: return false
    }
  }

  const nextStep = () => {
    if (canProceed() && currentStep < steps.length) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-[600px]">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
                <div className="space-y-2">
                  <p className="text-lg font-medium">Inicializando Sistema de IA</p>
                  <p className="text-sm text-muted-foreground">Carregando sessões WhatsApp...</p>
                </div>
                <Progress value={60} className="w-64 mx-auto" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-4 md:py-8 space-y-4 md:space-y-8">
      {}
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="text-center space-y-2 md:space-y-4">
          <div className="flex items-center justify-center space-x-2 md:space-x-3">
            <div className="p-2 md:p-3 rounded-full border bg-primary/10">
              <Sparkles className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl md:text-4xl">
              Agentes de IA
            </CardTitle>
          </div>
          <CardDescription className="text-sm md:text-lg max-w-2xl mx-auto">
            Crie e gerencie assistentes inteligentes para WhatsApp com tecnologia de ponta
          </CardDescription>
        </CardHeader>
      </Card>

      {}
      <Card className="mx-auto max-w-md">
        <CardContent className="p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-10 md:h-12">
              <TabsTrigger value="create" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm font-medium">
                <Plus className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Criar Agente</span>
                <span className="sm:hidden">Criar</span>
              </TabsTrigger>
              <TabsTrigger value="manage" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm font-medium">
                <Settings className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Gerenciar</span>
                <span className="sm:hidden">Gerenciar</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>


      {}
      {activeTab === 'manage' ? (
        <div>
          <AgentsList onRefresh={() => {}} />
        </div>
      ) : (
        <div className="max-w-4xl mx-auto px-4">
            {}
            <div className="mb-6 md:mb-12">
              <div className="flex justify-between items-center mb-4 md:mb-6 overflow-x-auto">
                {steps.map((step, index) => (
                  <div
                    key={step.id}
                    className="flex flex-col items-center space-y-1 md:space-y-2 flex-1 min-w-0 px-1"
                  >
                    <div
                      className={`relative w-8 h-8 md:w-12 md:h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                        currentStep >= step.id
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'bg-background border-muted-foreground/30 text-muted-foreground'
                      }`}
                    >
                      {currentStep > step.id ? (
                        <CheckCircle className="h-4 w-4 md:h-6 md:w-6" />
                      ) : (
                        <step.icon className="h-4 w-4 md:h-6 md:w-6" />
                      )}
                    </div>
                    <div className="text-center">
                      <p className={`text-xs md:text-sm font-medium ${
                        currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {step.name}
                      </p>
                      <p className="text-xs text-muted-foreground hidden md:block">{step.description}</p>
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`absolute top-4 md:top-6 left-full w-full h-0.5 -translate-y-1/2 ${
                        currentStep > step.id ? 'bg-primary' : 'bg-muted'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
              <Progress value={progress} className="h-1 md:h-2" />
            </div>

            {}
            {error && (
              <div className="mb-4 md:mb-6 p-3 md:p-4 border border-destructive/50 bg-destructive/10 rounded-lg flex items-start gap-2 md:gap-3">
                <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-destructive text-sm md:text-base">Erro</p>
                  <p className="text-xs md:text-sm text-destructive/80">{error}</p>
                </div>
              </div>
            )}

            {}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
              {}
              <div className="lg:col-span-2">
                  {}
                  {currentStep === 1 && (
                    <div>
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-3">
                            <Bot className="h-6 w-6" />
                            Conectar Sessão WhatsApp
                          </CardTitle>
                          <CardDescription>
                            Selecione uma sessão ativa para o seu agente de IA
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 md:p-6 space-y-4 md:space-y-6">
                          <div className="space-y-3">
                            <Label htmlFor="session" className="text-sm md:text-base font-medium">
                              Sessão WhatsApp
                            </Label>
                            <Select
                              value={formData.sessionId}
                              onValueChange={(value) => {
                                setFormData(prev => ({ ...prev, sessionId: value }))
                                setValidationErrors(prev => ({ ...prev, sessionId: undefined }))
                              }}
                            >
                              <SelectTrigger className={`h-10 md:h-12 ${validationErrors.sessionId ? 'border-destructive' : ''}`}>
                                <SelectValue placeholder="Selecione uma sessão conectada..." />
                              </SelectTrigger>
                              <SelectContent>
                                {sessions.map((session) => (
                                  <SelectItem key={session.sessionId} value={session.sessionId}>
                                    <div className="flex items-center gap-2 md:gap-3">
                                      <div className="w-2 h-2 md:w-3 md:h-3 bg-green-500 rounded-full" />
                                      <div>
                                        <p className="font-medium text-sm md:text-base">{session.sessionId}</p>
                                        <p className="text-xs text-muted-foreground">Conectado</p>
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {validationErrors.sessionId && (
                              <p className="text-xs md:text-sm text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 md:h-4 md:w-4" />
                                {validationErrors.sessionId}
                              </p>
                            )}
                            {sessions.length === 0 && (
                              <div className="p-3 md:p-4 border rounded-lg">
                                <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-2">
                                  <AlertCircle className="h-3 w-3 md:h-4 md:w-4" />
                                  Nenhuma sessão conectada encontrada. Conecte uma sessão WhatsApp primeiro.
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {}
                  {currentStep === 2 && (
                    <div className="space-y-4 md:space-y-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 md:gap-3 text-lg md:text-xl">
                            <Sparkles className="h-5 w-5 md:h-6 md:w-6" />
                            Configuração do Agente
                          </CardTitle>
                          <CardDescription className="text-sm md:text-base">
                            Defina a identidade e comportamento do seu assistente
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 md:p-6 space-y-4 md:space-y-6">
                          {}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            <div className="space-y-3">
                              <Label htmlFor="name" className="text-sm md:text-base font-medium">
                                Nome do Agente
                              </Label>
                              <Input
                                id="name"
                                placeholder="Ex: Aurora Assistant"
                                value={formData.name}
                                onChange={(e) => {
                                  setFormData(prev => ({ ...prev, name: e.target.value }))
                                  setValidationErrors(prev => ({ ...prev, name: undefined }))
                                }}
                                className={`h-10 md:h-12 ${validationErrors.name ? 'border-destructive' : ''}`}
                              />
                              {validationErrors.name && (
                                <p className="text-xs md:text-sm text-destructive flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3 md:h-4 md:w-4" />
                                  {validationErrors.name}
                                </p>
                              )}
                            </div>

                            <div className="space-y-3">
                              <Label className="text-sm md:text-base font-medium">Especialização</Label>
                              <Select
                                value={formData.specialization}
                                onValueChange={(value) =>
                                  setFormData(prev => ({ ...prev, specialization: value }))
                                }
                              >
                                <SelectTrigger className="h-10 md:h-12">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {specializations.map((spec) => (
                                    <SelectItem key={spec.id} value={spec.id}>
                                      <div className="flex items-center gap-2">
                                        <spec.icon className="h-3 w-3 md:h-4 md:w-4" />
                                        <span className="text-sm md:text-base">{spec.name}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {}
                          <div className="space-y-3">
                            <Label htmlFor="description" className="text-sm md:text-base font-medium">
                              Descrição (Opcional)
                            </Label>
                            <Textarea
                              id="description"
                              placeholder="Descreva a personalidade e objetivos do agente..."
                              value={formData.description}
                              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                              rows={3}
                              className="resize-none text-sm md:text-base"
                            />
                          </div>

                          {}
                          <div className="space-y-3">
                            <Label htmlFor="apiKey" className="text-sm md:text-base font-medium">
                              Chave OpenAI API
                            </Label>
                            <Input
                              id="apiKey"
                              type="password"
                              placeholder="sk-..."
                              value={formData.apiKey}
                              onChange={(e) => {
                                setFormData(prev => ({ ...prev, apiKey: e.target.value }))
                                setValidationErrors(prev => ({ ...prev, apiKey: undefined }))
                              }}
                              className={`h-10 md:h-12 ${validationErrors.apiKey ? 'border-destructive' : ''}`}
                            />
                            {validationErrors.apiKey && (
                              <p className="text-xs md:text-sm text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 md:h-4 md:w-4" />
                                {validationErrors.apiKey}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Shield className="h-3 w-3" />
                              Sua chave será criptografada e armazenada com segurança
                            </p>
                          </div>

                          {}
                          <div className="space-y-4">
                            <Label className="text-sm md:text-base font-medium">Personalidade</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {personalities.map((personality) => (
                                <div
                                  key={personality.id}
                                  className={`p-3 md:p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                    formData.personality === personality.id
                                      ? 'border-primary bg-primary/5'
                                      : 'border-muted hover:border-primary/50'
                                  }`}
                                  onClick={() => setFormData(prev => ({ ...prev, personality: personality.id }))}
                                >
                                  <div className="flex items-center gap-2 md:gap-3">
                                    <span className="text-xl md:text-2xl">{personality.icon}</span>
                                    <div>
                                      <p className="font-medium text-sm md:text-base">{personality.name}</p>
                                      <p className="text-xs text-muted-foreground">{personality.desc}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {}
                            {formData.personality === 'custom' && (
                              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                                <Label htmlFor="customSystemPrompt" className="text-sm md:text-base font-medium flex items-center gap-2">
                                  <Sparkles className="h-4 w-4" />
                                  System Prompt Personalizado
                                </Label>
                                <Textarea
                                  id="customSystemPrompt"
                                  placeholder="Defina como seu agente deve se comportar...

Exemplo:
Você é {agentName}, um assistente especializado em marketing digital.
Sempre se dirija ao usuário como {userName}.
Mantenha um tom {communicationStyle} e seja {responseMode}.

Variáveis disponíveis:
- {agentName}: Nome do agente
- {userName}: Nome do usuário
- {context}: Contexto da conversa
- {communicationStyle}: Estilo de comunicação
- {responseMode}: Modo de resposta"
                                  value={formData.customSystemPrompt}
                                  onChange={(e) => {
                                    setFormData(prev => ({ ...prev, customSystemPrompt: e.target.value }))
                                    setValidationErrors(prev => ({ ...prev, customSystemPrompt: undefined }))
                                  }}
                                  rows={8}
                                  className={`resize-none text-sm md:text-base ${validationErrors.customSystemPrompt ? 'border-destructive' : ''}`}
                                />
                                {validationErrors.customSystemPrompt && (
                                  <p className="text-xs md:text-sm text-destructive flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3 md:h-4 md:w-4" />
                                    {validationErrors.customSystemPrompt}
                                  </p>
                                )}
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                  <p className="text-xs text-blue-800 font-medium mb-2">💡 Dicas para um bom System Prompt:</p>
                                  <ul className="text-xs text-blue-700 space-y-1">
                                    <li>• Defina claramente o papel e especialização do agente</li>
                                    <li>• Use as variáveis disponíveis para personalização</li>
                                    <li>• Especifique o tom e estilo de comunicação desejado</li>
                                    <li>• Inclua instruções específicas sobre como responder</li>
                                    <li>• Seja específico mas não muito restritivo</li>
                                  </ul>
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {}
                  {currentStep === 3 && (
                    <div className="space-y-4 md:space-y-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 md:gap-3 text-lg md:text-xl">
                            <Settings className="h-5 w-5 md:h-6 md:w-6" />
                            Configurações Avançadas
                          </CardTitle>
                          <CardDescription className="text-sm md:text-base">
                            Ajuste o comportamento e capacidades do agente
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 md:p-6 space-y-6 md:space-y-8">
                          {}
                          <div className="space-y-4">
                            <Label className="text-sm md:text-base font-medium flex items-center gap-2">
                              <Brain className="h-4 w-4" />
                              Criatividade: {formData.creativity}%
                            </Label>
                            <div className="space-y-2">
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="10"
                                value={formData.creativity}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  creativity: parseInt(e.target.value)
                                }))}
                                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                              />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Conservador</span>
                                <span>Equilibrado</span>
                                <span>Criativo</span>
                              </div>
                            </div>
                          </div>

                          {}
                          <div className="grid gap-4 md:gap-6">
                            {[
                              {
                                key: 'learningEnabled',
                                title: 'Aprendizado Contínuo',
                                description: 'Permite que o agente aprenda e evolua com as conversas',
                                icon: Brain
                              },
                              {
                                key: 'autoReply',
                                title: 'Respostas Automáticas',
                                description: 'Responde automaticamente às mensagens recebidas',
                                icon: Zap
                              },
                              {
                                key: 'replyToGroups',
                                title: 'Responder em Grupos',
                                description: 'Permite interação em conversas de grupo',
                                icon: Users
                              }
                            ].map((feature) => (
                              <div
                                key={feature.key}
                                className="flex items-center justify-between p-3 md:p-4 border rounded-lg"
                              >
                                <div className="flex items-start gap-2 md:gap-3 flex-1">
                                  <feature.icon className="h-4 w-4 md:h-5 md:w-5 text-primary mt-1 flex-shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <Label className="text-sm md:text-base font-medium block">{feature.title}</Label>
                                    <p className="text-xs md:text-sm text-muted-foreground mt-1">
                                      {feature.description}
                                    </p>
                                  </div>
                                </div>
                                <Switch
                                  checked={formData[feature.key]}
                                  onCheckedChange={(checked) =>
                                    setFormData(prev => ({ ...prev, [feature.key]: checked }))
                                  }
                                  className="flex-shrink-0"
                                />
                              </div>
                            ))}
                          </div>

                          {}
                          <div className="border-t pt-4 md:pt-6">
                            <h4 className="font-semibold mb-4 md:mb-6 flex items-center gap-2 text-sm md:text-base">
                              <Activity className="h-4 w-4 md:h-5 md:w-5" />
                              Resumo da Configuração
                            </h4>
                            <div className="grid gap-3 md:gap-4">
                              {[
                                { label: 'Sessão', value: formData.sessionId, type: 'badge' },
                                { label: 'Nome', value: formData.name },
                                { label: 'Especialização', value: specializations.find(s => s.id === formData.specialization)?.name },
                                { label: 'Personalidade', value: personalities.find(p => p.id === formData.personality)?.name },
                                { label: 'Criatividade', value: `${formData.creativity}%` },
                              ].map((item, index) => (
                                <div
                                  key={item.label}
                                  className="flex justify-between items-center"
                                >
                                  <span className="text-muted-foreground text-sm md:text-base">{item.label}:</span>
                                  {item.type === 'badge' ? (
                                    <Badge variant="outline" className="font-mono text-xs md:text-sm">
                                      {item.value}
                                    </Badge>
                                  ) : (
                                    <span className="font-medium text-sm md:text-base">{item.value}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
              </div>

              {}
              <div className="lg:col-span-1">
                <Card className="sticky top-4 md:top-8">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                      <Star className="h-4 w-4 md:h-5 md:w-5" />
                      Recursos Premium
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 md:space-y-4 p-4 md:p-6">
                    {[
                      { icon: Brain, title: 'IA Avançada', desc: 'GPT-4 e modelos de última geração' },
                      { icon: Zap, title: 'Respostas Rápidas', desc: 'Processamento em tempo real' },
                      { icon: Shield, title: 'Segurança Total', desc: 'Dados criptografados' },
                      { icon: Clock, title: 'Disponível 24/7', desc: 'Suporte contínuo' },
                    ].map((feature, index) => (
                      <div
                        key={feature.title}
                        className="flex items-start gap-2 md:gap-3 p-2 md:p-3 rounded-lg border"
                      >
                        <feature.icon className="h-4 w-4 md:h-5 md:w-5 text-primary mt-1 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-xs md:text-sm">{feature.title}</p>
                          <p className="text-xs text-muted-foreground">{feature.desc}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>

            {}
            <div className="flex justify-between items-center mt-4 md:mt-8 pt-4 md:pt-6 border-t">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="px-4 md:px-6 h-9 md:h-10"
                size="sm"
              >
                <span className="hidden sm:inline">Anterior</span>
                <span className="sm:hidden">Ant</span>
              </Button>

              <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                <span>Passo {currentStep} de {steps.length}</span>
              </div>

              {currentStep < steps.length ? (
                <Button
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="px-4 md:px-6 h-9 md:h-10"
                  size="sm"
                >
                  <span className="hidden sm:inline">Próximo</span>
                  <span className="sm:hidden">Próx</span>
                  <ChevronRight className="h-3 w-3 md:h-4 md:w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={creating || !canProceed()}
                  className="px-4 md:px-8 h-9 md:h-10"
                  size="sm"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-3 w-3 md:h-4 md:w-4 mr-2 animate-spin" />
                      <span className="hidden sm:inline">Criando...</span>
                      <span className="sm:hidden">...</span>
                    </>
                  ) : (
                    <>
                      <Rocket className="h-3 w-3 md:h-4 md:w-4 mr-2" />
                      <span className="hidden sm:inline">Criar Agente</span>
                      <span className="sm:hidden">Criar</span>
                    </>
                  )}
                </Button>
              )}
            </div>

            {}
            {creating && (
              <Card className="fixed bottom-4 right-4 min-w-[250px] md:min-w-[300px] z-50 shadow-lg">
                <CardContent className="p-3 md:p-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin text-primary" />
                      <span className="font-medium text-sm md:text-base">Criando agente...</span>
                    </div>
                    <Progress value={progress} className="h-1 md:h-2" />
                    <p className="text-xs text-muted-foreground">
                      {progress}% concluído
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
        </div>
      )}

      {}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-sm md:max-w-md mx-4">
          <div className="text-center space-y-3 md:space-y-4">
            <div className="w-12 h-12 md:w-16 md:h-16 border rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="h-6 w-6 md:h-8 md:w-8" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-lg md:text-xl">Agente Criado com Sucesso! 🎉</DialogTitle>
              <DialogDescription className="text-sm md:text-base">
                Seu agente de IA está pronto e operacional. Você pode visualizá-lo na aba "Gerenciar".
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setShowSuccessDialog(false)}
                className="flex-1 h-9 md:h-10"
                size="sm"
              >
                Fechar
              </Button>
              <Button
                onClick={() => {
                  setShowSuccessDialog(false)
                  setActiveTab('manage')
                }}
                className="flex-1 h-9 md:h-10"
                size="sm"
              >
                Ver Agentes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}