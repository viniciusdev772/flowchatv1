import {
  CheckCircleIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import AIStreamingChat from '../components/AIStreamingChat';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

export default function AIAssistantPage() {
  const [aiStatus, setAiStatus] = useState('checking');
  const [error, setError] = useState(null);

  useEffect(() => {
    checkAIHealth();
  }, []);

  const checkAIHealth = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const customApiKey = localStorage.getItem('openai_api_key');

      const headers = {
        'Content-Type': 'application/json',
      };

      if (customApiKey) {
        headers['x-custom-api-key'] = customApiKey;
      }

      const response = await fetch(`${apiUrl}/api/management/ai/health`, {
        credentials: 'include',
        headers,
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
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
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
            IA Online (Streaming Only)
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
                  Configure sua chave da OpenAI:
                </h3>
                <div className="mt-3">
                  <input
                    type="password"
                    placeholder="sk-..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const apiKey = e.target.value.trim();
                        if (apiKey) {
                          localStorage.setItem('openai_api_key', apiKey);
                          checkAIHealth();
                        }
                      }
                    }}
                  />
                  <p className="text-xs text-blue-600 mt-1">
                    Pressione Enter para salvar e testar
                  </p>
                </div>
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
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
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
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header - Compacto */}
      <div className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center"
              >
                <SparklesIcon className="w-4 h-4 text-white" />
              </motion.div>

              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  FlowChat AI Assistant
                </h1>
                <p className="text-xs text-gray-500">
                  Streaming only • Execução paralela • WhatsApp API completa
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <StatusBadge />

              {/* Dicas rápidas */}
              <div className="hidden lg:flex items-center space-x-2 text-xs text-gray-500">
                <span className="bg-gray-100 px-2 py-1 rounded">
                  📱 Sessões
                </span>
                <span className="bg-gray-100 px-2 py-1 rounded">
                  💬 Mensagens
                </span>
                <span className="bg-gray-100 px-2 py-1 rounded">👥 Grupos</span>
                <span className="bg-gray-100 px-2 py-1 rounded">
                  🔗 Webhooks
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Interface - Ocupa todo o espaço restante */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex-1 bg-white border-0 h-full min-h-0"
        >
          <AIStreamingChat />
        </motion.div>
      </div>
    </div>
  );
}
