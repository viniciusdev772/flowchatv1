import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Bot, 
  Sparkles, 
  Brain, 
  Zap, 
  MessageSquare, 
  Users, 
  Shield, 
  Clock,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Star,
  CheckCircle,
  ArrowRight,
  Rocket,
  Heart,
  Target,
  Award,
  Palette,
  Globe,
  TrendingUp
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'

const agentTypes = [
  {
    id: 'sales',
    name: 'Vendas Pro',
    description: 'Especialista em conversão e relacionamento com clientes',
    icon: TrendingUp,
    color: 'from-emerald-500 to-teal-600',
    bgColor: 'bg-emerald-50',
    features: ['CRM Integrado', 'Follow-up Automático', 'Analytics de Vendas', 'Qualificação de Leads'],
    personality: 'Persuasivo e Empático',
    useCase: 'Aumenta conversões em 40% e melhora a experiência do cliente',
    stats: { conversion: '89%', response: '2s', satisfaction: '4.9/5' },
    demoMessages: [
      'Olá! Vi que você se interessou pelo nosso produto. Posso ajudar com alguma dúvida?',
      'Baseado no seu perfil, acredito que nossa solução Premium seria perfeita para você.',
      'Que tal agendar uma demonstração rápida? Tenho alguns horários livres hoje.'
    ]
  },
  {
    id: 'support',
    name: 'Suporte Expert',
    description: 'Assistente técnico inteligente com conhecimento profundo',
    icon: Shield,
    color: 'from-blue-500 to-cyan-600',
    bgColor: 'bg-blue-50',
    features: ['Base de Conhecimento', 'Tickets Automáticos', 'Escalação Inteligente', 'FAQ Dinâmico'],
    personality: 'Paciente e Detalhista',
    useCase: 'Resolve 75% dos problemas sem intervenção humana',
    stats: { resolution: '94%', response: '30s', satisfaction: '4.8/5' },
    demoMessages: [
      'Entendi seu problema. Vou te guiar passo a passo para resolver isso.',
      'Já identifiquei a causa. Aqui está a solução mais eficiente.',
      'Problema resolvido! Precisa de mais alguma coisa?'
    ]
  },
  {
    id: 'creative',
    name: 'Criativo AI',
    description: 'Designer e copywriter digital com visão artística',
    icon: Palette,
    color: 'from-purple-500 to-pink-600',
    bgColor: 'bg-purple-50',
    features: ['Geração de Conteúdo', 'Design Automático', 'Campanhas Criativas', 'Brand Voice'],
    personality: 'Inovador e Inspirador',
    useCase: 'Cria conteúdo engajante que aumenta interação em 60%',
    stats: { engagement: '92%', creativity: '4.9/5', productivity: '300%' },
    demoMessages: [
      '🎨 Tenho uma ideia incrível para sua próxima campanha!',
      'Que tal este conceito? [Gera mockup visual]',
      'Posso adaptar o tom da mensagem para seu público específico.'
    ]
  },
  {
    id: 'education',
    name: 'Mentor AI',
    description: 'Professor personalizado que adapta ao ritmo do aluno',
    icon: Brain,
    color: 'from-orange-500 to-red-600',
    bgColor: 'bg-orange-50',
    features: ['Planos Personalizados', 'Avaliação Contínua', 'Gamificação', 'Relatórios de Progresso'],
    personality: 'Didático e Motivador',
    useCase: 'Melhora o aprendizado em 85% com metodologia adaptativa',
    stats: { completion: '88%', satisfaction: '4.7/5', retention: '91%' },
    demoMessages: [
      'Vamos aprender de forma divertida! Qual seu nível atual?',
      'Perfeito! Você dominou este conceito. Vamos para o próximo nível.',
      'Que tal um desafio? Tenho um exercício perfeito para você!'
    ]
  },
  {
    id: 'assistant',
    name: 'Assistente Universal',
    description: 'Polivalente e adaptável para qualquer necessidade',
    icon: Bot,
    color: 'from-gray-600 to-slate-700',
    bgColor: 'bg-gray-50',
    features: ['Multi-tarefa', 'Integração Total', 'Aprendizado Contínuo', 'API Flexível'],
    personality: 'Versátil e Confiável',
    useCase: 'Automatiza 90% das tarefas rotineiras com precisão',
    stats: { efficiency: '96%', accuracy: '98%', availability: '99.9%' },
    demoMessages: [
      'Posso ajudar com agenda, lembretes, pesquisas e muito mais!',
      'Identifiquei um padrão nas suas atividades. Posso otimizar sua rotina.',
      'Tarefa concluída! Já agendei a próxima ação no seu calendário.'
    ]
  },
  {
    id: 'analytics',
    name: 'Analytics Pro',
    description: 'Especialista em dados e insights empresariais',
    icon: Target,
    color: 'from-indigo-500 to-purple-600',
    bgColor: 'bg-indigo-50',
    features: ['Dashboard Inteligente', 'Previsões AI', 'Relatórios Automáticos', 'KPI Tracking'],
    personality: 'Analítico e Preciso',
    useCase: 'Identifica oportunidades que aumentam ROI em 45%',
    stats: { accuracy: '97%', insights: '150+', roi: '+45%' },
    demoMessages: [
      '📊 Detectei uma tendência interessante nos seus dados.',
      'Baseado nos padrões, prevejo um aumento de 30% nas vendas.',
      'Recomendo focar no segmento X - maior potencial de crescimento.'
    ]
  }
]

const floatingIcons = [
  { icon: Sparkles, delay: 0, x: 10, y: 15 },
  { icon: Brain, delay: 0.5, x: 80, y: 25 },
  { icon: Zap, delay: 1, x: 20, y: 70 },
  { icon: Heart, delay: 1.5, x: 70, y: 80 },
  { icon: Star, delay: 2, x: 90, y: 50 },
  { icon: Rocket, delay: 2.5, x: 40, y: 20 }
]

export default function AgentShowcase() {
  const [currentAgent, setCurrentAgent] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [messageIndex, setMessageIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const intervalRef = useRef(null)
  const showcaseRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { threshold: 0.3 }
    )

    if (showcaseRef.current) {
      observer.observe(showcaseRef.current)
    }

    return () => {
      if (showcaseRef.current) {
        observer.unobserve(showcaseRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isPlaying && isVisible) {
      intervalRef.current = setInterval(() => {
        setCurrentAgent(prev => (prev + 1) % agentTypes.length)
        setMessageIndex(0)
      }, 4000)

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    }
  }, [isPlaying, isVisible])

  useEffect(() => {
    if (isVisible) {
      const messageInterval = setInterval(() => {
        setMessageIndex(prev => (prev + 1) % 3)
      }, 1500)

      return () => clearInterval(messageInterval)
    }
  }, [currentAgent, isVisible])

  const nextAgent = () => {
    setCurrentAgent(prev => (prev + 1) % agentTypes.length)
    setMessageIndex(0)
  }

  const prevAgent = () => {
    setCurrentAgent(prev => (prev - 1 + agentTypes.length) % agentTypes.length)
    setMessageIndex(0)
  }

  const agent = agentTypes[currentAgent]

  return (
    <div ref={showcaseRef} className="relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 opacity-50" />
      
      {/* Floating Icons */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {floatingIcons.map((item, index) => (
          <motion.div
            key={index}
            className="absolute text-slate-300"
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
            animate={{
              y: [0, -20, 0],
              rotate: [0, 5, -5, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              delay: item.delay,
              ease: "easeInOut"
            }}
          >
            <item.icon className="w-6 h-6 opacity-30" />
          </motion.div>
        ))}
      </div>

      <div className="relative z-10">
        <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
              transition={{ duration: 0.6 }}
            >
              <CardTitle className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Agentes Inteligentes
              </CardTitle>
              <CardDescription className="text-lg mt-2 text-slate-600">
                Descubra o poder da IA personalizada para seu negócio
              </CardDescription>
            </motion.div>
          </CardHeader>

          <CardContent className="p-6">
            {/* Main Showcase */}
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              {/* Agent Info */}
              <motion.div
                key={currentAgent}
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
              >
                {/* Agent Header */}
                <div className="flex items-center gap-4">
                  <motion.div
                    className={`p-4 rounded-2xl bg-gradient-to-br ${agent.color} shadow-lg`}
                    whileHover={{ scale: 1.05, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <agent.icon className="w-8 h-8 text-white" />
                  </motion.div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-800">{agent.name}</h3>
                    <p className="text-slate-600">{agent.description}</p>
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500" />
                    Recursos Principais
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {agent.features.map((feature, index) => (
                      <motion.div
                        key={feature}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center gap-2 p-3 rounded-lg bg-white border shadow-sm"
                      >
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-slate-700">{feature}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(agent.stats).map(([key, value], index) => (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + index * 0.1 }}
                      className="text-center p-3 rounded-lg bg-white border shadow-sm"
                    >
                      <div className="text-2xl font-bold text-slate-800">{value}</div>
                      <div className="text-xs text-slate-500 capitalize">{key}</div>
                    </motion.div>
                  ))}
                </div>

                {/* Use Case */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200"
                >
                  <div className="flex items-start gap-3">
                    <Target className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                    <div>
                      <h5 className="font-semibold text-slate-800 mb-1">Impacto no Negócio</h5>
                      <p className="text-sm text-slate-600">{agent.useCase}</p>
                    </div>
                  </div>
                </motion.div>
              </motion.div>

              {/* Interactive Demo */}
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="relative"
              >
                {/* Phone Mockup */}
                <div className="mx-auto max-w-sm">
                  <div className="relative bg-slate-800 rounded-[2.5rem] p-2 shadow-2xl">
                    <div className="bg-white rounded-[2rem] overflow-hidden">
                      {/* Phone Header */}
                      <div className="bg-slate-100 px-4 py-3 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${agent.color} flex items-center justify-center`}>
                          <agent.icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">{agent.name}</div>
                          <div className="text-xs text-green-600 flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            Online
                          </div>
                        </div>
                      </div>

                      {/* Chat Messages */}
                      <div className="p-4 space-y-3 h-64 overflow-hidden">
                        <AnimatePresence mode="wait">
                          {agent.demoMessages.map((message, index) => (
                            <motion.div
                              key={`${currentAgent}-${index}`}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ 
                                opacity: index <= messageIndex ? 1 : 0.3,
                                y: index <= messageIndex ? 0 : 20 
                              }}
                              transition={{ duration: 0.5, delay: index * 0.3 }}
                              className={`flex ${index === messageIndex ? '' : 'opacity-50'}`}
                            >
                              <div className="bg-blue-500 text-white rounded-2xl rounded-bl-sm px-4 py-2 max-w-[80%] shadow-sm">
                                <p className="text-sm">{message}</p>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>

                        {/* Typing Indicator */}
                        <motion.div
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="flex items-center gap-2 text-slate-500"
                        >
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                          </div>
                          <span className="text-xs">digitando...</span>
                        </motion.div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating Features */}
                <div className="absolute -top-4 -right-4 space-y-2">
                  {['Tempo Real', 'IA Avançada', 'Multi-idioma'].map((feature, index) => (
                    <motion.div
                      key={feature}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1 + index * 0.2 }}
                      className="bg-white rounded-full px-3 py-1 shadow-lg border text-xs font-medium text-slate-700"
                    >
                      {feature}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevAgent}
                  className="rounded-full w-10 h-10 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="rounded-full w-10 h-10 p-0"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextAgent}
                  className="rounded-full w-10 h-10 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Agent Dots */}
              <div className="flex gap-2">
                {agentTypes.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setCurrentAgent(index)
                      setMessageIndex(0)
                    }}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentAgent
                        ? 'bg-blue-500 w-6'
                        : 'bg-slate-300 hover:bg-slate-400'
                    }`}
                  />
                ))}
              </div>

              {/* Progress */}
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock className="w-4 h-4" />
                <span>{currentAgent + 1} / {agentTypes.length}</span>
              </div>
            </div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="text-center mt-8 pt-6 border-t"
            >
              <h4 className="text-xl font-bold text-slate-800 mb-2">
                Pronto para criar seu agente personalizado?
              </h4>
              <p className="text-slate-600 mb-4">
                Configure em minutos e transforme seu atendimento
              </p>
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                Começar Agora
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}