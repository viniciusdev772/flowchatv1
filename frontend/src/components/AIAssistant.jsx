import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PaperAirplaneIcon, 
  ChatBubbleLeftRightIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import MarkdownRenderer, { ToolResponseBlock } from './MarkdownRenderer';

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: 'Olá! Sou sua assistente de IA para o FlowChat API. Posso ajudar você a gerenciar sessões WhatsApp, enviar mensagens, configurar webhooks e muito mais. Como posso ajudar?',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/management/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          message: inputValue,
          conversation: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      setIsTyping(false);
      
      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
        toolCalls: result.toolCalls || []
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Erro ao conversar com a IA:', error);
      setIsTyping(false);
      
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Desculpe, ocorreu um erro: ${error.message}. Verifique se a chave da OpenAI está configurada corretamente.`,
        timestamp: new Date(),
        isError: true
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
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
      minute: '2-digit'
    }).format(timestamp);
  };

  const TypingIndicator = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center space-x-2 px-4 py-3"
    >
      <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
        <CpuChipIcon className="w-4 h-4 text-blue-600" />
      </div>
      <div className="bg-gray-100 rounded-2xl px-4 py-2">
        <div className="flex space-x-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 bg-gray-400 rounded-full"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );

  const MessageBubble = ({ message }) => {
    const isUser = message.role === 'user';
    const isError = message.isError;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={`flex items-start space-x-3 px-4 py-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
      >
        {/* Avatar */}
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
          isUser 
            ? 'bg-blue-600' 
            : isError 
              ? 'bg-red-100' 
              : 'bg-blue-100'
        }`}>
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
          <div className={`rounded-2xl px-4 py-2 ${
            isUser 
              ? 'bg-blue-600 text-white' 
              : isError 
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-gray-100 text-gray-800'
          }`}>
            {isUser ? (
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="text-sm">
                <MarkdownRenderer 
                  content={message.content} 
                  className={isError ? 'prose-red' : 'prose-gray'}
                />
              </div>
            )}
          </div>

          {/* Tool Calls Results */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.toolCalls.map((toolCall, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-blue-50 border border-blue-200 rounded-lg p-3"
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <Cog6ToothIcon className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-medium text-blue-800">{toolCall.tool}</span>
                    {toolCall.result?.success ? (
                      <CheckCircleIcon className="w-4 h-4 text-green-600" />
                    ) : (
                      <ExclamationTriangleIcon className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <p className="text-xs text-blue-700">
                    {toolCall.result?.message || toolCall.error || 'Executado'}
                  </p>
                  {toolCall.result && Object.keys(toolCall.result).length > 2 && (
                    <details className="mt-2">
                      <summary className="text-xs text-blue-600 cursor-pointer">Ver detalhes</summary>
                      <pre className="text-xs text-gray-600 mt-1 bg-white p-2 rounded overflow-x-auto">
                        {JSON.stringify(toolCall.result, null, 2)}
                      </pre>
                    </details>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {/* Timestamp */}
          <p className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : ''}`}>
            {formatTimestamp(message.timestamp)}
          </p>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col h-full max-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
            <ChatBubbleLeftRightIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Assistente de IA</h1>
            <p className="text-sm text-gray-500">FlowChat API Assistant</p>
          </div>
          {isLoading && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="ml-auto"
            >
              <ClockIcon className="w-5 h-5 text-blue-600" />
            </motion.div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto py-4">
        <AnimatePresence>
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {isTyping && <TypingIndicator />}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-gray-50 p-4">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
            className="w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-3 pr-12 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            rows="2"
            disabled={isLoading}
          />
          <motion.button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="absolute bottom-3 right-3 flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <PaperAirplaneIcon className="w-4 h-4" />
          </motion.button>
        </form>

        {/* Quick Actions */}
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            'Listar sessões ativas',
            'Criar nova sessão',
            'Verificar status do sistema',
            'Ajuda com webhooks'
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
      </div>
    </div>
  );
}