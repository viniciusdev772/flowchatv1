import { getApiUrl } from '../utils/api';


export const useApi = () => {
  const apiUrl = getApiUrl();


  const buildUrl = (endpoint) => `${apiUrl}${endpoint}`;


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