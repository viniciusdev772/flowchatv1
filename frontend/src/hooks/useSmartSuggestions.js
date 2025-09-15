import { useCallback, useRef, useState } from 'react';

/**
 * @fileoverview This file contains a custom hook for generating smart suggestions.
 * @module hooks/useSmartSuggestions
 */

/**
 * A custom hook for generating smart suggestions for the AI assistant.
 * @returns {object} An object with the smart suggestions and functions to generate and clear them.
 */
export const useSmartSuggestions = () => {
  const [smartSuggestions, setSmartSuggestions] = useState([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const lastProcessedMessageId = useRef(null);

  /**
   * Generates smart suggestions based on the conversation history.
   * @param {Array<object>} messages - The conversation history.
   * @returns {Promise<void>}
   */
  const generateSmartSuggestions = useCallback(
    async (messages) => {
      if (isGeneratingSuggestions || messages.length < 2) return;

      const lastMessage = messages[messages.length - 1];


      if (lastMessage.id === lastProcessedMessageId.current) {
        return;
      }

      setIsGeneratingSuggestions(true);
      lastProcessedMessageId.current = lastMessage.id;

      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const response = await fetch(
          `${apiUrl}/api/management/ai/suggestions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              conversation: messages.slice(-6).map((msg) => ({
                role: msg.role,
                content: msg.content,
              })),
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          setSmartSuggestions(data.suggestions || []);
        } else {

          setSmartSuggestions([
            'Listar todas as sessões ativas',
            'Criar uma nova sessão',
            'Verificar status do sistema',
            'Como configurar webhooks?',
          ]);
        }
      } catch (error) {
        console.error('Erro ao gerar sugestões:', error);

        setSmartSuggestions([
          'Listar todas as sessões ativas',
          'Criar uma nova sessão',
          'Verificar status do sistema',
          'Como configurar webhooks?',
        ]);
      } finally {
        setIsGeneratingSuggestions(false);
      }
    },
    [isGeneratingSuggestions]
  );

  /**
   * Clears the smart suggestions.
   * @returns {void}
   */
  const clearSuggestions = useCallback(() => {
    setSmartSuggestions([]);
    lastProcessedMessageId.current = null;
  }, []);

  return {
    smartSuggestions,
    isGeneratingSuggestions,
    generateSmartSuggestions,
    clearSuggestions,
  };
};
