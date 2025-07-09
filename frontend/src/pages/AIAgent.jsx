import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Bot, Sparkles, Settings, Plus, CheckCircle, AlertCircle, Loader2, ChevronRight } from 'lucide-react'
import AgentsList from '../components/AgentsList'

export default function AIAgent() {
  const [activeTab, setActiveTab] = useState('create')
  const [currentStep, setCurrentStep] = useState(1)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)

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
    { id: 'professional', name: 'Profissional', desc: 'Formal e objetivo' },
    { id: 'friendly', name: 'Amigável', desc: 'Caloroso e acolhedor' },
    { id: 'creative', name: 'Criativo', desc: 'Inovador e artístico' },
    { id: 'analytical', name: 'Analítico', desc: 'Lógico e detalhado' },
  ]

  const specializations = [
    { id: 'general', name: 'Assistente Geral' },
    { id: 'sales', name: 'Vendas & Marketing' },
    { id: 'support', name: 'Suporte ao Cliente' },
    { id: 'education', name: 'Educação & Ensino' },
  ]

  useEffect(() => {
    loadSessions()
  }, [])

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
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    try {
      setCreating(true)
      setError(null)

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      
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

      // Success - switch to manage tab
      setActiveTab('manage')
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
    } finally {
      setCreating(false)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1: return formData.sessionId
      case 2: return formData.name.trim() && formData.apiKey.trim()
      case 3: return true
      default: return false
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Carregando sessões...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Agentes de IA</h1>
        <p className="text-muted-foreground">
          Crie e gerencie assistentes inteligentes para WhatsApp
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex justify-center">
        <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1">
          <Button
            variant={activeTab === 'create' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('create')}
            className="px-3"
          >
            <Plus className="h-4 w-4 mr-2" />
            Criar Agente
          </Button>
          <Button
            variant={activeTab === 'manage' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('manage')}
            className="px-3"
          >
            <Settings className="h-4 w-4 mr-2" />
            Gerenciar
          </Button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'manage' ? (
        <AgentsList onRefresh={() => {}} />
      ) : (
        <div className="max-w-2xl mx-auto">
          {/* Progress */}
          <div className="flex items-center justify-center mb-8">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= step 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {currentStep > step ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    step
                  )}
                </div>
                {step < 3 && (
                  <div className={`w-12 h-px mx-2 ${
                    currentStep > step ? 'bg-primary' : 'bg-muted'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-6 p-4 border border-destructive/50 bg-destructive/10 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="text-sm text-destructive">{error}</div>
            </div>
          )}

          {/* Step 1: Session Selection */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Selecionar Sessão
                </CardTitle>
                <CardDescription>
                  Escolha a sessão WhatsApp para o agente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="session">Sessão WhatsApp</Label>
                  <Select value={formData.sessionId} onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, sessionId: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma sessão..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions.map((session) => (
                        <SelectItem key={session.sessionId} value={session.sessionId}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                            {session.sessionId}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {sessions.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma sessão conectada encontrada
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Basic Configuration */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Configuração Básica
                </CardTitle>
                <CardDescription>
                  Defina a identidade do seu agente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Agente</Label>
                    <Input
                      id="name"
                      placeholder="Ex: Aurora Assistant"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="specialization">Especialização</Label>
                    <Select value={formData.specialization} onValueChange={(value) =>
                      setFormData(prev => ({ ...prev, specialization: value }))
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {specializations.map((spec) => (
                          <SelectItem key={spec.id} value={spec.id}>
                            {spec.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição (Opcional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Descreva a personalidade e objetivos do agente..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiKey">Chave OpenAI API</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="sk-..."
                    value={formData.apiKey}
                    onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Sua chave será criptografada e armazenada com segurança
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="personality">Personalidade</Label>
                  <Select value={formData.personality} onValueChange={(value) =>
                    setFormData(prev => ({ ...prev, personality: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {personalities.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <div>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{p.desc}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Advanced Settings */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configurações Avançadas
                </CardTitle>
                <CardDescription>
                  Ajuste o comportamento do agente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="creativity">
                    Criatividade: {formData.creativity}%
                  </Label>
                  <input
                    id="creativity"
                    type="range"
                    min="0"
                    max="100"
                    step="10"
                    value={formData.creativity}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      creativity: parseInt(e.target.value) 
                    }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Conservador</span>
                    <span>Equilibrado</span>
                    <span>Criativo</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Aprendizado Contínuo</Label>
                      <p className="text-xs text-muted-foreground">
                        Permite que o agente aprenda com conversas
                      </p>
                    </div>
                    <Switch
                      checked={formData.learningEnabled}
                      onCheckedChange={(checked) =>
                        setFormData(prev => ({ ...prev, learningEnabled: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Respostas Automáticas</Label>
                      <p className="text-xs text-muted-foreground">
                        Responde automaticamente às mensagens
                      </p>
                    </div>
                    <Switch
                      checked={formData.autoReply}
                      onCheckedChange={(checked) =>
                        setFormData(prev => ({ ...prev, autoReply: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Responder em Grupos</Label>
                      <p className="text-xs text-muted-foreground">
                        Permite que o agente responda mensagens de grupos
                      </p>
                    </div>
                    <Switch
                      checked={formData.replyToGroups}
                      onCheckedChange={(checked) =>
                        setFormData(prev => ({ ...prev, replyToGroups: checked }))
                      }
                    />
                  </div>
                </div>

                {/* Summary */}
                <div className="border-t pt-6">
                  <h4 className="font-medium mb-4">Resumo da Configuração</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sessão:</span>
                      <Badge variant="outline">{formData.sessionId}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nome:</span>
                      <span>{formData.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Especialização:</span>
                      <span>{specializations.find(s => s.id === formData.specialization)?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Personalidade:</span>
                      <span>{personalities.find(p => p.id === formData.personality)?.name}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
              disabled={currentStep === 1}
            >
              Anterior
            </Button>

            {currentStep < 3 ? (
              <Button
                onClick={() => setCurrentStep(prev => prev + 1)}
                disabled={!canProceed()}
              >
                Próximo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={creating || !canProceed()}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Agente'
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}