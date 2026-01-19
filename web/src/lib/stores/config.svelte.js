/**
 * Config store using Svelte 5 runes.
 * Manages configuration from the Config sheet (team members, categories, folder IDs).
 */

import { createSheetsClient } from '../api/sheetsClient.js';
import { userStore } from './user.svelte.js';
import { spreadsheetStore } from './spreadsheet.svelte.js';

// Reactive state
let configMap = $state({});
let isLoading = $state(false);
let error = $state(null);
let lastLoaded = $state(null);

// Derived state - parse JSON values
const teamMembers = $derived(() => {
  try {
    const value = configMap.team_members;
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
});

const categories = $derived(() => {
  try {
    const value = configMap.categories;
    return value ? JSON.parse(value) : ['Category A', 'Category B', 'Category C', 'Category D'];
  } catch {
    return ['Category A', 'Category B', 'Category C', 'Category D'];
  }
});

const driveRootFolderId = $derived(configMap.drive_root_folder_id || null);
const templatesFolderId = $derived(configMap.templates_folder_id || null);

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
 * Load configuration from the spreadsheet.
 * @returns {Promise<void>}
 */
async function load() {
  isLoading = true;
  error = null;

  try {
    const client = getClient();
    const rows = await client.readSheet('Config');

    // Convert rows to key-value map
    const newConfig = {};
    for (const row of rows) {
      if (row.key) {
        newConfig[row.key] = row.value;
      }
    }
    configMap = newConfig;
    lastLoaded = new Date();
  } catch (err) {
    error = err.message;
    throw err;
  } finally {
    isLoading = false;
  }
}

/**
 * Get a config value by key.
 * @param {string} key
 * @returns {string|null}
 */
function get(key) {
  return configMap[key] ?? null;
}

/**
 * Set a config value.
 * @param {string} key
 * @param {string} value
 * @returns {Promise<void>}
 */
async function set(key, value) {
  // Optimistic update
  const previousConfig = { ...configMap };
  configMap = { ...configMap, [key]: value };

  try {
    const client = getClient();

    // Check if key exists
    const rows = await client.readSheet('Config');
    const existingIndex = rows.findIndex((row) => row.key === key);

    if (existingIndex >= 0) {
      // Update existing row
      await client.updateRow('Config', existingIndex, { key, value });
    } else {
      // Append new row
      await client.appendRow('Config', { key, value });
    }
  } catch (err) {
    // Rollback on failure
    configMap = previousConfig;
    error = err.message;
    throw err;
  }
}

/**
 * Update team members list.
 * @param {string[]} members - Array of email addresses
 * @returns {Promise<void>}
 */
async function setTeamMembers(members) {
  return set('team_members', JSON.stringify(members));
}

/**
 * Add a team member.
 * @param {string} email
 * @returns {Promise<void>}
 */
async function addTeamMember(email) {
  const current = teamMembers();
  if (!current.includes(email)) {
    await setTeamMembers([...current, email]);
  }
}

/**
 * Remove a team member.
 * @param {string} email
 * @returns {Promise<void>}
 */
async function removeTeamMember(email) {
  const current = teamMembers();
  await setTeamMembers(current.filter((e) => e !== email));
}

/**
 * Check if an email is in the team members list.
 * @param {string} email
 * @returns {boolean}
 */
function isTeamMember(email) {
  return teamMembers().some(
    (member) => member.toLowerCase() === email.toLowerCase()
  );
}

/**
 * Update categories list.
 * @param {string[]} cats - Array of category names
 * @returns {Promise<void>}
 */
async function setCategories(cats) {
  return set('categories', JSON.stringify(cats));
}

/**
 * Set the Drive root folder ID.
 * @param {string} folderId
 * @returns {Promise<void>}
 */
async function setDriveRootFolderId(folderId) {
  return set('drive_root_folder_id', folderId);
}

/**
 * Set the templates folder ID.
 * @param {string} folderId
 * @returns {Promise<void>}
 */
async function setTemplatesFolderId(folderId) {
  return set('templates_folder_id', folderId);
}

/**
 * Clear all data (on logout or spreadsheet switch).
 */
function clear() {
  configMap = {};
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
export const configStore = {
  // State getters (reactive)
  get configMap() {
    return configMap;
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
  get teamMembers() {
    return teamMembers;
  },
  get categories() {
    return categories;
  },
  get driveRootFolderId() {
    return driveRootFolderId;
  },
  get templatesFolderId() {
    return templatesFolderId;
  },

  // Actions
  load,
  get,
  set,
  setTeamMembers,
  addTeamMember,
  removeTeamMember,
  isTeamMember,
  setCategories,
  setDriveRootFolderId,
  setTemplatesFolderId,
  clear,
  clearError,
};
