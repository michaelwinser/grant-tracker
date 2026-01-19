/**
 * Master data store that coordinates loading all entity stores.
 * Provides a single interface for loading/clearing all data.
 */

import { grantsStore } from './grants.svelte.js';
import { actionItemsStore } from './actionItems.svelte.js';
import { reportsStore } from './reports.svelte.js';
import { artifactsStore } from './artifacts.svelte.js';
import { configStore } from './config.svelte.js';
import { statusHistoryStore } from './statusHistory.svelte.js';

// Reactive state
let isLoading = $state(false);
let error = $state(null);
let isLoaded = $state(false);

/**
 * Load all data from the spreadsheet.
 * Loads config first (for team validation), then other stores in parallel.
 * @returns {Promise<void>}
 */
async function loadAll() {
  isLoading = true;
  error = null;

  try {
    // Load config first (needed for team member validation)
    await configStore.load();

    // Load remaining stores in parallel
    await Promise.all([
      grantsStore.load(),
      actionItemsStore.load(),
      reportsStore.load(),
      artifactsStore.load(),
      statusHistoryStore.load(),
    ]);

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
  actionItemsStore.clear();
  reportsStore.clear();
  artifactsStore.clear();
  configStore.clear();
  statusHistoryStore.clear();
  isLoaded = false;
  error = null;
}

/**
 * Clear errors from all stores.
 */
function clearAllErrors() {
  grantsStore.clearError();
  actionItemsStore.clearError();
  reportsStore.clearError();
  artifactsStore.clearError();
  configStore.clearError();
  statusHistoryStore.clearError();
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

  // Aggregated loading state from all stores
  get anyLoading() {
    return (
      isLoading ||
      grantsStore.isLoading ||
      actionItemsStore.isLoading ||
      reportsStore.isLoading ||
      artifactsStore.isLoading ||
      configStore.isLoading ||
      statusHistoryStore.isLoading
    );
  },

  // Aggregated error from all stores
  get anyError() {
    return (
      error ||
      grantsStore.error ||
      actionItemsStore.error ||
      reportsStore.error ||
      artifactsStore.error ||
      configStore.error ||
      statusHistoryStore.error
    );
  },

  // Actions
  loadAll,
  reloadAll,
  clearAll,
  clearAllErrors,
};

// Re-export individual stores for convenience
export { grantsStore } from './grants.svelte.js';
export { actionItemsStore } from './actionItems.svelte.js';
export { reportsStore } from './reports.svelte.js';
export { artifactsStore } from './artifacts.svelte.js';
export { configStore } from './config.svelte.js';
export { statusHistoryStore } from './statusHistory.svelte.js';
