/**
 * Spreadsheet selection state store using Svelte 5 runes.
 * Manages the selected Google Spreadsheet ID and metadata.
 */

import { configStore } from './config.svelte.js';

const STORAGE_KEY = 'grant-tracker-spreadsheet';

// Reactive state
let spreadsheetId = $state(null);
let spreadsheetName = $state(null);
let spreadsheetUrl = $state(null);
let isLoading = $state(false);
let error = $state(null);
let isValidated = $state(false);

// Derived state
const hasSpreadsheet = $derived(spreadsheetId !== null);
// Check both localStorage and server config for spreadsheet
const hasEffectiveSpreadsheet = $derived(spreadsheetId !== null || configStore.spreadsheetId !== null);
// Effective spreadsheet ID: prefer localStorage, fall back to server config
const effectiveSpreadsheetId = $derived(spreadsheetId || configStore.spreadsheetId);

/**
 * Initialize the store from localStorage.
 */
function initialize() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      spreadsheetId = data.id || null;
      spreadsheetName = data.name || null;
      spreadsheetUrl = data.url || null;
      // Validation will be done separately after auth
      isValidated = false;
    }
  } catch (err) {
    console.warn('Failed to load spreadsheet from localStorage:', err);
    clear();
  }
}

/**
 * Set the selected spreadsheet.
 * @param {Object} spreadsheet - Spreadsheet info
 * @param {string} spreadsheet.id - Spreadsheet ID
 * @param {string} spreadsheet.name - Spreadsheet name
 * @param {string} [spreadsheet.url] - Spreadsheet URL
 */
function setSpreadsheet(spreadsheet) {
  spreadsheetId = spreadsheet.id;
  spreadsheetName = spreadsheet.name;
  spreadsheetUrl = spreadsheet.url || `https://docs.google.com/spreadsheets/d/${spreadsheet.id}`;
  isValidated = false;
  error = null;

  // Persist to localStorage
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        id: spreadsheetId,
        name: spreadsheetName,
        url: spreadsheetUrl,
      })
    );
  } catch (err) {
    console.warn('Failed to save spreadsheet to localStorage:', err);
  }
}

/**
 * Mark the spreadsheet as validated (has correct schema).
 */
function markValidated() {
  isValidated = true;
}

/**
 * Clear the selected spreadsheet.
 */
function clear() {
  spreadsheetId = null;
  spreadsheetName = null;
  spreadsheetUrl = null;
  isValidated = false;
  error = null;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to remove spreadsheet from localStorage:', err);
  }
}

/**
 * Set loading state.
 * @param {boolean} loading
 */
function setLoading(loading) {
  isLoading = loading;
}

/**
 * Set error state.
 * @param {string|null} errorMessage
 */
function setError(errorMessage) {
  error = errorMessage;
}

/**
 * Clear error state.
 */
function clearError() {
  error = null;
}

// Export the store interface
export const spreadsheetStore = {
  // State getters (reactive)
  get spreadsheetId() {
    return spreadsheetId;
  },
  get spreadsheetName() {
    return spreadsheetName;
  },
  get spreadsheetUrl() {
    return spreadsheetUrl;
  },
  get isLoading() {
    return isLoading;
  },
  get error() {
    return error;
  },
  get hasSpreadsheet() {
    return hasSpreadsheet;
  },
  get hasEffectiveSpreadsheet() {
    return hasEffectiveSpreadsheet;
  },
  get effectiveSpreadsheetId() {
    return effectiveSpreadsheetId;
  },
  get isValidated() {
    return isValidated;
  },

  // Actions
  initialize,
  setSpreadsheet,
  markValidated,
  clear,
  setLoading,
  setError,
  clearError,
};
