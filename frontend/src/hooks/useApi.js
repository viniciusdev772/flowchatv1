import { getApiUrl } from '../utils/api';

// Hook para usar a API URL correta em qualquer componente
export const useApi = () => {
  const apiUrl = getApiUrl();
  
  // Função para construir URLs completas
  const buildUrl = (endpoint) => `${apiUrl}${endpoint}`;
  
  // Função fetch configurada
  const fetchApi = async (endpoint, options = {}) => {
    const url = buildUrl(endpoint);
    
    const defaultOptions = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };
    
    const finalOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };
    
    return fetch(url, finalOptions);
  };
  
  return {
    apiUrl,
    buildUrl,
    fetchApi
  };
};