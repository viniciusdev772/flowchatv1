import { getApiUrl } from '../utils/api';

/**
 * @fileoverview This file contains a custom hook for making API requests.
 * @module hooks/useApi
 */

/**
 * A custom hook for making API requests.
 * @returns {object} An object with helper functions for making API requests.
 */
export const useApi = () => {
  const apiUrl = getApiUrl();

  /**
   * Builds a URL for an API endpoint.
   * @param {string} endpoint - The API endpoint.
   * @returns {string} The full URL for the API endpoint.
   */
  const buildUrl = (endpoint) => `${apiUrl}${endpoint}`;

  /**
   * Makes an API request.
   * @param {string} endpoint - The API endpoint.
   * @param {object} options - The options for the request.
   * @returns {Promise<Response>} The response from the API.
   */
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