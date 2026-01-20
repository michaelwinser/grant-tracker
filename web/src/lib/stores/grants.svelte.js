/**
 * Grants store using Svelte 5 runes.
 * Manages grant data with CRUD operations and derived views.
 */

import { createSheetsClient } from '../api/sheetsClient.js';
import { userStore } from './user.svelte.js';
import { spreadsheetStore } from './spreadsheet.svelte.js';
import { readStatusValues, DEFAULT_STATUS_VALUES } from '../api/sheets.js';

/**
 * Fields that contain numeric data.
 * With UNFORMATTED_VALUE these come back as numbers already,
 * but we may need to handle missing values.
 */
const NUMBER_FIELDS = [
  'Amount',
  'Year',
  'Cat_A_Percent',
  'Cat_B_Percent',
  'Cat_C_Percent',
  'Cat_D_Percent',
];

/**
 * "Active" statuses (not terminal states).
 */
const TERMINAL_STATUSES = ['Finished', 'Rejected', 'Deferred'];

// Reactive state
let grants = $state([]);
let statusValues = $state(DEFAULT_STATUS_VALUES);
let isLoading = $state(false);
let error = $state(null);
let lastLoaded = $state(null);

// Derived state
const grantsByStatus = $derived(() => {
  const grouped = {};
  for (const status of statusValues) {
    grouped[status] = [];
  }
  for (const grant of grants) {
    const status = grant.Status || statusValues[0];
    if (!grouped[status]) {
      grouped[status] = [];
    }
    grouped[status].push(grant);
  }
  return grouped;
});

const activeGrants = $derived(
  grants.filter((g) => !TERMINAL_STATUSES.includes(g.Status))
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
 * Normalize a row, handling empty values.
 * @param {Object} row - Raw row from sheets
 * @returns {Object} - Normalized row
 */
function normalizeGrant(row) {
  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === '' || value === undefined) {
      normalized[key] = null;
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

/**
 * Load all grants from the spreadsheet.
 * Also loads status values from the Status sheet.
 * @returns {Promise<void>}
 */
async function load() {
  isLoading = true;
  error = null;

  try {
    const client = getClient();

    // Load status values for dropdowns
    statusValues = await readStatusValues(
      userStore.accessToken,
      spreadsheetStore.spreadsheetId
    );

    // Load grants
    const rows = await client.readSheet('Grants');
    grants = rows
      .map(normalizeGrant)
      .filter((row) => row.ID); // Filter out empty rows
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
 * @param {Object} grantData - Grant data (must include ID)
 * @returns {Promise<Object>} - The created grant
 */
async function create(grantData) {
  const newGrant = { ...grantData };

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
  const index = grants.findIndex((g) => g.ID === grantId);
  if (index === -1) {
    throw new Error(`Grant not found: ${grantId}`);
  }

  const updatedGrant = {
    ...grants[index],
    ...updates,
  };

  // Optimistic update
  const previousGrants = [...grants];
  grants = grants.map((g) => (g.ID === grantId ? updatedGrant : g));

  try {
    const client = getClient();
    await client.updateById('Grants', 'ID', grantId, updatedGrant);
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
  const index = grants.findIndex((g) => g.ID === grantId);
  if (index === -1) {
    throw new Error(`Grant not found: ${grantId}`);
  }

  // Optimistic update
  const previousGrants = [...grants];
  grants = grants.filter((g) => g.ID !== grantId);

  try {
    const client = getClient();
    await client.deleteById('Grants', 'ID', grantId);
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
  return grants.find((g) => g.ID === grantId);
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
  get statusValues() {
    return statusValues;
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
