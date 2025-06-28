import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AIStreamingChat from '../components/AIStreamingChat';
import { 
  SparklesIcon, 
  CpuChipIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

export default function AIAssistantPage() {
  const [aiStatus, setAiStatus] = useState('checking');
  const [error, setError] = useState(null);

  useEffect(() => {
    checkAIHealth();
  }, []);

  const checkAIHealth = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/management/ai/health`, {
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        setAiStatus(result.success ? 'healthy' : 'unhealthy');
        if (!result.success) {
          setError(result.message || 'IA não disponível');
        }
      } else {
        setAiStatus('unhealthy');
        setError('Erro ao conectar com a IA');
      }
    } catch (err) {
      setAiStatus('unhealthy');
      setError('Erro de conexão');
    }
  };

  const StatusBadge = () => {
    switch (aiStatus) {
      case 'checking':
        return (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800"
          >
            <CpuChipIcon className="w-4 h-4 mr-2" />
            Verificando...
          </motion.div>
        );
      case 'healthy':
        return (
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
            <CheckCircleIcon className="w-4 h-4 mr-2" />
            IA Online
          </div>
        );
      case 'unhealthy':
        return (
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 text-red-800">
            <ExclamationTriangleIcon className="w-4 h-4 mr-2" />
            IA Offline
          </div>
        );
      default:
        return null;
    }
  };

  if (aiStatus === 'unhealthy') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center"
        >
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ExclamationTriangleIcon className="w-8 h-8 text-red-600" />
          </div>
          
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Assistente de IA Indisponível
          </h2>
          
          <p className="text-gray-600 mb-6">
            {error || 'A assistente de IA não está disponível no momento.'}
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <div className="flex items-start">
              <InformationCircleIcon className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-blue-800 mb-1">
                  Para usar a assistente de IA:
                </h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Configure a variável OPENAI_API_KEY</li>
                  <li>• Reinicie o servidor backend</li>
                  <li>• Verifique sua conexão com a internet</li>
                </ul>
              </div>
            </div>
          </div>

          <motion.button
            onClick={checkAIHealth}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Tentar Novamente
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (aiStatus === 'checking') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <CpuChipIcon className="w-6 h-6 text-blue-600" />
          </motion.div>
          <p className="text-gray-600">Inicializando assistente de IA...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center"
              >
                <SparklesIcon className="w-5 h-5 text-white" />
              </motion.div>
              
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Assistente de IA
                </h1>
                <p className="text-sm text-gray-500">
                  Gerencie seu FlowChat API com inteligência artificial
                </p>
              </div>
            </div>

            <StatusBadge />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Info Panel */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Capacidades da IA
              </h3>
              
              <div className="space-y-4">
                {[
                  {
                    title: 'Gerenciar Sessões',
                    description: 'Criar, listar e deletar sessões WhatsApp',
                    icon: '📱'
                  },
                  {
                    title: 'Enviar Mensagens',
                    description: 'Enviar mensagens via WhatsApp',
                    icon: '💬'
                  },
                  {
                    title: 'Configurar Webhooks',
                    description: 'Configurar e gerenciar webhooks',
                    icon: '🔗'
                  },
                  {
                    title: 'Gerenciar Grupos',
                    description: 'Criar e administrar grupos',
                    icon: '👥'
                  },
                  {
                    title: 'QR Codes',
                    description: 'Gerar e obter QR codes',
                    icon: '📲'
                  },
                  {
                    title: 'Status do Sistema',
                    description: 'Monitorar e verificar status',
                    icon: '📊'
                  }
                ].map((capability, index) => (
                  <motion.div
                    key={capability.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="flex items-start space-x-3"
                  >
                    <span className="text-2xl">{capability.icon}</span>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">
                        {capability.title}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {capability.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700">
                  💡 <strong>Dica:</strong> Você pode pedir para a IA fazer qualquer 
                  operação relacionada ao WhatsApp API. Ela executará as ações 
                  reais no sistema!
                </p>
              </div>
            </motion.div>
          </div>

          {/* Chat Interface */}
          <div className="lg:col-span-3">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 h-[600px]"
            >
              <AIStreamingChat />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}