/**
 * Action Items store using Svelte 5 runes.
 * Manages action item data with CRUD operations and derived views.
 */

import { createSheetsClient } from '../api/sheetsClient.js';
import { userStore } from './user.svelte.js';
import { spreadsheetStore } from './spreadsheet.svelte.js';
import {
  normalizeRow,
  nowTimestamp,
  todayDate,
  generateId,
  ActionItemStatus,
} from '../models.js';

// Reactive state
let actionItems = $state([]);
let isLoading = $state(false);
let error = $state(null);
let lastLoaded = $state(null);

// Derived state
const openItems = $derived(
  actionItems.filter((item) => item.status === ActionItemStatus.OPEN)
);

const myItems = $derived(() => {
  const userEmail = userStore.user?.email?.toLowerCase();
  if (!userEmail) return [];
  return actionItems.filter(
    (item) =>
      item.status === ActionItemStatus.OPEN &&
      item.assignee?.toLowerCase() === userEmail
  );
});

const overdueItems = $derived(() => {
  const today = todayDate();
  return actionItems.filter(
    (item) =>
      item.status === ActionItemStatus.OPEN &&
      item.due_date &&
      item.due_date < today
  );
});

const itemsByGrant = $derived(() => {
  const grouped = {};
  for (const item of actionItems) {
    const grantId = item.grant_id || '_ungrouped';
    if (!grouped[grantId]) {
      grouped[grantId] = [];
    }
    grouped[grantId].push(item);
  }
  return grouped;
});

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
 * Load all action items from the spreadsheet.
 * @returns {Promise<void>}
 */
async function load() {
  isLoading = true;
  error = null;

  try {
    const client = getClient();
    const rows = await client.readSheet('ActionItems');
    actionItems = rows
      .map((row) => normalizeRow(row))
      .filter((row) => row.item_id); // Filter out empty rows
    lastLoaded = new Date();
  } catch (err) {
    error = err.message;
    throw err;
  } finally {
    isLoading = false;
  }
}

/**
 * Create a new action item.
 * @param {Object} itemData - Action item data (grant_id, description required)
 * @returns {Promise<Object>} - The created item
 */
async function create(itemData) {
  const now = nowTimestamp();
  const newItem = {
    item_id: generateId('AI'),
    status: ActionItemStatus.OPEN,
    ...itemData,
    created_at: now,
  };

  // Optimistic update
  const previousItems = [...actionItems];
  actionItems = [...actionItems, newItem];

  try {
    const client = getClient();
    await client.appendRow('ActionItems', newItem);
    return newItem;
  } catch (err) {
    // Rollback on failure
    actionItems = previousItems;
    error = err.message;
    throw err;
  }
}

/**
 * Update an existing action item.
 * @param {string} itemId - Item ID to update
 * @param {Object} updates - Partial updates
 * @returns {Promise<Object>} - The updated item
 */
async function update(itemId, updates) {
  const index = actionItems.findIndex((item) => item.item_id === itemId);
  if (index === -1) {
    throw new Error(`Action item not found: ${itemId}`);
  }

  const updatedItem = {
    ...actionItems[index],
    ...updates,
  };

  // Track completion
  if (updates.status === ActionItemStatus.DONE && !updatedItem.completed_at) {
    updatedItem.completed_at = nowTimestamp();
  }

  // Optimistic update
  const previousItems = [...actionItems];
  actionItems = actionItems.map((item) =>
    item.item_id === itemId ? updatedItem : item
  );

  try {
    const client = getClient();
    await client.updateById('ActionItems', 'item_id', itemId, updatedItem);
    return updatedItem;
  } catch (err) {
    // Rollback on failure
    actionItems = previousItems;
    error = err.message;
    throw err;
  }
}

/**
 * Mark an action item as done.
 * @param {string} itemId - Item ID to complete
 * @returns {Promise<Object>} - The updated item
 */
async function markDone(itemId) {
  return update(itemId, {
    status: ActionItemStatus.DONE,
    completed_at: nowTimestamp(),
  });
}

/**
 * Mark an action item as cancelled.
 * @param {string} itemId - Item ID to cancel
 * @returns {Promise<Object>} - The updated item
 */
async function markCancelled(itemId) {
  return update(itemId, {
    status: ActionItemStatus.CANCELLED,
  });
}

/**
 * Reopen a completed or cancelled action item.
 * @param {string} itemId - Item ID to reopen
 * @returns {Promise<Object>} - The updated item
 */
async function reopen(itemId) {
  return update(itemId, {
    status: ActionItemStatus.OPEN,
    completed_at: null,
  });
}

/**
 * Delete an action item.
 * @param {string} itemId - Item ID to delete
 * @returns {Promise<void>}
 */
async function remove(itemId) {
  const index = actionItems.findIndex((item) => item.item_id === itemId);
  if (index === -1) {
    throw new Error(`Action item not found: ${itemId}`);
  }

  // Optimistic update
  const previousItems = [...actionItems];
  actionItems = actionItems.filter((item) => item.item_id !== itemId);

  try {
    const client = getClient();
    await client.deleteById('ActionItems', 'item_id', itemId);
  } catch (err) {
    // Rollback on failure
    actionItems = previousItems;
    error = err.message;
    throw err;
  }
}

/**
 * Get an action item by ID.
 * @param {string} itemId
 * @returns {Object|undefined}
 */
function getById(itemId) {
  return actionItems.find((item) => item.item_id === itemId);
}

/**
 * Get all action items for a grant.
 * @param {string} grantId
 * @returns {Object[]}
 */
function getByGrantId(grantId) {
  return actionItems.filter((item) => item.grant_id === grantId);
}

/**
 * Clear all data (on logout or spreadsheet switch).
 */
function clear() {
  actionItems = [];
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
export const actionItemsStore = {
  // State getters (reactive)
  get actionItems() {
    return actionItems;
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
  get openItems() {
    return openItems;
  },
  get myItems() {
    return myItems;
  },
  get overdueItems() {
    return overdueItems;
  },
  get itemsByGrant() {
    return itemsByGrant;
  },

  // Actions
  load,
  create,
  update,
  markDone,
  markCancelled,
  reopen,
  remove,
  getById,
  getByGrantId,
  clear,
  clearError,
};
