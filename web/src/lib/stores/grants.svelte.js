/**
 * Grants store using Svelte 5 runes.
 * Manages grant data with CRUD operations and derived views.
 */

import { createSheetsClient } from '../api/sheetsClient.js';
import { userStore } from './user.svelte.js';
import { spreadsheetStore } from './spreadsheet.svelte.js';
import {
  normalizeRow,
  nowTimestamp,
  GrantStatus,
  GRANT_STATUS_ORDER,
  ACTIVE_STATUSES,
} from '../models.js';

const NUMBER_FIELDS = [
  'category_a_pct',
  'category_b_pct',
  'category_c_pct',
  'category_d_pct',
  'amount',
  'grant_year',
];

// Reactive state
let grants = $state([]);
let isLoading = $state(false);
let error = $state(null);
let lastLoaded = $state(null);

// Derived state
const grantsByStatus = $derived(() => {
  const grouped = {};
  for (const status of GRANT_STATUS_ORDER) {
    grouped[status] = [];
  }
  for (const grant of grants) {
    const status = grant.status || GrantStatus.INITIAL_CONTACT;
    if (!grouped[status]) {
      grouped[status] = [];
    }
    grouped[status].push(grant);
  }
  return grouped;
});

const activeGrants = $derived(
  grants.filter((g) => ACTIVE_STATUSES.includes(g.status))
);

const grantCount = $derived(grants.length);

/**
 * Get a sheets client instance.
 * @returns {Object}
 */
function getClient() {
  if (!userStore.accessToken || !spreadsheetStore.spreadsheetId) {
    throw new Error('Not authenticated or no spreadsheet selected');
  }
  return createSheetsClient(userStore.accessToken, spreadsheetStore.spreadsheetId);
}

/**
 * Load all grants from the spreadsheet.
 * @returns {Promise<void>}
 */
async function load() {
  isLoading = true;
  error = null;

  try {
    const client = getClient();
    const rows = await client.readSheet('Grants');
    grants = rows
      .map((row) => normalizeRow(row, NUMBER_FIELDS))
      .filter((row) => row.grant_id); // Filter out empty rows
    lastLoaded = new Date();
  } catch (err) {
    error = err.message;
    throw err;
  } finally {
    isLoading = false;
  }
}

/**
 * Create a new grant.
 * @param {Object} grantData - Grant data (must include grant_id)
 * @returns {Promise<Object>} - The created grant
 */
async function create(grantData) {
  const now = nowTimestamp();
  const newGrant = {
    ...grantData,
    created_at: now,
    updated_at: now,
    status_changed_at: now,
  };

  // Optimistic update
  const previousGrants = [...grants];
  grants = [...grants, newGrant];

  try {
    const client = getClient();
    await client.appendRow('Grants', newGrant);
    return newGrant;
  } catch (err) {
    // Rollback on failure
    grants = previousGrants;
    error = err.message;
    throw err;
  }
}

/**
 * Update an existing grant.
 * @param {string} grantId - Grant ID to update
 * @param {Object} updates - Partial updates
 * @returns {Promise<Object>} - The updated grant
 */
async function update(grantId, updates) {
  const index = grants.findIndex((g) => g.grant_id === grantId);
  if (index === -1) {
    throw new Error(`Grant not found: ${grantId}`);
  }

  const now = nowTimestamp();
  const updatedGrant = {
    ...grants[index],
    ...updates,
    updated_at: now,
  };

  // Track status change
  if (updates.status && updates.status !== grants[index].status) {
    updatedGrant.status_changed_at = now;
  }

  // Optimistic update
  const previousGrants = [...grants];
  grants = grants.map((g) => (g.grant_id === grantId ? updatedGrant : g));

  try {
    const client = getClient();
    await client.updateById('Grants', 'grant_id', grantId, updatedGrant);
    return updatedGrant;
  } catch (err) {
    // Rollback on failure
    grants = previousGrants;
    error = err.message;
    throw err;
  }
}

/**
 * Delete a grant.
 * @param {string} grantId - Grant ID to delete
 * @returns {Promise<void>}
 */
async function remove(grantId) {
  const index = grants.findIndex((g) => g.grant_id === grantId);
  if (index === -1) {
    throw new Error(`Grant not found: ${grantId}`);
  }

  // Optimistic update
  const previousGrants = [...grants];
  grants = grants.filter((g) => g.grant_id !== grantId);

  try {
    const client = getClient();
    await client.deleteById('Grants', 'grant_id', grantId);
  } catch (err) {
    // Rollback on failure
    grants = previousGrants;
    error = err.message;
    throw err;
  }
}

/**
 * Get a grant by ID.
 * @param {string} grantId
 * @returns {Object|undefined}
 */
function getById(grantId) {
  return grants.find((g) => g.grant_id === grantId);
}

/**
 * Clear all data (on logout or spreadsheet switch).
 */
function clear() {
  grants = [];
  error = null;
  lastLoaded = null;
}

/**
 * Clear any error state.
 */
function clearError() {
  error = null;
}

// Export the store interface
export const grantsStore = {
  // State getters (reactive)
  get grants() {
    return grants;
  },
  get isLoading() {
    return isLoading;
  },
  get error() {
    return error;
  },
  get lastLoaded() {
    return lastLoaded;
  },
  get grantsByStatus() {
    return grantsByStatus;
  },
  get activeGrants() {
    return activeGrants;
  },
  get grantCount() {
    return grantCount;
  },

  // Actions
  load,
  create,
  update,
  remove,
  getById,
  clear,
  clearError,
};
