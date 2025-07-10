import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
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

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
}

const slideIn = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 }
}

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

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
  })

  const personalities = [
    { 
      id: 'professional', 
      name: 'Profissional', 
      desc: 'Formal e objetivo',
      icon: '💼',
      color: 'bg-blue-100 text-blue-800'
    },
    { 
      id: 'friendly', 
      name: 'Amigável', 
      desc: 'Caloroso e acolhedor',
      icon: '😊',
      color: 'bg-green-100 text-green-800'
    },
    { 
      id: 'creative', 
      name: 'Criativo', 
      desc: 'Inovador e artístico',
      icon: '🎨',
      color: 'bg-purple-100 text-purple-800'
    },
    { 
      id: 'analytical', 
      name: 'Analítico', 
      desc: 'Lógico e detalhado',
      icon: '📊',
      color: 'bg-orange-100 text-orange-800'
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
      icon: Bot,
      color: 'text-blue-600'
    },
    { 
      id: 2, 
      name: 'Configuração', 
      description: 'Personalizar agente',
      icon: Settings,
      color: 'text-purple-600'
    },
    { 
      id: 3, 
      name: 'Finalização', 
      description: 'Revisar e criar',
      icon: Rocket,
      color: 'text-green-600'
    }
  ]

  useEffect(() => {
    loadSessions()
  }, [])

  useEffect(() => {
    // Atualizar progress baseado no step
    const stepProgress = ((currentStep - 1) / (steps.length - 1)) * 100
    setProgress(stepProgress)
  }, [currentStep])

  useEffect(() => {
    // Validação em tempo real
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
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const loadSessions = async () => {
    try {
      setLoading(true)
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      
      // Get token first
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

      // Get sessions
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
      
      // Simulate progress
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

      // Get token
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

      // Create agent
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
          personality: formData.personality,
          specialization: formData.specialization,
          creativity: formData.creativity,
          learningEnabled: formData.learningEnabled,
          autoReply: formData.autoReply,
          smartReplies: true,
          replyToGroups: formData.replyToGroups,
          openaiApiKey: formData.apiKey,
          tools: ['web_search'],
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create agent')
      }

      // Success
      setShowSuccessDialog(true)
      toast({
        title: "Agente criado com sucesso! 🎉",
        description: "Seu agente de IA está pronto para uso",
      })

      // Reset form
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
      case 2: return formData.name.trim() && formData.apiKey.trim() && !validationErrors.name && !validationErrors.apiKey
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
      <motion.div 
        className="flex items-center justify-center min-h-[600px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="text-center space-y-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="h-12 w-12 mx-auto text-primary" />
          </motion.div>
          <div className="space-y-2">
            <p className="text-lg font-medium">Inicializando Sistema de IA</p>
            <p className="text-sm text-muted-foreground">Carregando sessões WhatsApp...</p>
          </div>
          <Progress value={60} className="w-64 mx-auto" />
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div 
      className="container mx-auto py-8 space-y-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <motion.div 
        className="text-center space-y-4"
        variants={fadeInUp}
        initial="initial"
        animate="animate"
      >
        <div className="flex items-center justify-center space-x-3">
          <motion.div
            whileHover={{ scale: 1.1, rotate: 180 }}
            transition={{ duration: 0.3 }}
            className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full"
          >
            <Sparkles className="h-8 w-8 text-white" />
          </motion.div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Agentes de IA
          </h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Crie e gerencie assistentes inteligentes para WhatsApp com tecnologia de ponta
        </p>
      </motion.div>

      {/* Enhanced Tab Navigation */}
      <motion.div 
        className="flex justify-center"
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.2 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-md">
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="create" className="flex items-center gap-2 text-sm font-medium">
              <Plus className="h-4 w-4" />
              Criar Agente
            </TabsTrigger>
            <TabsTrigger value="manage" className="flex items-center gap-2 text-sm font-medium">
              <Settings className="h-4 w-4" />
              Gerenciar
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </motion.div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'manage' ? (
          <motion.div
            key="manage"
            variants={slideIn}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <AgentsList onRefresh={() => {}} />
          </motion.div>
        ) : (
          <motion.div
            key="create"
            variants={slideIn}
            initial="initial"
            animate="animate"
            exit="exit"
            className="max-w-4xl mx-auto"
          >
            {/* Enhanced Progress Steps */}
            <motion.div 
              className="mb-12"
              variants={stagger}
              initial="initial"
              animate="animate"
            >
              <div className="flex justify-between items-center mb-6">
                {steps.map((step, index) => (
                  <motion.div
                    key={step.id}
                    variants={fadeInUp}
                    className="flex flex-col items-center space-y-2 flex-1"
                  >
                    <motion.div
                      className={`relative w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                        currentStep >= step.id
                          ? 'bg-primary border-primary text-primary-foreground shadow-lg'
                          : 'bg-background border-muted-foreground/30 text-muted-foreground'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      animate={currentStep === step.id ? { 
                        boxShadow: "0 0 0 4px rgba(99, 102, 241, 0.2)" 
                      } : {}}
                    >
                      {currentStep > step.id ? (
                        <CheckCircle className="h-6 w-6" />
                      ) : (
                        <step.icon className={`h-6 w-6 ${step.color}`} />
                      )}
                      {currentStep === step.id && (
                        <motion.div
                          className="absolute inset-0 rounded-full border-2 border-primary"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}
                    </motion.div>
                    <div className="text-center">
                      <p className={`text-sm font-medium ${
                        currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {step.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`absolute top-6 left-full w-full h-0.5 -translate-y-1/2 ${
                        currentStep > step.id ? 'bg-primary' : 'bg-muted'
                      }`} />
                    )}
                  </motion.div>
                ))}
              </div>
              <Progress value={progress} className="h-2" />
            </motion.div>

            {/* Error Display */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-4 border border-destructive/50 bg-destructive/10 rounded-lg flex items-start gap-3"
                >
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-destructive">Erro</p>
                    <p className="text-sm text-destructive/80">{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Content */}
              <div className="lg:col-span-2">
                <AnimatePresence mode="wait">
                  {/* Step 1: Session Selection */}
                  {currentStep === 1 && (
                    <motion.div
                      key="step1"
                      variants={fadeInUp}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                    >
                      <Card className="border-0 shadow-lg">
                        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
                          <CardTitle className="flex items-center gap-3">
                            <Bot className="h-6 w-6 text-blue-600" />
                            Conectar Sessão WhatsApp
                          </CardTitle>
                          <CardDescription>
                            Selecione uma sessão ativa para o seu agente de IA
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                          <div className="space-y-3">
                            <Label htmlFor="session" className="text-base font-medium">
                              Sessão WhatsApp
                            </Label>
                            <Select 
                              value={formData.sessionId} 
                              onValueChange={(value) => {
                                setFormData(prev => ({ ...prev, sessionId: value }))
                                setValidationErrors(prev => ({ ...prev, sessionId: undefined }))
                              }}
                            >
                              <SelectTrigger className={`h-12 ${validationErrors.sessionId ? 'border-destructive' : ''}`}>
                                <SelectValue placeholder="Selecione uma sessão conectada..." />
                              </SelectTrigger>
                              <SelectContent>
                                {sessions.map((session) => (
                                  <SelectItem key={session.sessionId} value={session.sessionId}>
                                    <div className="flex items-center gap-3">
                                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                                      <div>
                                        <p className="font-medium">{session.sessionId}</p>
                                        <p className="text-xs text-muted-foreground">Conectado</p>
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {validationErrors.sessionId && (
                              <p className="text-sm text-destructive flex items-center gap-1">
                                <AlertCircle className="h-4 w-4" />
                                {validationErrors.sessionId}
                              </p>
                            )}
                            {sessions.length === 0 && (
                              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-sm text-yellow-800 flex items-center gap-2">
                                  <AlertCircle className="h-4 w-4" />
                                  Nenhuma sessão conectada encontrada. Conecte uma sessão WhatsApp primeiro.
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {/* Step 2: Configuration */}
                  {currentStep === 2 && (
                    <motion.div
                      key="step2"
                      variants={fadeInUp}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="space-y-6"
                    >
                      <Card className="border-0 shadow-lg">
                        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-lg">
                          <CardTitle className="flex items-center gap-3">
                            <Sparkles className="h-6 w-6 text-purple-600" />
                            Configuração do Agente
                          </CardTitle>
                          <CardDescription>
                            Defina a identidade e comportamento do seu assistente
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                          {/* Basic Info */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                              <Label htmlFor="name" className="text-base font-medium">
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
                                className={`h-12 ${validationErrors.name ? 'border-destructive' : ''}`}
                              />
                              {validationErrors.name && (
                                <p className="text-sm text-destructive flex items-center gap-1">
                                  <AlertCircle className="h-4 w-4" />
                                  {validationErrors.name}
                                </p>
                              )}
                            </div>
                            
                            <div className="space-y-3">
                              <Label className="text-base font-medium">Especialização</Label>
                              <Select 
                                value={formData.specialization} 
                                onValueChange={(value) =>
                                  setFormData(prev => ({ ...prev, specialization: value }))
                                }
                              >
                                <SelectTrigger className="h-12">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {specializations.map((spec) => (
                                    <SelectItem key={spec.id} value={spec.id}>
                                      <div className="flex items-center gap-2">
                                        <spec.icon className="h-4 w-4" />
                                        {spec.name}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Description */}
                          <div className="space-y-3">
                            <Label htmlFor="description" className="text-base font-medium">
                              Descrição (Opcional)
                            </Label>
                            <Textarea
                              id="description"
                              placeholder="Descreva a personalidade e objetivos do agente..."
                              value={formData.description}
                              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                              rows={3}
                              className="resize-none"
                            />
                          </div>

                          {/* API Key */}
                          <div className="space-y-3">
                            <Label htmlFor="apiKey" className="text-base font-medium">
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
                              className={`h-12 ${validationErrors.apiKey ? 'border-destructive' : ''}`}
                            />
                            {validationErrors.apiKey && (
                              <p className="text-sm text-destructive flex items-center gap-1">
                                <AlertCircle className="h-4 w-4" />
                                {validationErrors.apiKey}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Shield className="h-3 w-3" />
                              Sua chave será criptografada e armazenada com segurança
                            </p>
                          </div>

                          {/* Personality */}
                          <div className="space-y-4">
                            <Label className="text-base font-medium">Personalidade</Label>
                            <div className="grid grid-cols-2 gap-3">
                              {personalities.map((personality) => (
                                <motion.div
                                  key={personality.id}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                    formData.personality === personality.id
                                      ? 'border-primary bg-primary/5'
                                      : 'border-muted hover:border-primary/50'
                                  }`}
                                  onClick={() => setFormData(prev => ({ ...prev, personality: personality.id }))}
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="text-2xl">{personality.icon}</span>
                                    <div>
                                      <p className="font-medium">{personality.name}</p>
                                      <p className="text-xs text-muted-foreground">{personality.desc}</p>
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {/* Step 3: Advanced Settings */}
                  {currentStep === 3 && (
                    <motion.div
                      key="step3"
                      variants={fadeInUp}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="space-y-6"
                    >
                      <Card className="border-0 shadow-lg">
                        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-lg">
                          <CardTitle className="flex items-center gap-3">
                            <Settings className="h-6 w-6 text-green-600" />
                            Configurações Avançadas
                          </CardTitle>
                          <CardDescription>
                            Ajuste o comportamento e capacidades do agente
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-8">
                          {/* Creativity Slider */}
                          <div className="space-y-4">
                            <Label className="text-base font-medium flex items-center gap-2">
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
                                className="w-full h-2 bg-gradient-to-r from-blue-200 to-purple-200 rounded-lg appearance-none cursor-pointer"
                              />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Conservador</span>
                                <span>Equilibrado</span>
                                <span>Criativo</span>
                              </div>
                            </div>
                          </div>

                          {/* Feature Toggles */}
                          <div className="grid gap-6">
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
                              <motion.div
                                key={feature.key}
                                className="flex items-center justify-between p-4 border rounded-lg"
                                whileHover={{ backgroundColor: "rgba(0,0,0,0.02)" }}
                              >
                                <div className="flex items-start gap-3">
                                  <feature.icon className="h-5 w-5 text-primary mt-1" />
                                  <div>
                                    <Label className="text-base font-medium">{feature.title}</Label>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {feature.description}
                                    </p>
                                  </div>
                                </div>
                                <Switch
                                  checked={formData[feature.key]}
                                  onCheckedChange={(checked) =>
                                    setFormData(prev => ({ ...prev, [feature.key]: checked }))
                                  }
                                />
                              </motion.div>
                            ))}
                          </div>

                          {/* Summary */}
                          <motion.div 
                            className="border-t pt-6"
                            variants={fadeInUp}
                          >
                            <h4 className="font-semibold mb-6 flex items-center gap-2">
                              <Activity className="h-5 w-5" />
                              Resumo da Configuração
                            </h4>
                            <div className="grid gap-4">
                              {[
                                { label: 'Sessão', value: formData.sessionId, type: 'badge' },
                                { label: 'Nome', value: formData.name },
                                { label: 'Especialização', value: specializations.find(s => s.id === formData.specialization)?.name },
                                { label: 'Personalidade', value: personalities.find(p => p.id === formData.personality)?.name },
                                { label: 'Criatividade', value: `${formData.creativity}%` },
                              ].map((item, index) => (
                                <motion.div
                                  key={item.label}
                                  className="flex justify-between items-center"
                                  variants={fadeInUp}
                                  transition={{ delay: index * 0.1 }}
                                >
                                  <span className="text-muted-foreground">{item.label}:</span>
                                  {item.type === 'badge' ? (
                                    <Badge variant="outline" className="font-mono">
                                      {item.value}
                                    </Badge>
                                  ) : (
                                    <span className="font-medium">{item.value}</span>
                                  )}
                                </motion.div>
                              ))}
                            </div>
                          </motion.div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Sidebar */}
              <motion.div 
                className="lg:col-span-1"
                variants={fadeInUp}
                initial="initial"
                animate="animate"
                transition={{ delay: 0.3 }}
              >
                <Card className="sticky top-8 border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-yellow-500" />
                      Recursos Premium
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { icon: Brain, title: 'IA Avançada', desc: 'GPT-4 e modelos de última geração' },
                      { icon: Zap, title: 'Respostas Rápidas', desc: 'Processamento em tempo real' },
                      { icon: Shield, title: 'Segurança Total', desc: 'Dados criptografados' },
                      { icon: Clock, title: 'Disponível 24/7', desc: 'Suporte contínuo' },
                    ].map((feature, index) => (
                      <motion.div
                        key={feature.title}
                        className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100"
                        variants={fadeInUp}
                        transition={{ delay: 0.4 + index * 0.1 }}
                      >
                        <feature.icon className="h-5 w-5 text-primary mt-1" />
                        <div>
                          <p className="font-medium text-sm">{feature.title}</p>
                          <p className="text-xs text-muted-foreground">{feature.desc}</p>
                        </div>
                      </motion.div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Navigation */}
            <motion.div 
              className="flex justify-between items-center mt-8 pt-6 border-t"
              variants={fadeInUp}
              initial="initial"
              animate="animate"
              transition={{ delay: 0.5 }}
            >
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="px-6"
              >
                Anterior
              </Button>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Passo {currentStep} de {steps.length}</span>
              </div>

              {currentStep < steps.length ? (
                <Button
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="px-6"
                >
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={creating || !canProceed()}
                  className="px-8"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4 mr-2" />
                      Criar Agente
                    </>
                  )}
                </Button>
              )}
            </motion.div>

            {/* Progress during creation */}
            <AnimatePresence>
              {creating && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="fixed bottom-4 right-4 bg-background border rounded-lg shadow-lg p-4 min-w-[300px]"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="font-medium">Criando agente...</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {progress}% concluído
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-md">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center space-y-4"
          >
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5, repeat: 2 }}
              className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto"
            >
              <CheckCircle className="h-8 w-8 text-green-600" />
            </motion.div>
            <DialogHeader>
              <DialogTitle className="text-xl">Agente Criado com Sucesso! 🎉</DialogTitle>
              <DialogDescription>
                Seu agente de IA está pronto e operacional. Você pode visualizá-lo na aba "Gerenciar".
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowSuccessDialog(false)}
                className="flex-1"
              >
                Fechar
              </Button>
              <Button 
                onClick={() => {
                  setShowSuccessDialog(false)
                  setActiveTab('manage')
                }}
                className="flex-1"
              >
                Ver Agentes
              </Button>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}