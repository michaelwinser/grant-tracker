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
import {
  extractFileIdFromUrl,
  fetchAssignedComments,
  generateSyncId,
  parseSyncId,
} from '../api/comments.js';
import { initializeMissingSheets, SCHEMA } from '../api/sheets.js';

// Reactive state
let actionItems = $state([]);
let isLoading = $state(false);
let isSyncing = $state(false);
let error = $state(null);
let lastLoaded = $state(null);

// Derived state
const openItems = $derived(
  actionItems.filter((item) => item.status === ActionItemStatus.OPEN)
);

const myItems = $derived.by(() => {
  const userEmail = userStore.user?.email?.toLowerCase();
  if (!userEmail) return [];
  return actionItems.filter(
    (item) =>
      item.status === ActionItemStatus.OPEN &&
      item.assignee?.toLowerCase() === userEmail
  );
});

const overdueItems = $derived.by(() => {
  const today = todayDate();
  return actionItems.filter(
    (item) =>
      item.status === ActionItemStatus.OPEN &&
      item.due_date &&
      item.due_date < today
  );
});

const itemsByGrant = $derived.by(() => {
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
 * Ensure the ActionItems sheet exists, creating it if necessary.
 * @returns {Promise<void>}
 */
async function ensureActionItemsSheetExists() {
  if (!userStore.accessToken || !spreadsheetStore.spreadsheetId) {
    throw new Error('Not authenticated or no spreadsheet selected');
  }

  // Try to read the ActionItems sheet to check if it exists
  const client = getClient();
  try {
    await client.readSheet('ActionItems');
    // Sheet exists, we're good
  } catch (err) {
    // If sheet doesn't exist, create it
    if (err.message?.includes('Unable to parse range') || err.isNotFound) {
      console.log('ActionItems sheet not found, creating it...');
      await initializeMissingSheets(
        userStore.accessToken,
        spreadsheetStore.spreadsheetId,
        ['ActionItems']
      );
    } else {
      // Some other error, re-throw
      throw err;
    }
  }
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
 * Check if an action item was synced from a comment.
 * @param {Object} item - Action item
 * @returns {boolean}
 */
function isSyncedItem(item) {
  return Boolean(item?.synced_comment_id);
}

/**
 * Get the source document URL for a synced item.
 * @param {Object} item - Action item
 * @param {Object} grant - Grant object with Tracker_URL and Proposal_URL
 * @returns {string|null} - Document URL or null if not synced
 */
function getSyncedDocUrl(item, grant) {
  if (!item?.synced_comment_id || !grant) return null;

  const parsed = parseSyncId(item.synced_comment_id);
  if (!parsed) return null;

  // Check which doc the comment came from
  const trackerFileId = extractFileIdFromUrl(grant.Tracker_URL);
  const proposalFileId = extractFileIdFromUrl(grant.Proposal_URL);

  if (parsed.fileId === trackerFileId) {
    return grant.Tracker_URL;
  } else if (parsed.fileId === proposalFileId) {
    return grant.Proposal_URL;
  }

  return null;
}

/**
 * Sync action items from comments in Tracker and Proposal docs.
 * Creates new action items for assigned comments that haven't been synced yet.
 * @param {string} grantId - Grant ID to sync for
 * @param {Object} grant - Grant object with Tracker_URL and Proposal_URL
 * @returns {Promise<{created: number, skipped: number, errors: string[]}>}
 */
async function syncFromComments(grantId, grant) {
  if (!userStore.accessToken) {
    throw new Error('Not authenticated');
  }

  isSyncing = true;
  error = null;

  const result = { created: 0, skipped: 0, errors: [] };

  try {
    // Ensure ActionItems sheet exists before syncing
    try {
      await ensureActionItemsSheetExists();
    } catch (sheetErr) {
      throw new Error(`Could not create ActionItems sheet: ${sheetErr.message}`);
    }

    // Get existing synced comment IDs for this grant
    const existingItems = getByGrantId(grantId);
    const existingSyncIds = new Set(
      existingItems
        .filter((item) => item.synced_comment_id)
        .map((item) => item.synced_comment_id)
    );

    // Collect docs to sync from
    const docsToSync = [];
    if (grant.Tracker_URL) {
      const fileId = extractFileIdFromUrl(grant.Tracker_URL);
      if (fileId) {
        docsToSync.push({ fileId, name: 'Tracker' });
      }
    }
    if (grant.Proposal_URL) {
      const fileId = extractFileIdFromUrl(grant.Proposal_URL);
      if (fileId) {
        docsToSync.push({ fileId, name: 'Proposal' });
      }
    }

    if (docsToSync.length === 0) {
      throw new Error('No Tracker or Proposal documents to sync from');
    }

    // Fetch comments from each doc (include resolved to update status)
    for (const doc of docsToSync) {
      try {
        const comments = await fetchAssignedComments(
          userStore.accessToken,
          doc.fileId,
          { includeResolved: true }
        );

        for (const comment of comments) {
          const syncId = generateSyncId(doc.fileId, comment.id);

          // Check if already synced
          if (existingSyncIds.has(syncId)) {
            // Find the existing item and check if we need to update its status
            const existingItem = existingItems.find(
              (item) => item.synced_comment_id === syncId
            );

            // If comment is now resolved but item is still open, mark it done
            if (comment.resolved && existingItem?.status === ActionItemStatus.OPEN) {
              try {
                await markDone(existingItem.item_id);
                result.updated = (result.updated || 0) + 1;
              } catch (updateErr) {
                result.errors.push(`Failed to mark resolved: ${updateErr.message}`);
              }
            } else {
              result.skipped++;
            }
            continue;
          }

          // Skip creating new items for already-resolved comments
          if (comment.resolved) {
            continue;
          }

          // Create new action item
          try {
            await create({
              grant_id: grantId,
              description: comment.content,
              assignee: comment.assignee,
              source: `${doc.name} doc comment`,
              synced_comment_id: syncId,
              comment_link: comment.htmlLink,
            });
            result.created++;
          } catch (createErr) {
            result.errors.push(`Failed to create item: ${createErr.message}`);
          }
        }
      } catch (fetchErr) {
        result.errors.push(`Error fetching ${doc.name} comments: ${fetchErr.message}`);
      }
    }

    return result;
  } finally {
    isSyncing = false;
  }
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
  get isSyncing() {
    return isSyncing;
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

  // Sync functions
  syncFromComments,
  isSyncedItem,
  getSyncedDocUrl,
};
