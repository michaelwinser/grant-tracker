/**
 * Root folder state store using Svelte 5 runes.
 * Manages the selected Google Drive root folder for Grant Tracker.
 */

import { configStore } from './config.svelte.js';

const STORAGE_KEY = 'grant-tracker-folder';

// Reactive state
let folderId = $state(null);
let folderName = $state(null);
let folderUrl = $state(null);
let grantsFolderId = $state(null); // Grants/ subfolder
let isLoading = $state(false);
let error = $state(null);

// Derived state
const hasFolder = $derived(folderId !== null);
// Check both localStorage and server config for grants folder
const hasGrantsFolder = $derived(grantsFolderId !== null || configStore.grantsFolderId !== null);
// Effective grants folder ID: prefer localStorage, fall back to server config
const effectiveGrantsFolderId = $derived(grantsFolderId || configStore.grantsFolderId);

/**
 * Initialize the store from localStorage.
 */
function initialize() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      folderId = data.id || null;
      folderName = data.name || null;
      folderUrl = data.url || null;
      grantsFolderId = data.grantsFolderId || null;
    }
  } catch (err) {
    console.warn('Failed to load folder from localStorage:', err);
    clear();
  }
}

/**
 * Set the selected root folder.
 * @param {Object} folder - Folder info
 * @param {string} folder.id - Folder ID
 * @param {string} folder.name - Folder name
 * @param {string} [folder.url] - Folder URL
 */
function setFolder(folder) {
  folderId = folder.id;
  folderName = folder.name;
  folderUrl = folder.url || `https://drive.google.com/drive/folders/${folder.id}`;
  grantsFolderId = null; // Will be set after creating/finding Grants subfolder
  error = null;

  persist();
}

/**
 * Set the Grants subfolder ID.
 * @param {string} id - Grants folder ID
 */
function setGrantsFolder(id) {
  grantsFolderId = id;
  persist();
}

/**
 * Persist current state to localStorage.
 */
function persist() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        id: folderId,
        name: folderName,
        url: folderUrl,
        grantsFolderId,
      })
    );
  } catch (err) {
    console.warn('Failed to save folder to localStorage:', err);
  }
}

/**
 * Clear the selected folder.
 */
function clear() {
  folderId = null;
  folderName = null;
  folderUrl = null;
  grantsFolderId = null;
  error = null;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to remove folder from localStorage:', err);
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
export const folderStore = {
  // State getters (reactive)
  get folderId() {
    return folderId;
  },
  get folderName() {
    return folderName;
  },
  get folderUrl() {
    return folderUrl;
  },
  get grantsFolderId() {
    return grantsFolderId;
  },
  get isLoading() {
    return isLoading;
  },
  get error() {
    return error;
  },
  get hasFolder() {
    return hasFolder;
  },
  get hasGrantsFolder() {
    return hasGrantsFolder;
  },
  get effectiveGrantsFolderId() {
    return effectiveGrantsFolderId;
  },

  // Actions
  initialize,
  setFolder,
  setGrantsFolder,
  clear,
  setLoading,
  setError,
  clearError,
};
