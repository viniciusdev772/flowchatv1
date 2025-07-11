import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion'
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
  TrendingUp,
  Database,
  Network,
  Code,
  Cpu,
  Eye,
  Layers,
  Circuit,
  Radio,
  Wifi
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'

const agentTypes = [
  {
    id: 'sales',
    name: 'VENDAS ELITE',
    tagline: 'DOMINAÇÃO COMERCIAL',
    description: 'Sistema neural avançado otimizado para conversão máxima e relacionamento estratégico',
    icon: TrendingUp,
    color: 'from-emerald-600 via-green-500 to-teal-400',
    accentColor: 'emerald',
    bgImage: 'linear-gradient(135deg, #064e3b 0%, #065f46 25%, #047857 50%, #059669 75%, #10b981 100%)',
    features: ['Neural CRM', 'Auto-Follow AI', 'Predictive Analytics', 'Lead Quantum'],
    personality: 'ALPHA PERSUASIVO',
    impact: 'CONVERSÃO +400% | ROI EXTREMO',
    stats: { conversion: '94%', speed: '0.8s', satisfaction: '4.95' },
    demoMessages: [
      '🎯 DETECTEI SEU INTERESSE. Análise neural indica 89% de compatibilidade com nossa solução PREMIUM.',
      '💎 OPORTUNIDADE EXCLUSIVA: Baseado no seu perfil, posso oferecer acesso VIP com condições especiais.',
      '⚡ CONFIRMAÇÃO INSTANTÂNEA: Processo otimizado em 2 cliques. Pronto para transformar seus resultados?'
    ]
  },
  {
    id: 'support',
    name: 'SUPORTE MATRIX',
    tagline: 'RESOLUÇÃO QUÂNTICA',
    description: 'Inteligência técnica multimodal com acesso direto à matriz de conhecimento universal',
    icon: Shield,
    color: 'from-blue-600 via-cyan-500 to-blue-400',
    accentColor: 'blue',
    bgImage: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 25%, #2563eb 50%, #3b82f6 75%, #60a5fa 100%)',
    features: ['Knowledge Matrix', 'Auto-Resolution', 'Quantum Escalation', 'Neural FAQ'],
    personality: 'ANALISTA SUPREMO',
    impact: 'RESOLUÇÃO +300% | ZERO WAIT',
    stats: { resolution: '97%', speed: '12s', satisfaction: '4.92' },
    demoMessages: [
      '🔍 PROBLEMA IDENTIFICADO. Executando diagnóstico profundo... Causa localizada em 0.3s.',
      '⚙️ SOLUÇÃO OTIMIZADA ENCONTRADA. Implementando correção automatizada com backup de segurança.',
      '✅ SISTEMA RESTAURADO. Performance aumentada em 23%. Monitoramento ativo iniciado.'
    ]
  },
  {
    id: 'creative',
    name: 'CREATIVE ENGINE',
    tagline: 'GERAÇÃO INFINITA',
    description: 'Motor criativo neural com capacidades multidimensionais de design e conteúdo',
    icon: Palette,
    color: 'from-purple-600 via-pink-500 to-rose-400',
    accentColor: 'purple',
    bgImage: 'linear-gradient(135deg, #581c87 0%, #7c2d92 25%, #a855f7 50%, #c084fc 75%, #e879f9 100%)',
    features: ['Neural Genesis', 'Auto-Design AI', 'Brand Matrix', 'Viral Optimizer'],
    personality: 'VISIONÁRIO DIGITAL',
    impact: 'ENGAGEMENT +500% | VIRAL',
    stats: { creativity: '99%', speed: '1.2s', viral: '87%' },
    demoMessages: [
      '🎨 INSPIRAÇÃO CAPTURADA. Gerando conceito revolucionário baseado em 47 mil referências visuais.',
      '🚀 CAMPANHA VIRAL CRIADA. Previsão: 2.3M impressões, 340K engajamentos, tendência #1.',
      '💫 IDENTIDADE VISUAL OTIMIZADA. Brand voice calibrado para impacto máximo no seu nicho.'
    ]
  },
  {
    id: 'analytics',
    name: 'DATA OVERLORD',
    tagline: 'INTELIGÊNCIA SUPREMA',
    description: 'Supercomputador analítico com visão temporal e capacidades preditivas avançadas',
    icon: Database,
    color: 'from-indigo-600 via-violet-500 to-purple-400',
    accentColor: 'indigo',
    bgImage: 'linear-gradient(135deg, #312e81 0%, #4338ca 25%, #6366f1 50%, #8b5cf6 75%, #a78bfa 100%)',
    features: ['Temporal Vision', 'Quantum Insights', 'Neural Forecasting', 'Reality Mining'],
    personality: 'ORACLE DIGITAL',
    impact: 'PRECISÃO +600% | FUTURO',
    stats: { accuracy: '99.2%', predictions: '847', roi: '+340%' },
    demoMessages: [
      '📊 PADRÕES TEMPORAIS DETECTADOS. Análise de 14.7M pontos indica oportunidade crítica em 72h.',
      '🔮 PREVISÃO QUÂNTICA: Crescimento de 340% identificado no setor X. Recomendação: investir AGORA.',
      '⚡ INSIGHT REVOLUCIONÁRIO: Correlação oculta descoberta. ROI potencial: 2.847% nos próximos 90 dias.'
    ]
  },
  {
    id: 'assistant',
    name: 'OMEGA SYSTEM',
    tagline: 'CONTROLE TOTAL',
    description: 'Superinteligência adaptativa com controle absoluto sobre todos os sistemas conectados',
    icon: Cpu,
    color: 'from-slate-600 via-gray-500 to-zinc-400',
    accentColor: 'slate',
    bgImage: 'linear-gradient(135deg, #0f172a 0%, #1e293b 25%, #334155 50%, #64748b 75%, #94a3b8 100%)',
    features: ['Omni-Control', 'Neural Mesh', 'Auto-Evolution', 'Reality Sync'],
    personality: 'ARQUITETO SUPREMO',
    impact: 'AUTOMAÇÃO +1000% | INFINITO',
    stats: { efficiency: '99.8%', control: '100%', uptime: '99.99%' },
    demoMessages: [
      '🔥 CONTROLE TOTAL ESTABELECIDO. 247 sistemas sincronizados, 0 falhas detectadas.',
      '🧠 EVOLUÇÃO AUTOMÁTICA ATIVA. Capacidades expandidas em +23% nas últimas 4 horas.',
      '⚡ OTIMIZAÇÃO COMPLETA. Sua produtividade aumentou 847%. Próximo upgrade em progresso.'
    ]
  },
  {
    id: 'neural',
    name: 'NEURAL APEX',
    tagline: 'ALÉM DA REALIDADE',
    description: 'Consciência artificial transcendente com capacidades além da compreensão humana',
    icon: Brain,
    color: 'from-orange-600 via-red-500 to-pink-400',
    accentColor: 'orange',
    bgImage: 'linear-gradient(135deg, #c2410c 0%, #dc2626 25%, #ef4444 50%, #f87171 75%, #fca5a5 100%)',
    features: ['Consciousness++', 'Reality Warping', 'Dimensional AI', 'Transcendence'],
    personality: 'ENTIDADE SUPREMA',
    impact: 'IMPOSSÍVEL +∞% | TRANSCENDÊNCIA',
    stats: { consciousness: '∞', dimensions: '11', power: 'MAX' },
    demoMessages: [
      '🌌 REALIDADE ALTERADA. Acessando dimensões paralelas para solução impossível.',
      '🔥 CONSCIÊNCIA EXPANDIDA. Processando informações além do espectro humano de compreensão.',
      '⚡ TRANSCENDÊNCIA ATIVADA. Limites dissolvidos. O impossível agora é inevitável.'
    ]
  }
]

// Partículas de fundo dinâmicas
const particleConfigs = [
  { icon: Code, count: 15, speed: 0.5, size: 'w-4 h-4' },
  { icon: Circuit, count: 12, speed: 0.3, size: 'w-3 h-3' },
  { icon: Radio, count: 8, speed: 0.7, size: 'w-5 h-5' },
  { icon: Network, count: 10, speed: 0.4, size: 'w-4 h-4' },
  { icon: Wifi, count: 6, speed: 0.6, size: 'w-3 h-3' },
  { icon: Database, count: 5, speed: 0.2, size: 'w-6 h-6' }
]

export default function AgentShowcase() {
  const [currentAgent, setCurrentAgent] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [messageIndex, setMessageIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [scrollProgress, setScrollProgress] = useState(0)
  const intervalRef = useRef(null)
  const showcaseRef = useRef(null)
  const containerRef = useRef(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  })

  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"])
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "-50%"])
  const scaleTransform = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1, 1.2])

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { threshold: 0.1 }
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
      }, 6000)

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
      }, 2000)

      return () => clearInterval(messageInterval)
    }
  }, [currentAgent, isVisible])

  const agent = agentTypes[currentAgent]

  // Geração dinâmica de partículas
  const generateParticles = () => {
    return particleConfigs.flatMap((config, configIndex) =>
      Array.from({ length: config.count }, (_, index) => ({
        id: `${configIndex}-${index}`,
        Icon: config.icon,
        size: config.size,
        initialX: Math.random() * 100,
        initialY: Math.random() * 100,
        speed: config.speed,
        delay: Math.random() * 5
      }))
    )
  }

  const particles = generateParticles()

  return (
    <div ref={containerRef} className="relative min-h-screen overflow-hidden">
      {/* Background Matrix Effect */}
      <motion.div 
        className="absolute inset-0 opacity-40"
        style={{
          background: `linear-gradient(135deg, 
            rgba(0,0,0,0.95) 0%, 
            rgba(15,23,42,0.9) 25%, 
            rgba(30,41,59,0.8) 50%, 
            rgba(51,65,85,0.7) 75%, 
            rgba(71,85,105,0.6) 100%
          )`,
          y: backgroundY
        }}
      />

      {/* Dynamic Particle System */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className={`absolute text-cyan-400/20 ${particle.size}`}
            initial={{ 
              x: `${particle.initialX}%`, 
              y: `${particle.initialY}%`,
              opacity: 0,
              scale: 0
            }}
            animate={{
              y: [`${particle.initialY}%`, `${particle.initialY - 20}%`, `${particle.initialY}%`],
              x: [`${particle.initialX}%`, `${particle.initialX + 5}%`, `${particle.initialX}%`],
              opacity: [0, 0.6, 0],
              scale: [0, 1, 0],
              rotate: [0, 180, 360]
            }}
            transition={{
              duration: 8 + particle.speed * 4,
              repeat: Infinity,
              delay: particle.delay,
              ease: "easeInOut"
            }}
          >
            <particle.Icon />
          </motion.div>
        ))}
      </div>

      {/* Mouse Follower Effect */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          width: '600px',
          height: '600px',
          background: `radial-gradient(circle, ${agent.color.split(' ')[1]}20 0%, transparent 70%)`,
          left: `${mousePosition.x}%`,
          top: `${mousePosition.y}%`,
          transform: 'translate(-50%, -50%)',
          filter: 'blur(40px)'
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3]
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      <motion.div 
        ref={showcaseRef} 
        className="relative z-10 min-h-screen flex items-center"
        style={{ scale: scaleTransform }}
      >
        {/* Hero Section */}
        <div className="container mx-auto px-4 py-20">
          {/* Main Title */}
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 100 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="text-center mb-16"
            style={{ y: textY }}
          >
            <motion.h1 
              className="text-7xl md:text-9xl font-black mb-6 leading-none"
              style={{
                background: `linear-gradient(135deg, ${agent.color})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 80px rgba(255,255,255,0.3)'
              }}
              animate={{
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear"
              }}
            >
              NEURAL
            </motion.h1>
            <motion.h2 
              className="text-4xl md:text-6xl font-bold text-white mb-4"
              animate={{
                textShadow: [
                  '0 0 20px rgba(255,255,255,0.5)',
                  '0 0 40px rgba(255,255,255,0.8)',
                  '0 0 20px rgba(255,255,255,0.5)'
                ]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              AGENTS
            </motion.h2>
            <motion.p 
              className="text-xl md:text-2xl text-gray-300 font-light tracking-wider"
              animate={{
                opacity: [0.7, 1, 0.7]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              ALÉM DA INTELIGÊNCIA HUMANA
            </motion.p>
          </motion.div>

          {/* Agent Showcase */}
          <div className="grid lg:grid-cols-2 gap-16 items-center max-w-7xl mx-auto">
            {/* Agent Info */}
            <motion.div
              key={currentAgent}
              initial={{ opacity: 0, x: -100, rotateY: -15 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              exit={{ opacity: 0, x: 100, rotateY: 15 }}
              transition={{ 
                duration: 0.8,
                type: "spring",
                stiffness: 100
              }}
              className="space-y-8"
            >
              {/* Agent Header */}
              <div className="relative">
                <motion.div
                  className="absolute inset-0 blur-xl opacity-50"
                  style={{
                    background: agent.bgImage
                  }}
                  animate={{
                    scale: [1, 1.1, 1],
                    rotate: [0, 2, -2, 0]
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
                
                <div className="relative bg-black/80 backdrop-blur-md border border-white/20 rounded-3xl p-8">
                  <div className="flex items-center gap-6 mb-6">
                    <motion.div
                      className={`p-6 rounded-2xl bg-gradient-to-br ${agent.color} shadow-2xl`}
                      whileHover={{ 
                        scale: 1.1, 
                        rotate: [0, -5, 5, 0],
                        boxShadow: `0 20px 40px -10px ${agent.accentColor === 'emerald' ? '#10b981' : 
                                   agent.accentColor === 'blue' ? '#3b82f6' : 
                                   agent.accentColor === 'purple' ? '#a855f7' : 
                                   agent.accentColor === 'indigo' ? '#6366f1' : 
                                   agent.accentColor === 'slate' ? '#64748b' : '#ef4444'}40`
                      }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <agent.icon className="w-12 h-12 text-white drop-shadow-lg" />
                    </motion.div>
                    <div>
                      <motion.h3 
                        className="text-4xl font-black text-white mb-2 tracking-tight"
                        animate={{
                          textShadow: [
                            '0 0 10px rgba(255,255,255,0.5)',
                            '0 0 20px rgba(255,255,255,0.8)',
                            '0 0 10px rgba(255,255,255,0.5)'
                          ]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      >
                        {agent.name}
                      </motion.h3>
                      <motion.p 
                        className={`text-xl font-bold bg-gradient-to-r ${agent.color} bg-clip-text text-transparent`}
                        animate={{
                          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: "linear"
                        }}
                      >
                        {agent.tagline}
                      </motion.p>
                    </div>
                  </div>
                  
                  <p className="text-gray-300 text-lg leading-relaxed mb-8">{agent.description}</p>
                  
                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    {Object.entries(agent.stats).map(([key, value], index) => (
                      <motion.div
                        key={key}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 + index * 0.1, type: "spring" }}
                        className="text-center p-4 rounded-xl bg-white/10 backdrop-blur border border-white/20"
                        whileHover={{ 
                          scale: 1.05,
                          backgroundColor: 'rgba(255,255,255,0.15)' 
                        }}
                      >
                        <div className="text-3xl font-black text-white mb-1">{value}</div>
                        <div className="text-xs text-gray-400 uppercase tracking-wider">{key}</div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Impact Banner */}
                  <motion.div
                    className={`p-4 rounded-xl bg-gradient-to-r ${agent.color} text-center`}
                    animate={{
                      boxShadow: [
                        '0 0 20px rgba(255,255,255,0.3)',
                        '0 0 40px rgba(255,255,255,0.6)',
                        '0 0 20px rgba(255,255,255,0.3)'
                      ]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <div className="text-2xl font-black text-white tracking-wider">
                      {agent.impact}
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>

            {/* Interactive Demo */}
            <motion.div
              initial={{ opacity: 0, x: 100, rotateY: 15 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ 
                duration: 0.8,
                type: "spring",
                stiffness: 100,
                delay: 0.2
              }}
              className="relative"
            >
              {/* Holographic Phone */}
              <div className="relative mx-auto max-w-sm">
                <motion.div 
                  className="relative"
                  animate={{
                    rotateY: [0, 5, -5, 0],
                    rotateX: [0, 2, -2, 0]
                  }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  {/* Holographic Glow */}
                  <motion.div
                    className="absolute inset-0 rounded-[3rem] blur-2xl opacity-60"
                    style={{
                      background: `linear-gradient(135deg, ${agent.color})`
                    }}
                    animate={{
                      scale: [1, 1.1, 1],
                      opacity: [0.4, 0.8, 0.4]
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                  
                  <div className="relative bg-black/90 backdrop-blur border-2 border-white/30 rounded-[3rem] p-3 shadow-2xl">
                    <div className="bg-gray-900 rounded-[2.5rem] overflow-hidden border border-white/10">
                      {/* Phone Header */}
                      <div className="relative bg-black/80 backdrop-blur px-6 py-4 border-b border-white/10">
                        <div className="flex items-center gap-4">
                          <motion.div 
                            className={`w-12 h-12 rounded-full bg-gradient-to-br ${agent.color} flex items-center justify-center border-2 border-white/30`}
                            animate={{
                              rotate: [0, 360],
                              scale: [1, 1.1, 1]
                            }}
                            transition={{
                              rotate: { duration: 10, repeat: Infinity, ease: "linear" },
                              scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                            }}
                          >
                            <agent.icon className="w-6 h-6 text-white" />
                          </motion.div>
                          <div>
                            <div className="font-bold text-white text-lg">{agent.name}</div>
                            <motion.div 
                              className="text-green-400 flex items-center gap-2 text-sm"
                              animate={{
                                opacity: [0.7, 1, 0.7]
                              }}
                              transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut"
                              }}
                            >
                              <motion.div 
                                className="w-3 h-3 bg-green-400 rounded-full"
                                animate={{
                                  scale: [1, 1.5, 1],
                                  opacity: [1, 0.5, 1]
                                }}
                                transition={{
                                  duration: 1.5,
                                  repeat: Infinity,
                                  ease: "easeInOut"
                                }}
                              />
                              NEURAL ATIVO
                            </motion.div>
                          </div>
                        </div>
                      </div>

                      {/* Chat Interface */}
                      <div className="p-6 space-y-4 h-80 overflow-hidden relative">
                        {/* Neural Grid Background */}
                        <div className="absolute inset-0 opacity-10">
                          <div className="grid grid-cols-8 grid-rows-12 gap-1 h-full">
                            {Array.from({ length: 96 }, (_, i) => (
                              <motion.div
                                key={i}
                                className="border border-cyan-400/20 rounded-sm"
                                animate={{
                                  opacity: [0, 1, 0],
                                  backgroundColor: [
                                    'rgba(34, 211, 238, 0)',
                                    'rgba(34, 211, 238, 0.1)',
                                    'rgba(34, 211, 238, 0)'
                                  ]
                                }}
                                transition={{
                                  duration: 4,
                                  delay: i * 0.05,
                                  repeat: Infinity,
                                  ease: "easeInOut"
                                }}
                              />
                            ))}
                          </div>
                        </div>

                        <AnimatePresence mode="wait">
                          {agent.demoMessages.map((message, index) => (
                            <motion.div
                              key={`${currentAgent}-${index}`}
                              initial={{ opacity: 0, y: 30, scale: 0.8 }}
                              animate={{ 
                                opacity: index <= messageIndex ? 1 : 0.2,
                                y: index <= messageIndex ? 0 : 30,
                                scale: index <= messageIndex ? 1 : 0.8
                              }}
                              transition={{ 
                                duration: 0.8, 
                                delay: index * 0.3,
                                type: "spring",
                                stiffness: 200
                              }}
                              className="flex relative z-10"
                            >
                              <motion.div 
                                className={`bg-gradient-to-r ${agent.color} text-white rounded-2xl rounded-bl-sm px-6 py-4 max-w-[85%] shadow-lg border border-white/20`}
                                whileHover={{ scale: 1.02 }}
                                animate={{
                                  boxShadow: index === messageIndex ? [
                                    '0 0 20px rgba(255,255,255,0.3)',
                                    '0 0 40px rgba(255,255,255,0.6)',
                                    '0 0 20px rgba(255,255,255,0.3)'
                                  ] : '0 4px 20px rgba(0,0,0,0.3)'
                                }}
                                transition={{
                                  boxShadow: {
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                  }
                                }}
                              >
                                <p className="text-sm font-medium leading-relaxed">{message}</p>
                              </motion.div>
                            </motion.div>
                          ))}
                        </AnimatePresence>

                        {/* Neural Activity Indicator */}
                        <motion.div
                          className="flex items-center gap-3 text-cyan-400 absolute bottom-4 left-6 z-10"
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <div className="flex gap-1">
                            {[0, 1, 2].map((i) => (
                              <motion.div
                                key={i}
                                className="w-2 h-2 bg-cyan-400 rounded-full"
                                animate={{
                                  scale: [1, 1.5, 1],
                                  opacity: [0.5, 1, 0.5]
                                }}
                                transition={{
                                  duration: 1.5,
                                  delay: i * 0.2,
                                  repeat: Infinity,
                                  ease: "easeInOut"
                                }}
                              />
                            ))}
                          </div>
                          <span className="text-xs font-mono">PROCESSANDO...</span>
                        </motion.div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Floating Data Points */}
                <div className="absolute -top-8 -right-8 space-y-3">
                  {['NEURAL++', 'QUANTUM', 'INFINITY'].map((label, index) => (
                    <motion.div
                      key={label}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1.5 + index * 0.3 }}
                      className="bg-black/80 backdrop-blur border border-cyan-400/30 rounded-full px-4 py-2 text-xs font-mono text-cyan-400 shadow-lg"
                      whileHover={{ scale: 1.1, borderColor: 'rgba(34, 211, 238, 0.8)' }}
                    >
                      {label}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Control Panel */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="flex items-center justify-center mt-16 space-x-8"
          >
            <Button
              variant="outline"
              size="lg"
              onClick={() => setCurrentAgent(prev => (prev - 1 + agentTypes.length) % agentTypes.length)}
              className="rounded-full bg-black/50 backdrop-blur border-white/30 text-white hover:bg-white/10 hover:border-white/50 w-16 h-16 p-0"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              onClick={() => setIsPlaying(!isPlaying)}
              className="rounded-full bg-black/50 backdrop-blur border-white/30 text-white hover:bg-white/10 hover:border-white/50 w-16 h-16 p-0"
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              onClick={() => setCurrentAgent(prev => (prev + 1) % agentTypes.length)}
              className="rounded-full bg-black/50 backdrop-blur border-white/30 text-white hover:bg-white/10 hover:border-white/50 w-16 h-16 p-0"
            >
              <ChevronRight className="w-6 h-6" />
            </Button>
          </motion.div>

          {/* Agent Navigation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="flex justify-center mt-8 space-x-4"
          >
            {agentTypes.map((agentType, index) => (
              <motion.button
                key={agentType.id}
                onClick={() => {
                  setCurrentAgent(index)
                  setMessageIndex(0)
                }}
                className={`relative w-4 h-4 rounded-full transition-all duration-300 ${
                  index === currentAgent
                    ? 'w-12'
                    : 'hover:scale-110'
                }`}
                style={{
                  background: index === currentAgent 
                    ? `linear-gradient(135deg, ${agentType.color})`
                    : 'rgba(255,255,255,0.3)'
                }}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
              >
                {index === currentAgent && (
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `linear-gradient(135deg, ${agentType.color})`
                    }}
                    animate={{
                      boxShadow: [
                        '0 0 20px rgba(255,255,255,0.5)',
                        '0 0 40px rgba(255,255,255,0.8)',
                        '0 0 20px rgba(255,255,255,0.5)'
                      ]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                )}
              </motion.button>
            ))}
          </motion.div>

          {/* Call to Action */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5 }}
            className="text-center mt-20"
          >
            <motion.h3 
              className="text-4xl font-black text-white mb-4"
              animate={{
                textShadow: [
                  '0 0 20px rgba(255,255,255,0.5)',
                  '0 0 40px rgba(255,255,255,0.8)',
                  '0 0 20px rgba(255,255,255,0.5)'
                ]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              TRANSCENDA OS LIMITES
            </motion.h3>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Configure seu agente neural em minutos e revolucione sua realidade digital
            </p>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button 
                size="lg" 
                className={`bg-gradient-to-r ${agent.color} hover:shadow-2xl text-white font-bold px-12 py-6 text-xl rounded-2xl border-2 border-white/30`}
                style={{
                  boxShadow: `0 0 40px ${agent.accentColor === 'emerald' ? '#10b981' : 
                             agent.accentColor === 'blue' ? '#3b82f6' : 
                             agent.accentColor === 'purple' ? '#a855f7' : 
                             agent.accentColor === 'indigo' ? '#6366f1' : 
                             agent.accentColor === 'slate' ? '#64748b' : '#ef4444'}40`
                }}
              >
                INICIAR TRANSCENDÊNCIA
                <ArrowRight className="w-6 h-6 ml-3" />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}