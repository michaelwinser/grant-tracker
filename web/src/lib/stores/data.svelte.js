/**
 * Master data store that coordinates loading all entity stores.
 * Provides a single interface for loading/clearing all data.
 *
 * Simplified schema: only Grants store is active.
 * ActionItems, Reports, Artifacts, StatusHistory are deferred to future phases.
 */

import { grantsStore } from './grants.svelte.js';

// Reactive state
let isLoading = $state(false);
let error = $state(null);
let isLoaded = $state(false);

/**
 * Load all data from the spreadsheet.
 * @returns {Promise<void>}
 */
async function loadAll() {
  isLoading = true;
  error = null;

  try {
    await grantsStore.load();
    isLoaded = true;
  } catch (err) {
    error = err.message;
    throw err;
  } finally {
    isLoading = false;
  }
}

/**
 * Reload all data (e.g., after sync issues).
 * @returns {Promise<void>}
 */
async function reloadAll() {
  return loadAll();
}

/**
 * Clear all data from all stores.
 * Call on logout or spreadsheet switch.
 */
function clearAll() {
  grantsStore.clear();
  isLoaded = false;
  error = null;
}

/**
 * Clear errors from all stores.
 */
function clearAllErrors() {
  grantsStore.clearError();
  error = null;
}

// Export the store interface
export const dataStore = {
  // State getters (reactive)
  get isLoading() {
    return isLoading;
  },
  get error() {
    return error;
  },
  get isLoaded() {
    return isLoaded;
  },

  // Aggregated loading state
  get anyLoading() {
    return isLoading || grantsStore.isLoading;
  },

  // Aggregated error
  get anyError() {
    return error || grantsStore.error;
  },

  // Actions
  loadAll,
  reloadAll,
  clearAll,
  clearAllErrors,
};

// Re-export grants store for convenience
export { grantsStore } from './grants.svelte.js';
