import {
  ClockIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  StopIcon,
} from '@heroicons/react/24/outline';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
// import { useSmartSuggestions } from '../hooks/useSmartSuggestions'; // DESABILITADO
import MarkdownRenderer, { ToolResponseBlock } from './MarkdownRenderer';

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
        'Olá! Sou sua assistente de IA para o FlowChat API. Posso ajudar você com gerenciamento de sessões WhatsApp, envio de mensagens, configuração de webhooks e muito mais. Como posso ajudar?',
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isThinking]);

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

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    const assistantMessageId = Date.now() + 1;
    setCurrentStreamingId(assistantMessageId);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const customApiKey = localStorage.getItem('openai_api_key');

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
          stream: true,
          customApiKey: customApiKey || undefined,
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
              // Atualizar mensagem sem trigger de re-render completo
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
        const errorMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: `Desculpe, ocorreu um erro: ${error.message}. Verifique se a chave da OpenAI está configurada corretamente.`,
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

  const ThinkingIndicator = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center space-x-2 px-4 py-3"
    >
      <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <CpuChipIcon className="w-4 h-4 text-blue-600" />
        </motion.div>
      </div>
      <div className="bg-gray-100 rounded-2xl px-4 py-2">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-blue-500 rounded-full"
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
          <span className="text-sm text-gray-600">Pensando...</span>
        </div>
      </div>
    </motion.div>
  );

  const ToolsProgressIndicator = () => {
    if (executingTools.size === 0 && toolsProgress.total === 0) return null;

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
                ? `Executando ${executingTools.size} ferramenta${
                    executingTools.size > 1 ? 's' : ''
                  }...`
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
        <div className={`max-w-xs lg:max-w-md ${isUser ? 'text-right' : ''}`}>
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

  return (
    <div className="flex flex-col h-full max-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
              <CpuChipIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                Assistente de IA
              </h1>
              <p className="text-sm text-gray-500">FlowChat API Assistant</p>
            </div>
          </div>

          {isStreaming && (
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <ClockIcon className="w-4 h-4 text-blue-600" />
                </motion.div>
                <span className="text-sm text-gray-600">Processando...</span>
              </div>
              <motion.button
                onClick={stopStreaming}
                className="flex items-center space-x-1 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <StopIcon className="w-4 h-4" />
                <span className="text-sm">Parar</span>
              </motion.button>
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto py-4">
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
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-gray-50">
        {/* SUGESTÕES INTELIGENTES DESABILITADAS */}

        <div className="p-4">
          <form onSubmit={handleSubmit} className="relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
              className="w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-3 pr-12 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              rows="2"
              disabled={isStreaming}
            />
            <motion.button
              type="submit"
              disabled={!inputValue.trim() || isStreaming}
              className="absolute bottom-3 right-3 flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
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

          {/* Quick Actions - Sempre visíveis */}
          {!isStreaming && (
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                'Listar todas as sessões ativas',
                'Criar uma nova sessão',
                'Verificar status do sistema',
                'Enviar mensagem de exemplo',
                'Configurar webhook',
                'Listar grupos',
                'Baixar mídia de um link e enviar',
              ].map((suggestion) => (
                <motion.button
                  key={suggestion}
                  onClick={() => setInputValue(suggestion)}
                  className="text-xs bg-white border border-gray-300 rounded-full px-3 py-1 text-gray-600 hover:bg-gray-50 transition-colors"
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
    </div>
  );
}
