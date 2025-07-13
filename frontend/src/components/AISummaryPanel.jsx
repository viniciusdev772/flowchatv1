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
  ArrowDownTrayIcon,
  UserGroupIcon,
  HashtagIcon
} from '@heroicons/react/24/outline';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

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
    style: 'bullet_points',
    focus: 'general',
    maxTokens: 2000,
    includeStats: true,
    includeTimestamps: false,
    includeParticipants: true,
    customPrompt: '',
    customApiKey: '',
    language: 'pt-BR',
    length: 'medium'
  });

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const toneOptions = [
    { value: 'professional', label: 'Profissional', description: 'Objetivo e focado em negócios', icon: '💼' },
    { value: 'casual', label: 'Casual', description: 'Amigável e descontraído', icon: '😊' },
    { value: 'analytical', label: 'Analítico', description: 'Detalhado com insights', icon: '📊' },
    { value: 'brief', label: 'Resumido', description: 'Apenas pontos principais', icon: '⚡' },
    { value: 'technical', label: 'Técnico', description: 'Foco em aspectos técnicos e dados', icon: '⚙️' },
    { value: 'creative', label: 'Criativo', description: 'Narrativo e envolvente', icon: '🎨' },
    { value: 'executive', label: 'Executivo', description: 'Para tomada de decisões', icon: '👔' },
    { value: 'humorous', label: 'Bem-humorado', description: 'Tom leve e divertido', icon: '😄' }
  ];

  const styleOptions = [
    { value: 'bullet_points', label: 'Tópicos', description: 'Lista organizada em bullet points', icon: '• ' },
    { value: 'narrative', label: 'Narrativo', description: 'Texto corrido e fluido', icon: '📖' },
    { value: 'report', label: 'Relatório', description: 'Formato de relatório estruturado', icon: '📋' },
    { value: 'timeline', label: 'Cronológico', description: 'Organizado por ordem temporal', icon: '⏰' },
    { value: 'categories', label: 'Por Categorias', description: 'Agrupado por temas', icon: '🗂️' },
    { value: 'q_and_a', label: 'Perguntas e Respostas', description: 'Formato FAQ', icon: '❓' }
  ];

  const focusOptions = [
    { value: 'general', label: 'Geral', description: 'Resumo completo da conversa', icon: '📝' },
    { value: 'decisions', label: 'Decisões', description: 'Foco em decisões tomadas', icon: '✅' },
    { value: 'problems', label: 'Problemas', description: 'Identificar questões e desafios', icon: '⚠️' },
    { value: 'actions', label: 'Ações', description: 'Tarefas e próximos passos', icon: '🎯' },
    { value: 'sentiment', label: 'Sentimentos', description: 'Análise emocional da conversa', icon: '💭' },
    { value: 'keywords', label: 'Palavras-chave', description: 'Termos e conceitos importantes', icon: '🔑' }
  ];

  useEffect(() => {
    loadSummaries();
    // Carregar API key do localStorage se disponível
    const savedApiKey = localStorage.getItem('openai_api_key');
    if (savedApiKey && !summaryConfig.customApiKey) {
      setSummaryConfig(prev => ({
        ...prev,
        customApiKey: savedApiKey
      }));
    }
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

    // Obter chave OpenAI do localStorage
    const openaiApiKey = localStorage.getItem('openai_api_key');
    if (!openaiApiKey) {
      alert('Chave OpenAI não configurada. Configure em AI Assistant > Configurações');
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
          customApiKey: openaiApiKey,
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

    // Obter chave OpenAI do localStorage
    const openaiApiKey = localStorage.getItem('openai_api_key');
    if (!openaiApiKey) {
      alert('Chave OpenAI não configurada. Configure em AI Assistant > Configurações');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch(`${apiUrl}/api/management/ai-summary/analyze-sentiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          collectorId,
          customApiKey: openaiApiKey
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

  // Função para analisar estatísticas das mensagens
  const analyzeMessageStats = (messages) => {
    const phoneStats = {};
    const hourStats = {};
    
    messages.forEach(msg => {
      // Estatísticas por número
      const phone = msg.phone || msg.from || 'Desconhecido';
      if (!phoneStats[phone]) {
        phoneStats[phone] = {
          count: 0,
          pushName: msg.pushName || 'Usuário',
          firstMessage: msg.timestamp,
          lastMessage: msg.timestamp
        };
      }
      phoneStats[phone].count++;
      phoneStats[phone].lastMessage = msg.timestamp;
      
      // Estatísticas por hora
      const hour = new Date(msg.timestamp).getHours();
      hourStats[hour] = (hourStats[hour] || 0) + 1;
    });
    
    // Ordenar usuários por quantidade de mensagens
    const topUsers = Object.entries(phoneStats)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 10);
    
    return { phoneStats, hourStats, topUsers };
  };

  const exportAsText = () => {
    if (!collectedMessages || collectedMessages.length === 0) {
      alert('Nenhuma mensagem para exportar');
      return;
    }

    const stats = analyzeMessageStats(collectedMessages);
    const sortedMessages = [...collectedMessages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    let content = `CONVERSA WHATSAPP - EXPORTAÇÃO\n`;
    content += `${'='.repeat(50)}\n\n`;
    content += `Data de Exportação: ${new Date().toLocaleString('pt-BR')}\n`;
    content += `Total de Mensagens: ${collectedMessages.length}\n`;
    content += `Período: ${new Date(sortedMessages[0]?.timestamp).toLocaleString('pt-BR')} até ${new Date(sortedMessages[sortedMessages.length - 1]?.timestamp).toLocaleString('pt-BR')}\n`;
    content += `Participantes: ${stats.topUsers.length}\n\n`;
    
    // Estatísticas de usuários
    content += `ESTATÍSTICAS DE PARTICIPANTES\n`;
    content += `${'-'.repeat(30)}\n\n`;
    content += `Top Participantes:\n`;
    stats.topUsers.forEach(([phone, data], index) => {
      content += `${index + 1}. ${data.pushName} (${phone.replace('@s.whatsapp.net', '')}) - ${data.count} mensagem${data.count > 1 ? 's' : ''}\n`;
    });
    
    content += `\nHorários Mais Ativos:\n`;
    Object.entries(stats.hourStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .forEach(([hour, count]) => {
        content += `${hour}h: ${count} mensagens\n`;
      });
    
    content += `\nMENSAGENS\n`;
    content += `${'-'.repeat(20)}\n\n`;
    
    sortedMessages.forEach((message, index) => {
      const time = new Date(message.timestamp).toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      const date = new Date(message.timestamp).toLocaleDateString('pt-BR');
      const phone = (message.phone || message.from || 'Desconhecido').replace('@s.whatsapp.net', '');
      const name = message.pushName || 'Usuário';
      
      content += `[${date} ${time}] ${name} (${phone})\n`;
      content += `${message.text || '[Mídia não disponível]'}\n`;
      content += `${'-'.repeat(50)}\n\n`;
    });
    
    content += `Exportado por FlowChat API em ${new Date().toLocaleString('pt-BR')}\n`;
    content += `Esta conversa foi coletada automaticamente.`;

    const blob = new Blob([content], { type: 'text/plain; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversa-whatsapp-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportConversation = () => {
    if (!collectedMessages || collectedMessages.length === 0) {
      alert('Nenhuma mensagem para exportar');
      return;
    }

    const stats = analyzeMessageStats(collectedMessages);
    const sortedMessages = [...collectedMessages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Criar HTML com CSS inline para melhor visualização
    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Conversa WhatsApp - ${new Date().toLocaleDateString('pt-BR')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6; 
            color: #333; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 20px;
            background: #f5f5f5;
        }
        .container { 
            background: white; 
            border-radius: 12px; 
            padding: 30px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { 
            color: #25D366; 
            border-bottom: 3px solid #25D366; 
            padding-bottom: 10px; 
            margin-bottom: 20px;
            display: flex;
            align-items: center;
        }
        h1::before {
            content: "💬";
            margin-right: 10px;
            font-size: 1.2em;
        }
        .info-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 15px; 
            margin-bottom: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .info-item { 
            display: flex; 
            flex-direction: column;
        }
        .info-label { 
            font-weight: 600; 
            color: #666; 
            font-size: 0.9em;
            margin-bottom: 5px;
        }
        .info-value { 
            font-weight: 500; 
            color: #333;
        }
        h2 { 
            color: #128C7E; 
            margin: 30px 0 15px 0; 
            display: flex;
            align-items: center;
        }
        .stats-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 20px; 
            margin-bottom: 30px;
        }
        .stat-card { 
            background: #f8f9fa; 
            padding: 20px; 
            border-radius: 8px; 
            border-left: 4px solid #25D366;
        }
        .stat-title { 
            font-weight: 600; 
            margin-bottom: 10px; 
            color: #333;
        }
        .stat-list { 
            list-style: none; 
        }
        .stat-list li { 
            padding: 5px 0; 
            display: flex; 
            justify-content: space-between;
            border-bottom: 1px solid #e9ecef;
        }
        .stat-list li:last-child { 
            border-bottom: none; 
        }
        .message { 
            margin: 15px 0; 
            padding: 15px; 
            background: #fff; 
            border-radius: 8px; 
            border-left: 4px solid #25D366;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .message-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            margin-bottom: 10px;
            font-size: 0.9em;
        }
        .message-author { 
            font-weight: 600; 
            color: #128C7E;
        }
        .message-time { 
            color: #666; 
            font-size: 0.8em;
        }
        .message-phone { 
            color: #999; 
            font-size: 0.8em;
        }
        .message-content { 
            color: #333; 
            white-space: pre-wrap; 
            word-wrap: break-word;
            background: #f8f9fa;
            padding: 10px;
            border-radius: 6px;
            margin-top: 8px;
        }
        .footer { 
            text-align: center; 
            margin-top: 40px; 
            padding-top: 20px; 
            border-top: 1px solid #e9ecef; 
            color: #666; 
            font-size: 0.9em;
        }
        @media (max-width: 600px) { 
            .container { padding: 20px; }
            .info-grid { grid-template-columns: 1fr; }
            .stats-grid { grid-template-columns: 1fr; }
        }
        @media print {
            body { background: white; }
            .container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Conversa WhatsApp</h1>
        
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">📅 Data de Exportação</div>
                <div class="info-value">${new Date().toLocaleString('pt-BR')}</div>
            </div>
            <div class="info-item">
                <div class="info-label">💬 Total de Mensagens</div>
                <div class="info-value">${collectedMessages.length}</div>
            </div>
            <div class="info-item">
                <div class="info-label">⏰ Período</div>
                <div class="info-value">${new Date(sortedMessages[0]?.timestamp).toLocaleString('pt-BR')} até ${new Date(sortedMessages[sortedMessages.length - 1]?.timestamp).toLocaleString('pt-BR')}</div>
            </div>
            <div class="info-item">
                <div class="info-label">👥 Participantes</div>
                <div class="info-value">${stats.topUsers.length}</div>
            </div>
        </div>

        <h2>📊 Estatísticas de Participantes</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-title">Top Participantes</div>
                <ul class="stat-list">
                    ${stats.topUsers.map(([phone, data], index) => `
                        <li>
                            <span><strong>${index + 1}.</strong> ${data.pushName}</span>
                            <span>${data.count} mensagem${data.count > 1 ? 's' : ''}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
            <div class="stat-card">
                <div class="stat-title">Horários Mais Ativos</div>
                <ul class="stat-list">
                    ${Object.entries(stats.hourStats)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 8)
                        .map(([hour, count]) => `
                            <li>
                                <span>${hour}h</span>
                                <span>${count} mensagens</span>
                            </li>
                        `).join('')}
                </ul>
            </div>
        </div>

        <h2>💬 Mensagens</h2>
        <div class="messages">
            ${sortedMessages.map((message, index) => {
                const time = new Date(message.timestamp).toLocaleTimeString('pt-BR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                const date = new Date(message.timestamp).toLocaleDateString('pt-BR');
                const phone = (message.phone || message.from || 'Desconhecido').replace('@s.whatsapp.net', '');
                const name = message.pushName || 'Usuário';
                
                return `
                    <div class="message">
                        <div class="message-header">
                            <div>
                                <span class="message-author">${name}</span>
                                <span class="message-phone">(${phone})</span>
                            </div>
                            <span class="message-time">${date} ${time}</span>
                        </div>
                        <div class="message-content">${message.text || '[Mídia não disponível]'}</div>
                    </div>
                `;
            }).join('')}
        </div>

        <div class="footer">
            <p>Exportado por <strong>FlowChat API</strong> • ${new Date().toLocaleString('pt-BR')}</p>
            <p>Esta conversa foi coletada automaticamente e formatada para visualização.</p>
        </div>
    </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversa-whatsapp-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportSummary = (summary) => {
    const content = `# Resumo de Mensagens WhatsApp\n\n**Data:** ${new Date(summary.createdAt).toLocaleString('pt-BR')}\n**Tom:** ${summary.tone || 'N/A'}\n**Total de Mensagens:** ${summary.totalMessages || 'N/A'}\n\n## Resumo\n\n${summary.summary}\n\n---\nGerado por FlowChat AI Assistant\n`;

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
      <div className="bg-white border border-gray-200 p-6 rounded-xl text-center">
        <div className="flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mx-auto mb-4">
          <SparklesIcon className="w-8 h-8 text-purple-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          Resumo com IA
        </h3>
        <p className="text-gray-600">
          Selecione um coletor com mensagens para gerar resumos inteligentes
        </p>
      </div>
    );
  }

  // Calcular estatísticas das mensagens
  const messageStats = collectedMessages ? analyzeMessageStats(collectedMessages) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-800 flex items-center">
            <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-full mr-3">
              <SparklesIcon className="w-4 h-4 text-purple-600" />
            </div>
            Resumo com IA
          </h3>
          <p className="text-gray-600 text-sm mt-1">
            {collectedMessages.length} mensagens coletadas
            {messageStats && ` • ${messageStats.topUsers.length} participantes`}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <motion.button
            onClick={exportConversation}
            className="flex items-center px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            title="Exportar como HTML (visual)"
          >
            <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
            HTML
          </motion.button>

          <motion.button
            onClick={exportAsText}
            className="flex items-center px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            title="Exportar como texto simples"
          >
            <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
            TXT
          </motion.button>
          
          <motion.button
            onClick={() => setShowConfigModal(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="Configurações"
          >
            <AdjustmentsHorizontalIcon className="w-5 h-5" />
          </motion.button>
        </div>
      </div>

      {/* Message Statistics */}
      {messageStats && (
        <div className="bg-white border border-gray-200 p-4 rounded-xl">
          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <div className="flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full mr-2">
              <HashtagIcon className="w-4 h-4 text-blue-600" />
            </div>
            Estatísticas das Mensagens
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h5 className="font-medium text-gray-700 mb-2 flex items-center">
                <UserGroupIcon className="w-4 h-4 mr-1" />
                Top Participantes
              </h5>
              <div className="space-y-1">
                {messageStats.topUsers.slice(0, 5).map(([phone, data], index) => (
                  <div key={phone} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 truncate">
                      {index + 1}. {data.pushName}
                    </span>
                    <span className="text-gray-500 ml-2">
                      {data.count} msg{data.count > 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h5 className="font-medium text-gray-700 mb-2 flex items-center">
                <ClockIcon className="w-4 h-4 mr-1" />
                Horários mais Ativos
              </h5>
              <div className="space-y-1">
                {Object.entries(messageStats.hourStats)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 5)
                  .map(([hour, count]) => (
                    <div key={hour} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{hour}h</span>
                      <span className="text-gray-500">{count} mensagens</span>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <motion.button
          onClick={() => generateSummary(false)}
          disabled={isGenerating}
          className="flex items-center justify-center p-4 bg-white border border-purple-200 rounded-xl hover:bg-purple-50 transition-colors disabled:opacity-50"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <SparklesIcon className="w-5 h-5 mr-2 text-purple-600" />
          <span className="text-gray-800 font-medium">
            {isGenerating ? 'Gerando...' : 'Resumir com IA'}
          </span>
        </motion.button>

        <motion.button
          onClick={() => generateSummary(true)}
          disabled={isGenerating}
          className="flex items-center justify-center p-4 bg-white border border-green-200 rounded-xl hover:bg-green-50 transition-colors disabled:opacity-50"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <PlayIcon className="w-5 h-5 mr-2 text-green-600" />
          <span className="text-gray-800 font-medium">
            Streaming Modo
          </span>
        </motion.button>

        <motion.button
          onClick={analyzeSentiment}
          disabled={isGenerating}
          className="flex items-center justify-center p-4 bg-white border border-yellow-200 rounded-xl hover:bg-yellow-50 transition-colors disabled:opacity-50"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <ChartBarIcon className="w-5 h-5 mr-2 text-yellow-600" />
          <span className="text-gray-800 font-medium">
            Análise Sentimento
          </span>
        </motion.button>
      </div>

      {/* Streaming Content */}
      {streamingContent && (
        <motion.div
          className="bg-white border border-gray-200 p-4 rounded-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center mb-3">
            <div className="flex items-center justify-center w-6 h-6 bg-green-100 rounded-full mr-2">
              <CpuChipIcon className="w-4 h-4 text-green-600 animate-pulse" />
            </div>
            <span className="text-gray-800 font-medium">Gerando Resumo...</span>
          </div>
          <div className="prose prose-gray max-w-none">
            <MarkdownRenderer content={streamingContent} />
          </div>
        </motion.div>
      )}

      {/* Previous Summaries */}
      {summaries.length > 0 && (
        <div className="bg-white border border-gray-200 p-4 rounded-xl">
          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <div className="flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full mr-2">
              <DocumentTextIcon className="w-4 h-4 text-blue-600" />
            </div>
            Resumos Anteriores ({summaries.length})
          </h4>

          <div className="space-y-3">
            {summaries.map((summary) => (
              <motion.div
                key={summary.id}
                className="bg-gray-50 border border-gray-200 p-4 rounded-lg hover:border-gray-300 hover:bg-gray-100 transition-colors"
                whileHover={{ scale: 1.01 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-gray-800 font-medium">
                        Tom: {summary.tone}
                      </span>
                      <span className="text-gray-600 text-sm">
                        {summary.totalMessages} mensagens
                      </span>
                      {summary.isStreamed && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                          Streaming
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm">
                      {new Date(summary.createdAt).toLocaleString('pt-BR')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <motion.button
                      onClick={() => viewSummary(summary.id)}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      title="Ver resumo"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </motion.button>

                    <motion.button
                      onClick={() => exportSummary(summary)}
                      className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      title="Exportar"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                    </motion.button>

                    <motion.button
                      onClick={() => deleteSummary(summary.id)}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowConfigModal(false)}
          >
            <motion.div
              className="bg-white p-6 rounded-2xl max-w-md w-full shadow-2xl border border-gray-200"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Configurações do Resumo
              </h3>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tom do Resumo
                    </label>
                    <select
                      value={summaryConfig.tone}
                      onChange={(e) => setSummaryConfig(prev => ({ ...prev, tone: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-200 focus:bg-white transition-colors"
                    >
                      {toneOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.icon} {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Estilo de Formatação
                    </label>
                    <select
                      value={summaryConfig.style}
                      onChange={(e) => setSummaryConfig(prev => ({ ...prev, style: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-200 focus:bg-white transition-colors"
                    >
                      {styleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.icon} {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Foco do Resumo
                  </label>
                  <select
                    value={summaryConfig.focus}
                    onChange={(e) => setSummaryConfig(prev => ({ ...prev, focus: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-200 focus:bg-white transition-colors"
                  >
                    {focusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.icon} {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Máximo de Tokens
                  </label>
                  <input
                    type="number"
                    min="500"
                    max="4000"
                    value={summaryConfig.maxTokens}
                    onChange={(e) => setSummaryConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-200 focus:bg-white transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={summaryConfig.includeStats}
                        onChange={(e) => setSummaryConfig(prev => ({ ...prev, includeStats: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-white"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Incluir estatísticas
                      </span>
                    </label>
                  </div>

                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={summaryConfig.includeTimestamps}
                        onChange={(e) => setSummaryConfig(prev => ({ ...prev, includeTimestamps: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-white"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Incluir horários
                      </span>
                    </label>
                  </div>

                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={summaryConfig.includeParticipants}
                        onChange={(e) => setSummaryConfig(prev => ({ ...prev, includeParticipants: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-white"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Incluir participantes
                      </span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tamanho do Resumo
                    </label>
                    <select
                      value={summaryConfig.length}
                      onChange={(e) => setSummaryConfig(prev => ({ ...prev, length: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-50 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-200 focus:bg-white transition-colors text-sm"
                    >
                      <option value="short">Curto</option>
                      <option value="medium">Médio</option>
                      <option value="long">Longo</option>
                      <option value="detailed">Detalhado</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prompt Personalizado (Opcional)
                  </label>
                  <textarea
                    value={summaryConfig.customPrompt}
                    onChange={(e) => setSummaryConfig(prev => ({ ...prev, customPrompt: e.target.value }))}
                    placeholder="Instruções específicas para o resumo..."
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-200 focus:bg-white transition-colors h-24 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Key OpenAI
                  </label>
                  <input
                    type="password"
                    value={summaryConfig.customApiKey}
                    onChange={(e) => {
                      setSummaryConfig(prev => ({ ...prev, customApiKey: e.target.value }));
                      // Salvar no localStorage também
                      localStorage.setItem('openai_api_key', e.target.value);
                    }}
                    placeholder="sk-..."
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-200 focus:bg-white transition-colors"
                  />
                  <p className="text-gray-500 text-xs mt-1">
                    {summaryConfig.customApiKey ? '✅ Chave carregada do localStorage' : 'Sincronizada com o Chat IA'}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <motion.button
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Salvar
                </motion.button>
                
                <motion.button
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Cancelar
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSummaryModal(false)}
          >
            <motion.div
              className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">
                    {selectedSummary.type === 'sentiment' ? 'Análise de Sentimento' : 'Resumo IA'}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {new Date(selectedSummary.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <motion.button
                    onClick={() => exportSummary(selectedSummary)}
                    className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    title="Exportar"
                  >
                    <ArrowDownTrayIcon className="w-5 h-5" />
                  </motion.button>
                  
                  <motion.button
                    onClick={() => setShowSummaryModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    ✕
                  </motion.button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                <div className="prose prose-gray max-w-none">
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