
/**
 * @fileoverview This file contains helper functions for making API requests.
 * @module utils/api
 */

/**
 * Gets the API URL from the window config, environment variables, or the current origin.
 * @returns {string} The API URL.
 */
export const getApiUrl = () => {
  return window.APP_CONFIG?.API_URL ||
         import.meta.env.VITE_API_URL ||
         window.location.origin;
};

/**
 * Makes an API request.
 * @param {string} endpoint - The API endpoint.
 * @param {object} options - The options for the request.
 * @returns {Promise<Response>} The response from the API.
 */
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

/**
 * Replaces the API URL in a legacy fetch call.
 * @param {string} oldFetchCall - The old fetch call.
 * @returns {string} The new fetch call.
 * @deprecated
 */
export const replaceApiUrl = (oldFetchCall) => {

  console.warn('Using legacy fetch call, consider migrating to apiRequest');
  return oldFetchCall.replace(/http:\/\/localhost:3000/g, getApiUrl());
};