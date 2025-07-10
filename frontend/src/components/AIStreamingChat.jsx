import {
  ClockIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  StopIcon,
  DocumentTextIcon,
  ChatBubbleLeftEllipsisIcon,
} from '@heroicons/react/24/outline';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
// import { useSmartSuggestions } from '../hooks/useSmartSuggestions'; // DESABILITADO
import MarkdownRenderer, { ToolResponseBlock } from './MarkdownRenderer';
import MessageCollectorManager from './MessageCollectorManager';
import AISummaryPanel from './AISummaryPanel';

// Componente simplificado para renderizar mensagens (backend processa base64 automaticamente)
const MessageContentRenderer = ({ content }) => {
  return <MarkdownRenderer content={content} />;
};

export default function AIStreamingChat() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content:
        '👋 Olá! Sou sua assistente de IA para o **FlowChat API**.\n\n🚀 **Modo Streaming Ativo** - Respostas em tempo real com execução paralela de ferramentas!\n\nPosso ajudar você com:\n• 📱 Gerenciamento de sessões WhatsApp\n• 💬 Envio de mensagens e mídias\n• 👥 Administração de grupos\n• 🔗 Configuração de webhooks\n• 📊 Monitoramento do sistema\n\nComo posso ajudar?',
      timestamp: new Date(),
      isComplete: true,
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamingId, setCurrentStreamingId] = useState(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [streamingToolCalls, setStreamingToolCalls] = useState([]);
  const [executingTools, setExecutingTools] = useState(new Set());
  const [toolsProgress, setToolsProgress] = useState({
    completed: 0,
    total: 0,
  });
  const [downloadingMedia, setDownloadingMedia] = useState(new Set());
  const [downloadProgress, setDownloadProgress] = useState({});
  
  // Estado para as abas (chat IA e coletor de mensagens)
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' ou 'collector'
  const [selectedCollectorData, setSelectedCollectorData] = useState(null);

  // SUGESTÕES DESABILITADAS - Funcionalidade removida
  // const {
  //   smartSuggestions,
  //   isGeneratingSuggestions,
  //   generateSmartSuggestions,
  //   clearSuggestions,
  // } = useSmartSuggestions();

  // Mock para manter compatibilidade
  const smartSuggestions = [];
  const isGeneratingSuggestions = false;
  const generateSmartSuggestions = () => {};
  const clearSuggestions = () => {};

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const suggestionsGeneratedFor = useRef(null);
  const autoScrollIntervalRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToBottomInstant = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  };

  const scrollToBottomSmart = () => {
    // Durante streaming usa scroll instantâneo, senão usa smooth
    if (isStreaming) {
      scrollToBottomInstant();
    } else {
      scrollToBottom();
    }
  };

  useEffect(() => {
    scrollToBottomSmart();
  }, [messages.length, isThinking]);

  // Scroll automático durante streaming de conteúdo
  useEffect(() => {
    if (isStreaming && streamingContent) {
      scrollToBottomInstant();
    }
  }, [streamingContent, isStreaming]);

  // Scroll automático quando tools estão executando
  useEffect(() => {
    if (executingTools.size > 0 || downloadingMedia.size > 0) {
      scrollToBottom();
    }
  }, [executingTools.size, downloadingMedia.size]);

  // Scroll automático quando tool calls são atualizados
  useEffect(() => {
    if (streamingToolCalls.length > 0) {
      scrollToBottom();
    }
  }, [streamingToolCalls.length]);

  // Auto-scroll otimizado durante streaming
  useEffect(() => {
    if (isStreaming) {
      // Scroll automático a cada 200ms durante streaming (menos frequente)
      autoScrollIntervalRef.current = setInterval(() => {
        scrollToBottomInstant();
      }, 200);
    } else {
      // Limpar intervalo quando não está streaming
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
        autoScrollIntervalRef.current = null;
      }
    }

    // Cleanup no unmount
    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
      }
    };
  }, [isStreaming]);

  // SUGESTÕES DESABILITADAS - useEffect removido
  // useEffect(() => {
  //   const lastMessage = messages[messages.length - 1];
  //   if (
  //     lastMessage &&
  //     lastMessage.role === 'assistant' &&
  //     lastMessage.isComplete &&
  //     !isStreaming &&
  //     suggestionsGeneratedFor.current !== lastMessage.id
  //   ) {
  //     const timer = setTimeout(() => {
  //       suggestionsGeneratedFor.current = lastMessage.id;
  //       generateSmartSuggestions(messages);
  //     }, 1500);
  //     return () => clearTimeout(timer);
  //   }
  // }, [messages.length, isStreaming]);

  const stopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setIsThinking(false);
      setCurrentStreamingId(null);
      setStreamingContent('');
      setStreamingToolCalls([]);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isStreaming) return;

    // Resetar controles quando enviar nova mensagem
    suggestionsGeneratedFor.current = null;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
      isComplete: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsStreaming(true);
    setIsThinking(true);

    // Scroll imediato após enviar mensagem
    setTimeout(() => scrollToBottom(), 50);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    const assistantMessageId = Date.now() + 1;
    setCurrentStreamingId(assistantMessageId);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const customApiKey = localStorage.getItem('openai_api_key');

      // Validar se tem API key antes de enviar
      if (!customApiKey) {
        throw new Error('API_KEY_REQUIRED');
      }

      // Validar formato da API key
      if (!customApiKey.startsWith('sk-') || customApiKey.length < 48) {
        throw new Error('INVALID_API_KEY_FORMAT');
      }

      const response = await fetch(`${apiUrl}/api/management/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          message: inputValue,
          conversation: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          customApiKey: customApiKey,
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      // Create the streaming message placeholder
      const streamingMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isComplete: false,
        isStreaming: true,
        toolCalls: [],
      };

      setMessages((prev) => [...prev, streamingMessage]);
      setIsThinking(false);

      // Scroll quando mensagem streaming inicia
      setTimeout(() => scrollToBottom(), 50);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let toolResults = [];

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            if (data.type === 'content') {
              accumulatedContent += data.content;
              setStreamingContent(accumulatedContent);
              // Atualizar mensagem de forma otimizada
              setMessages((prev) => {
                const newMessages = [...prev];
                const msgIndex = newMessages.findIndex(
                  (msg) => msg.id === assistantMessageId
                );
                if (msgIndex !== -1) {
                  newMessages[msgIndex] = {
                    ...newMessages[msgIndex],
                    content: accumulatedContent,
                  };
                }
                return newMessages;
              });
            } else if (data.type === 'thinking') {
              setIsThinking(true);
              setTimeout(() => scrollToBottom(), 50);
            } else if (data.type === 'tool_start') {
              // Nova tool iniciando execução
              setExecutingTools((prev) => new Set(prev).add(data.tool));
              setToolsProgress((prev) => ({ ...prev, total: data.total }));
              setIsThinking(false);

              // Se for uma tool de download, adicionar ao estado de download
              if (
                data.tool === 'downloadFromUrl' ||
                data.tool === 'downloadAndSend'
              ) {
                setDownloadingMedia((prev) => new Set(prev).add(data.tool));
                setDownloadProgress((prev) => ({
                  ...prev,
                  [data.tool]: { status: 'iniciando', progress: 0 },
                }));
              }
              // Scroll quando nova tool inicia
              setTimeout(() => scrollToBottom(), 50);
            } else if (data.type === 'tool_result') {
              toolResults.push(data);
              setStreamingToolCalls((prev) => [...prev, data]);
              setExecutingTools((prev) => {
                const newSet = new Set(prev);
                newSet.delete(data.tool);
                return newSet;
              });
              setToolsProgress((prev) => ({
                ...prev,
                completed: prev.completed + 1,
              }));
              setIsThinking(false);
              // Scroll quando tool completa
              setTimeout(() => scrollToBottom(), 50);

              // Se for uma tool de download, remover do estado de download
              if (
                data.tool === 'downloadFromUrl' ||
                data.tool === 'downloadAndSend'
              ) {
                setDownloadingMedia((prev) => {
                  const newSet = new Set(prev);
                  newSet.delete(data.tool);
                  return newSet;
                });
                setDownloadProgress((prev) => {
                  const newProgress = { ...prev };
                  delete newProgress[data.tool];
                  return newProgress;
                });
              }
            } else if (data.type === 'tool_error') {
              toolResults.push(data);
              setStreamingToolCalls((prev) => [...prev, data]);
              setExecutingTools((prev) => {
                const newSet = new Set(prev);
                newSet.delete(data.tool);
                return newSet;
              });
              setToolsProgress((prev) => ({
                ...prev,
                completed: prev.completed + 1,
              }));
              setIsThinking(false);
              // Scroll quando tool tem erro
              setTimeout(() => scrollToBottom(), 50);

              // Se for uma tool de download, remover do estado de download
              if (
                data.tool === 'downloadFromUrl' ||
                data.tool === 'downloadAndSend'
              ) {
                setDownloadingMedia((prev) => {
                  const newSet = new Set(prev);
                  newSet.delete(data.tool);
                  return newSet;
                });
                setDownloadProgress((prev) => {
                  const newProgress = { ...prev };
                  delete newProgress[data.tool];
                  return newProgress;
                });
              }
            } else if (data.type === 'download_progress') {
              // Novo evento para progresso de download
              if (data.tool && downloadingMedia.has(data.tool)) {
                setDownloadProgress((prev) => ({
                  ...prev,
                  [data.tool]: {
                    status: data.status || 'baixando',
                    progress: data.progress || 0,
                    filename: data.filename,
                    size: data.size,
                  },
                }));
              }
            } else if (data.type === 'tools_completed') {
              // Todas as tools foram concluídas
              setExecutingTools(new Set());
              setToolsProgress({ completed: data.total, total: data.total });
              setIsThinking(false);
              setDownloadingMedia(new Set());
              setDownloadProgress({});
              // Scroll quando todas as tools completam
              setTimeout(() => scrollToBottom(), 100);

              // Verificar se getMessageHistory foi executado e adicionar contexto visual
              const hasGetMessageHistory = toolResults.some(
                (tr) => tr.tool === 'getMessageHistory'
              );
              if (hasGetMessageHistory) {
                console.log(
                  '🔍 getMessageHistory executado - IA deve continuar automaticamente'
                );
                // Adicionar feedback visual de que a IA deve continuar
                setIsThinking(true);
                setTimeout(() => setIsThinking(false), 2000); // Mostrar "pensando" por 2s
              }

              break;
            } else if (data.type === 'tools_error') {
              // Erro na execução paralela
              setExecutingTools(new Set());
              setIsThinking(false);
              console.error('Erro na execução de tools:', data.error);
            } else if (data.type === 'content_update') {
              // Backend processou imagens base64 e enviou conteúdo atualizado
              console.log('📸 Received content update with processed images');
              accumulatedContent = data.content;
              setStreamingContent(accumulatedContent);
              // Atualizar mensagem com conteúdo processado
              setMessages((prev) => {
                const newMessages = [...prev];
                const msgIndex = newMessages.findIndex(
                  (msg) => msg.id === assistantMessageId
                );
                if (msgIndex !== -1) {
                  newMessages[msgIndex] = {
                    ...newMessages[msgIndex],
                    content: accumulatedContent,
                  };
                }
                return newMessages;
              });
            } else if (data.type === 'done') {
              // Finalize the message
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        content: accumulatedContent,
                        isComplete: true,
                        isStreaming: false,
                        toolCalls: toolResults,
                      }
                    : msg
                )
              );
              setIsStreaming(false);
              setCurrentStreamingId(null);
              setStreamingContent('');
              setIsThinking(false);
              setStreamingToolCalls([]);
              setExecutingTools(new Set());
              setToolsProgress({ completed: 0, total: 0 });
              setDownloadingMedia(new Set());
              setDownloadProgress({});
              // Scroll final quando mensagem completa
              setTimeout(() => scrollToBottom(), 200);
              break;
            }
          } catch (e) {
            // Ignore invalid JSON lines
          }
        }
      }
    } catch (error) {
      console.error('Erro na conversa com IA:', error);

      if (error.name === 'AbortError') {
        // Request was aborted by user
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== assistantMessageId)
        );
      } else {
        let errorContent = `Desculpe, ocorreu um erro: ${error.message}`;
        
        if (error.message === 'API_KEY_REQUIRED') {
          errorContent = '🔑 **Chave OpenAI necessária!**\n\nPara usar o chat de IA, você precisa configurar sua chave OpenAI pessoal nas configurações.';
        } else if (error.message === 'INVALID_API_KEY_FORMAT') {
          errorContent = '🔑 **Formato de chave inválido!**\n\nA chave OpenAI deve começar com "sk-" e ter pelo menos 48 caracteres.';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          errorContent = '🔑 **Chave OpenAI inválida!**\n\nA chave fornecida não é válida. Verifique se copiou corretamente.';
        }

        const errorMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: errorContent,
          timestamp: new Date(),
          isError: true,
          isComplete: true,
        };

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId ? errorMessage : msg
          )
        );
      }
    } finally {
      setIsStreaming(false);
      setIsThinking(false);
      setCurrentStreamingId(null);
      setStreamingContent('');
      setStreamingToolCalls([]);
      setExecutingTools(new Set());
      setToolsProgress({ completed: 0, total: 0 });
      setDownloadingMedia(new Set());
      setDownloadProgress({});
      abortControllerRef.current = null;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(timestamp);
  };

  const ThinkingIndicator = () => {
    // Verificar se acabou de executar getMessageHistory
    const hasRecentGetHistory = streamingToolCalls.some(
      (tc) => tc.tool === 'getMessageHistory'
    );

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex items-center space-x-3 px-4 py-3"
      >
        <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <CpuChipIcon className="w-5 h-5 text-blue-600" />
          </motion.div>
        </div>
        <div className="bg-gradient-to-r from-gray-100 to-gray-50 rounded-2xl px-5 py-3 flex-1 max-w-md">
          <div className="flex items-center space-x-3">
            <div className="flex space-x-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2.5 h-2.5 bg-blue-500 rounded-full"
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </div>
            <span className="text-sm text-gray-700 font-medium">
              {hasRecentGetHistory
                ? '🧠 Analisando mensagens e decidindo próxima ação...'
                : '🤔 Pensando...'}
            </span>
          </div>
        </div>
      </motion.div>
    );
  };

  const ToolsProgressIndicator = () => {
    if (executingTools.size === 0 && toolsProgress.total === 0) return null;

    // Verificar se getMessageHistory está sendo executado
    const isExecutingGetHistory = executingTools.has('getMessageHistory');
    const hasCompletedGetHistory =
      toolsProgress.completed > 0 &&
      streamingToolCalls.some((tc) => tc.tool === 'getMessageHistory');

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex items-center space-x-2 px-4 py-3"
      >
        <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <SparklesIcon className="w-4 h-4 text-green-600" />
          </motion.div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-2">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              {Array.from(executingTools).map((tool, i) => (
                <motion.div
                  key={tool}
                  className="w-2 h-2 bg-green-500 rounded-full"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.7, 1, 0.7],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.3,
                  }}
                />
              ))}
            </div>
            <span className="text-sm text-green-700">
              {executingTools.size > 0
                ? isExecutingGetHistory
                  ? `🔍 Obtendo histórico de mensagens...`
                  : `Executando ${executingTools.size} ferramenta${
                      executingTools.size > 1 ? 's' : ''
                    }...`
                : hasCompletedGetHistory
                ? `✅ Histórico obtido - IA continuará automaticamente`
                : `${toolsProgress.completed}/${toolsProgress.total} ferramentas concluídas`}
            </span>
            {toolsProgress.total > 0 && (
              <div className="w-16 bg-green-200 rounded-full h-1.5 ml-2">
                <motion.div
                  className="bg-green-500 h-1.5 rounded-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${
                      (toolsProgress.completed / toolsProgress.total) * 100
                    }%`,
                  }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const ToolCallsDisplay = ({ toolCalls }) => {
    if (!toolCalls || toolCalls.length === 0) return null;

    return (
      <div className="mt-2 space-y-2">
        {toolCalls.map((toolCall, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ delay: index * 0.1 }}
          >
            <ToolResponseBlock
              toolName={toolCall.tool}
              result={toolCall.result?.message || toolCall.error || 'Executado'}
              success={toolCall.result?.success}
            />
            {toolCall.result && Object.keys(toolCall.result).length > 2 && (
              <details className="mt-2">
                <summary className="text-xs text-gray-600 cursor-pointer">
                  Ver detalhes técnicos
                </summary>
                <div className="mt-1 p-2 bg-gray-50 rounded text-xs">
                  <MarkdownRenderer
                    content={`\`\`\`json\n${JSON.stringify(
                      toolCall.result,
                      null,
                      2
                    )}\n\`\`\``}
                  />
                </div>
              </details>
            )}
          </motion.div>
        ))}
      </div>
    );
  };

  const MessageBubble = useCallback(({ message }) => {
    const isUser = message.role === 'user';
    const isError = message.isError;
    const isStreaming = message.isStreaming;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className={`flex items-start space-x-3 px-4 py-3 ${
          isUser ? 'flex-row-reverse space-x-reverse' : ''
        }`}
      >
        {/* Avatar */}
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full ${
            isUser ? 'bg-blue-600' : isError ? 'bg-red-100' : 'bg-blue-100'
          }`}
        >
          {isUser ? (
            <span className="text-white text-sm font-medium">U</span>
          ) : isError ? (
            <ExclamationTriangleIcon className="w-4 h-4 text-red-600" />
          ) : (
            <CpuChipIcon className="w-4 h-4 text-blue-600" />
          )}
        </div>

        {/* Message Content */}
        <div
          className={`max-w-sm lg:max-w-2xl xl:max-w-3xl ${
            isUser ? 'text-right' : ''
          }`}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className={`rounded-2xl px-4 py-2 ${
              isUser
                ? 'bg-blue-600 text-white'
                : isError
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            <div className="flex items-start">
              {isUser ? (
                <p className="text-sm whitespace-pre-wrap flex-1">
                  {message.content}
                </p>
              ) : (
                <div className="text-sm flex-1">
                  <MessageContentRenderer content={message.content} />
                </div>
              )}
              {isStreaming && (
                <motion.div
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="ml-1 mt-1 w-2 h-4 bg-blue-500 rounded-sm flex-shrink-0"
                />
              )}
            </div>
          </motion.div>

          {/* Tool Calls Results */}
          <ToolCallsDisplay toolCalls={message.toolCalls} />

          {/* Timestamp */}
          <p
            className={`text-xs text-gray-500 mt-1 ${
              isUser ? 'text-right' : ''
            }`}
          >
            {formatTimestamp(message.timestamp)}
          </p>
        </div>
      </motion.div>
    );
  }, []); // Memorizar o componente

  // Componente para mostrar progresso de download de mídia
  const MediaDownloadIndicator = () => {
    if (downloadingMedia.size === 0) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex items-center space-x-2 px-4 py-3"
      >
        <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-full">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <svg
              className="w-4 h-4 text-purple-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </motion.div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-2xl px-4 py-2 flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                {Array.from(downloadingMedia).map((tool, i) => (
                  <motion.div
                    key={tool}
                    className="w-2 h-2 bg-purple-500 rounded-full"
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.6, 1, 0.6],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </div>
              <span className="text-sm text-purple-700 font-medium">
                📥 Baixando mídia do servidor...
              </span>
            </div>
            {Object.keys(downloadProgress).length > 0 && (
              <div className="text-xs text-purple-600">
                {Object.entries(downloadProgress).map(([tool, progress]) => (
                  <div key={tool} className="flex items-center space-x-1">
                    {progress.filename && (
                      <span className="truncate max-w-24">
                        {progress.filename}
                      </span>
                    )}
                    {progress.size && <span>({progress.size})</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Barra de progresso visual */}
          <div className="mt-2 w-full bg-purple-200 rounded-full h-1">
            <motion.div
              className="bg-purple-500 h-1 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        </div>
      </motion.div>
    );
  };

  const tabs = [
    { id: 'chat', name: 'Chat IA', icon: ChatBubbleLeftEllipsisIcon },
    { id: 'collector', name: 'Coletor de Mensagens', icon: DocumentTextIcon },
  ];

  return (
    <div className="flex flex-col h-full bg-white min-h-0">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.name}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'chat' ? (
          <motion.div
            key="chat"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col h-full min-h-0"
          >
            {/* Header compacto */}
            {isStreaming && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <ClockIcon className="w-4 h-4 text-blue-600" />
              </motion.div>
              <span className="text-sm text-blue-700 font-medium">
                Processando resposta...
              </span>
            </div>
            <motion.button
              onClick={stopStreaming}
              className="flex items-center space-x-1 px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <StopIcon className="w-3 h-3" />
              <span>Parar</span>
            </motion.button>
          </div>
        </div>
      )}

      {/* Messages Area - Otimizado para tela cheia */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <div className="max-w-4xl mx-auto">
          <AnimatePresence>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isThinking && <ThinkingIndicator />}
            {downloadingMedia.size > 0 && <MediaDownloadIndicator />}
            {(executingTools.size > 0 || toolsProgress.total > 0) && (
              <ToolsProgressIndicator />
            )}
            {streamingToolCalls.length > 0 &&
              !isThinking &&
              executingTools.size === 0 &&
              downloadingMedia.size === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="px-4 py-2"
                >
                  <ToolCallsDisplay toolCalls={streamingToolCalls} />
                </motion.div>
              )}
          </AnimatePresence>
          <div ref={messagesEndRef} />

          {/* Indicador de scroll automático */}
          {isStreaming && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed bottom-20 right-4 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-medium shadow-lg border border-blue-200"
            >
              📜 Auto-scroll ativo
            </motion.div>
          )}
        </div>
      </div>

      {/* Input Area - Otimizada */}
      <div className="border-t border-gray-200 bg-white flex-shrink-0">
        <div className="max-w-4xl mx-auto p-4">
          <form onSubmit={handleSubmit} className="relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua mensagem para a IA... (Enter para enviar, Shift+Enter para nova linha)"
              className="w-full resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 pr-12 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 min-h-[48px] max-h-32"
              rows="1"
              disabled={isStreaming}
            />
            <motion.button
              type="submit"
              disabled={!inputValue.trim() || isStreaming}
              className="absolute bottom-2 right-2 flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
              whileHover={
                !isStreaming && inputValue.trim() ? { scale: 1.05 } : {}
              }
              whileTap={
                !isStreaming && inputValue.trim() ? { scale: 0.95 } : {}
              }
            >
              <PaperAirplaneIcon className="w-4 h-4" />
            </motion.button>
          </form>

          {/* Quick Actions - Compactas */}
          {!isStreaming && (
            <div className="mt-3 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {[
                'Listar sessões ativas',
                'Criar nova sessão',
                'Status do sistema',
                'Enviar mensagem teste',
                'Listar grupos',
                'Configurar webhook',
                'Histórico de mensagens',
                'Criar grupo',
                'Mencionar todos',
                'Marcar como lida',
                'obter histórico do grupo 120363403310858554@g.us',
                'enviar "Olá grupo!" para 120363403310858554@g.us',
              ].map((suggestion) => (
                <motion.button
                  key={suggestion}
                  onClick={() => setInputValue(suggestion)}
                  className={`text-xs border rounded-full px-2 py-1 transition-colors whitespace-nowrap ${
                    suggestion.includes('@g.us')
                      ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                      : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {suggestion}
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>
          </motion.div>
        ) : (
          <motion.div
            key="collector"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col h-full min-h-0 overflow-hidden"
          >
            <div className="flex-1 overflow-auto p-4">
              <div className="max-w-6xl mx-auto">
                <MessageCollectorManager />
                
                {/* Integração com o painel de resumo */}
                {selectedCollectorData && (
                  <div className="mt-6">
                    <AISummaryPanel
                      collectedMessages={selectedCollectorData.messages}
                      collectorId={selectedCollectorData.id}
                    />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
