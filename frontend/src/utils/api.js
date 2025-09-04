
export const getApiUrl = () => {
  return window.APP_CONFIG?.API_URL ||
         import.meta.env.VITE_API_URL ||
         window.location.origin;
};


export const apiRequest = async (endpoint, options = {}) => {
  const apiUrl = getApiUrl();
  const url = `${apiUrl}${endpoint}`;

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


export const replaceApiUrl = (oldFetchCall) => {

  console.warn('Using legacy fetch call, consider migrating to apiRequest');
  return oldFetchCall.replace(/http:\/\/localhost:3000/g, getApiUrl());
};