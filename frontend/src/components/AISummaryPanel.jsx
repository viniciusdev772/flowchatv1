import {
  SparklesIcon,
  DocumentTextIcon,
  ClockIcon,
  CpuChipIcon,
  ChartBarIcon,
  AdjustmentsHorizontalIcon,
  PlayIcon,
  StopIcon,
  EyeIcon,
  TrashIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

export default function AISummaryPanel({ collectedMessages, collectorId }) {
  const [summaries, setSummaries] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  
  // Summary configuration
  const [summaryConfig, setSummaryConfig] = useState({
    tone: 'professional',
    maxTokens: 2000,
    includeStats: true,
    customPrompt: '',
    customApiKey: ''
  });

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const toneOptions = [
    { value: 'professional', label: 'Profissional', description: 'Objetivo e focado em negócios' },
    { value: 'casual', label: 'Casual', description: 'Amigável e descontraído' },
    { value: 'analytical', label: 'Analítico', description: 'Detalhado com insights' },
    { value: 'brief', label: 'Resumido', description: 'Apenas pontos principais' }
  ];

  useEffect(() => {
    loadSummaries();
  }, [collectorId]);

  const loadSummaries = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/management/ai-summary/list`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSummaries(data.summaries.filter(s => s.collectorId === collectorId));
        }
      }
    } catch (error) {
      console.error('Erro ao carregar resumos:', error);
    }
  };

  const generateSummary = async (useStreaming = false) => {
    if (!collectorId) {
      alert('Nenhum coletor selecionado');
      return;
    }

    setIsGenerating(true);
    setStreamingContent('');

    try {
      const headers = {
        'Content-Type': 'application/json'
      };

      if (useStreaming) {
        headers['Accept'] = 'text/stream';
      }

      const response = await fetch(`${apiUrl}/api/management/ai-summary/summarize`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          collectorId,
          ...summaryConfig
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao gerar resumo');
      }

      if (useStreaming) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'content') {
                  setStreamingContent(prev => prev + data.content);
                } else if (data.type === 'complete') {
                  // Streaming concluído
                  break;
                }
              } catch (e) {
                console.warn('Erro ao parsear chunk:', e);
              }
            }
          }
        }
      } else {
        const data = await response.json();
        if (data.success) {
          setSelectedSummary({
            summary: data.summary,
            stats: data.stats,
            createdAt: new Date(),
            tone: summaryConfig.tone
          });
          setShowSummaryModal(true);
        }
      }

      await loadSummaries(); // Recarregar lista
    } catch (error) {
      console.error('Erro ao gerar resumo:', error);
      alert(`Erro: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const viewSummary = async (summaryId) => {
    try {
      const response = await fetch(`${apiUrl}/api/management/ai-summary/${summaryId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSelectedSummary(data.summary);
          setShowSummaryModal(true);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar resumo:', error);
    }
  };

  const deleteSummary = async (summaryId) => {
    if (!confirm('Tem certeza que deseja deletar este resumo?')) return;

    try {
      const response = await fetch(`${apiUrl}/api/management/ai-summary/${summaryId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        loadSummaries();
      }
    } catch (error) {
      console.error('Erro ao deletar resumo:', error);
    }
  };

  const analyzeSentiment = async () => {
    if (!collectorId) return;

    setIsGenerating(true);
    try {
      const response = await fetch(`${apiUrl}/api/management/ai-summary/analyze-sentiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          collectorId,
          customApiKey: summaryConfig.customApiKey 
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSelectedSummary({
            summary: data.analysis,
            type: 'sentiment',
            totalAnalyzed: data.totalAnalyzed,
            createdAt: new Date()
          });
          setShowSummaryModal(true);
        }
      }
    } catch (error) {
      console.error('Erro na análise de sentimento:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const exportSummary = (summary) => {
    const content = `# Resumo de Mensagens WhatsApp

**Data:** ${new Date(summary.createdAt).toLocaleString('pt-BR')}
**Tom:** ${summary.tone || 'N/A'}
**Total de Mensagens:** ${summary.totalMessages || 'N/A'}

## Resumo

${summary.summary}

---
Gerado por FlowChat AI Assistant
`;

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resumo-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!collectedMessages || collectedMessages.length === 0) {
    return (
      <div className="glass-performance p-6 rounded-xl text-center">
        <SparklesIcon className="w-16 h-16 text-white/30 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">
          Resumo com IA
        </h3>
        <p className="text-white/70">
          Selecione um coletor com mensagens para gerar resumos inteligentes
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center">
            <SparklesIcon className="w-6 h-6 mr-2 text-purple-400" />
            Resumo com IA
          </h3>
          <p className="text-white/70 text-sm">
            {collectedMessages.length} mensagens coletadas
          </p>
        </div>

        <motion.button
          onClick={() => setShowConfigModal(true)}
          className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="Configurações"
        >
          <AdjustmentsHorizontalIcon className="w-5 h-5" />
        </motion.button>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <motion.button
          onClick={() => generateSummary(false)}
          disabled={isGenerating}
          className="flex items-center justify-center p-4 glass-performance rounded-xl hover:bg-purple-500/20 transition-colors disabled:opacity-50"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <SparklesIcon className="w-5 h-5 mr-2 text-purple-400" />
          <span className="text-white font-medium">
            {isGenerating ? 'Gerando...' : 'Resumir com IA'}
          </span>
        </motion.button>

        <motion.button
          onClick={() => generateSummary(true)}
          disabled={isGenerating}
          className="flex items-center justify-center p-4 glass-performance rounded-xl hover:bg-green-500/20 transition-colors disabled:opacity-50"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <PlayIcon className="w-5 h-5 mr-2 text-green-400" />
          <span className="text-white font-medium">
            Streaming Modo
          </span>
        </motion.button>

        <motion.button
          onClick={analyzeSentiment}
          disabled={isGenerating}
          className="flex items-center justify-center p-4 glass-performance rounded-xl hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <ChartBarIcon className="w-5 h-5 mr-2 text-yellow-400" />
          <span className="text-white font-medium">
            Análise Sentimento
          </span>
        </motion.button>
      </div>

      {/* Streaming Content */}
      {streamingContent && (
        <motion.div
          className="glass-performance p-4 rounded-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center mb-3">
            <CpuChipIcon className="w-5 h-5 mr-2 text-green-400 animate-pulse" />
            <span className="text-white font-medium">Gerando Resumo...</span>
          </div>
          <div className="prose prose-invert max-w-none">
            <MarkdownRenderer content={streamingContent} />
          </div>
        </motion.div>
      )}

      {/* Previous Summaries */}
      {summaries.length > 0 && (
        <div className="glass-performance p-4 rounded-xl">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
            <DocumentTextIcon className="w-5 h-5 mr-2 text-blue-400" />
            Resumos Anteriores ({summaries.length})
          </h4>

          <div className="space-y-3">
            {summaries.map((summary) => (
              <motion.div
                key={summary.id}
                className="glass-performance p-4 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
                whileHover={{ scale: 1.01 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-white font-medium">
                        Tom: {summary.tone}
                      </span>
                      <span className="text-white/70 text-sm">
                        {summary.totalMessages} mensagens
                      </span>
                      {summary.isStreamed && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
                          Streaming
                        </span>
                      )}
                    </div>
                    <p className="text-white/70 text-sm">
                      {new Date(summary.createdAt).toLocaleString('pt-BR')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <motion.button
                      onClick={() => viewSummary(summary.id)}
                      className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      title="Ver resumo"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </motion.button>

                    <motion.button
                      onClick={() => exportSummary(summary)}
                      className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      title="Exportar"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                    </motion.button>

                    <motion.button
                      onClick={() => deleteSummary(summary.id)}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      title="Deletar"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Configuration Modal */}
      <AnimatePresence>
        {showConfigModal && (
          <motion.div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowConfigModal(false)}
          >
            <motion.div
              className="glass-performance p-6 rounded-xl max-w-md w-full mx-4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-4">
                Configurações do Resumo
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Tom do Resumo
                  </label>
                  <select
                    value={summaryConfig.tone}
                    onChange={(e) => setSummaryConfig(prev => ({ ...prev, tone: e.target.value }))}
                    className="w-full px-4 py-3 glass-performance rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none border border-white/10"
                  >
                    {toneOptions.map((option) => (
                      <option key={option.value} value={option.value} className="bg-gray-800">
                        {option.label} - {option.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Máximo de Tokens
                  </label>
                  <input
                    type="number"
                    min="500"
                    max="4000"
                    value={summaryConfig.maxTokens}
                    onChange={(e) => setSummaryConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                    className="w-full px-4 py-3 glass-performance rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none border border-white/10"
                  />
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={summaryConfig.includeStats}
                      onChange={(e) => setSummaryConfig(prev => ({ ...prev, includeStats: e.target.checked }))}
                      className="rounded border-white/30 text-blue-400 focus:ring-blue-500 bg-white/10"
                    />
                    <span className="ml-2 text-sm text-white/90">
                      Incluir estatísticas
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Prompt Personalizado (Opcional)
                  </label>
                  <textarea
                    value={summaryConfig.customPrompt}
                    onChange={(e) => setSummaryConfig(prev => ({ ...prev, customPrompt: e.target.value }))}
                    placeholder="Instruções específicas para o resumo..."
                    className="w-full px-4 py-3 glass-performance rounded-xl text-white placeholder-white/50 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-white/10 h-24 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    API Key OpenAI (Opcional)
                  </label>
                  <input
                    type="password"
                    value={summaryConfig.customApiKey}
                    onChange={(e) => setSummaryConfig(prev => ({ ...prev, customApiKey: e.target.value }))}
                    placeholder="sk-..."
                    className="w-full px-4 py-3 glass-performance rounded-xl text-white placeholder-white/50 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-white/10"
                  />
                  <p className="text-white/50 text-xs mt-1">
                    Deixe vazio para usar a chave do servidor
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <motion.button
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 py-3 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Salvar
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Modal */}
      <AnimatePresence>
        {showSummaryModal && selectedSummary && (
          <motion.div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSummaryModal(false)}
          >
            <motion.div
              className="glass-performance rounded-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {selectedSummary.type === 'sentiment' ? 'Análise de Sentimento' : 'Resumo IA'}
                  </h3>
                  <p className="text-white/70 text-sm">
                    {new Date(selectedSummary.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <motion.button
                    onClick={() => exportSummary(selectedSummary)}
                    className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    title="Exportar"
                  >
                    <ArrowDownTrayIcon className="w-5 h-5" />
                  </motion.button>
                  
                  <motion.button
                    onClick={() => setShowSummaryModal(false)}
                    className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    ✕
                  </motion.button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="prose prose-invert max-w-none">
                  <MarkdownRenderer content={selectedSummary.summary} />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}