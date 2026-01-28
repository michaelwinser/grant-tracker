/**
 * Status History store using Svelte 5 runes.
 * Tracks status changes for grants.
 */

import { createUnifiedSheetsClient, isUsingBackendApi } from '../api/sheets-unified.js';
import { userStore } from './user.svelte.js';
import { spreadsheetStore } from './spreadsheet.svelte.js';
import { configStore } from './config.svelte.js';
import { normalizeRow, nowTimestamp, generateId } from '../models.js';

// Reactive state
let history = $state([]);
let isLoading = $state(false);
let error = $state(null);

/**
 * Get a sheets client instance.
 * Uses backend API when service account is enabled, otherwise direct Google API.
 * @returns {Object}
 */
function getClient() {
  // When using backend API, we don't need spreadsheetId from user selection
  if (isUsingBackendApi()) {
    if (!userStore.accessToken) {
      throw new Error('Not authenticated');
    }
    return createUnifiedSheetsClient(userStore.accessToken, configStore.spreadsheetId);
  }

  // Direct API mode - need user-selected spreadsheet
  if (!userStore.accessToken || !spreadsheetStore.spreadsheetId) {
    throw new Error('Not authenticated or no spreadsheet selected');
  }
  return createUnifiedSheetsClient(userStore.accessToken, spreadsheetStore.spreadsheetId);
}

/**
 * Load all status history from the spreadsheet.
 * @returns {Promise<void>}
 */
async function load() {
  isLoading = true;
  error = null;

  try {
    const client = getClient();
    const rows = await client.readSheet('StatusHistory');
    history = rows
      .map((row) => normalizeRow(row))
      .filter((row) => row.history_id);
  } catch (err) {
    error = err.message;
    throw err;
  } finally {
    isLoading = false;
  }
}

/**
 * Record a status change.
 * @param {Object} params
 * @param {string} params.grantId - Grant ID
 * @param {string} params.fromStatus - Previous status
 * @param {string} params.toStatus - New status
 * @param {string} [params.notes] - Optional notes
 * @returns {Promise<Object>} - The created history entry
 */
async function recordChange({ grantId, fromStatus, toStatus, notes = '' }) {
  const now = nowTimestamp();
  const newEntry = {
    history_id: generateId('SH'),
    grant_id: grantId,
    from_status: fromStatus,
    to_status: toStatus,
    changed_by: userStore.user?.email || userStore.user?.name || 'Unknown',
    changed_at: now,
    notes,
  };

  // Optimistic update
  const previousHistory = [...history];
  history = [newEntry, ...history];

  try {
    const client = getClient();
    await client.appendRow('StatusHistory', newEntry);
    return newEntry;
  } catch (err) {
    // Rollback on failure
    history = previousHistory;
    error = err.message;
    throw err;
  }
}

/**
 * Get history for a specific grant.
 * @param {string} grantId
 * @returns {Array}
 */
function getByGrant(grantId) {
  return history
    .filter((h) => h.grant_id === grantId)
    .sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at));
}

/**
 * Clear all data (on logout or spreadsheet switch).
 */
function clear() {
  history = [];
  error = null;
}

/**
 * Clear any error state.
 */
function clearError() {
  error = null;
}

// Export the store interface
export const statusHistoryStore = {
  // State getters (reactive)
  get history() {
    return history;
  },
  get isLoading() {
    return isLoading;
  },
  get error() {
    return error;
  },

  // Actions
  load,
  recordChange,
  getByGrant,
  clear,
  clearError,
};
