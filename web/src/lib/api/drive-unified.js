/**
 * Unified Drive API client.
 *
 * Uses the backend API when service account is enabled (for consistent access),
 * or falls back to direct Google Drive API calls (client-side auth).
 */

import { configStore } from '../stores/config.svelte.js';
import { DriveService } from './backend.js';
import * as directDrive from './drive.js';

/**
 * Check if we should use the backend API.
 * @returns {boolean}
 */
function useBackend() {
  return configStore.serviceAccountEnabled;
}

/**
 * Extract actual error message from an API error.
 * The generated API client puts the static error description in error.message,
 * but the actual server error is in error.body.error.
 * @param {Error} error - The error to extract message from
 * @returns {string} - The actual error message
 */
function extractErrorMessage(error) {
  // Check if this is an ApiError with a body containing the actual error
  if (error.body && typeof error.body === 'object' && error.body.error) {
    return error.body.error;
  }
  // Fall back to the error message
  return error.message || 'Unknown error';
}

/**
 * Wrap an async function to extract better error messages from API errors.
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Wrapped function
 */
async function withBetterErrors(fn) {
  try {
    return await fn();
  } catch (error) {
    const message = extractErrorMessage(error);
    const betterError = new Error(message);
    betterError.status = error.status;
    betterError.body = error.body;
    throw betterError;
  }
}

/**
 * Create a folder in Google Drive.
 * @param {string} accessToken - OAuth access token
 * @param {string} name - Folder name
 * @param {string} [parentId] - Parent folder ID
 * @returns {Promise<{id: string, name: string, url: string}>}
 */
export async function createFolder(accessToken, name, parentId) {
  if (useBackend()) {
    return withBetterErrors(async () => {
      const response = await DriveService.createFolder({
        requestBody: { name, parentId },
      });
      return {
        id: response.id,
        name: name,
        url: response.url,
      };
    });
  }

  return directDrive.createFolder(accessToken, name, parentId);
}

/**
 * List files/folders in a folder.
 * @param {string} accessToken - OAuth access token
 * @param {string} folderId - Folder ID
 * @param {Object} [options] - Options
 * @returns {Promise<Array>}
 */
export async function listFiles(accessToken, folderId, options = {}) {
  if (useBackend()) {
    return withBetterErrors(async () => {
      let query = null;
      if (options.foldersOnly) {
        query = `mimeType = 'application/vnd.google-apps.folder'`;
      } else if (options.mimeType) {
        query = `mimeType = '${options.mimeType}'`;
      }

      const response = await DriveService.listFiles({
        requestBody: { folderId, query },
      });

      return response.files || [];
    });
  }

  return directDrive.listFiles(accessToken, folderId, options);
}

/**
 * Find a folder by name within a parent folder.
 * @param {string} accessToken - OAuth access token
 * @param {string} parentId - Parent folder ID
 * @param {string} name - Folder name to find
 * @returns {Promise<{id: string, name: string}|null>}
 */
export async function findFolder(accessToken, parentId, name) {
  if (useBackend()) {
    return withBetterErrors(async () => {
      const query = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder'`;
      const response = await DriveService.listFiles({
        requestBody: { folderId: parentId, query },
      });

      return response.files?.[0] || null;
    });
  }

  return directDrive.findFolder(accessToken, parentId, name);
}

/**
 * Find or create a folder by name.
 * @param {string} accessToken - OAuth access token
 * @param {string} parentId - Parent folder ID
 * @param {string} name - Folder name
 * @returns {Promise<{id: string, name: string, url: string, created: boolean}>}
 */
export async function findOrCreateFolder(accessToken, parentId, name) {
  const existing = await findFolder(accessToken, parentId, name);

  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      url: `https://drive.google.com/drive/folders/${existing.id}`,
      created: false,
    };
  }

  const created = await createFolder(accessToken, name, parentId);
  return { ...created, created: true };
}

/**
 * Create a Google Doc.
 * @param {string} accessToken - OAuth access token
 * @param {string} name - Document name
 * @param {string} [parentId] - Parent folder ID
 * @returns {Promise<{id: string, name: string, url: string}>}
 */
export async function createDoc(accessToken, name, parentId) {
  if (useBackend()) {
    return withBetterErrors(async () => {
      const response = await DriveService.createDoc({
        requestBody: {
          name,
          mimeType: 'application/vnd.google-apps.document',
          parentId,
        },
      });
      return {
        id: response.id,
        name: name,
        url: response.url,
      };
    });
  }

  return directDrive.createDoc(accessToken, name, parentId);
}

/**
 * Get file metadata.
 * @param {string} accessToken - OAuth access token
 * @param {string} fileId - File ID
 * @returns {Promise<Object>}
 */
export async function getFile(accessToken, fileId) {
  if (useBackend()) {
    return withBetterErrors(async () => {
      return DriveService.getFile({
        requestBody: { fileId },
      });
    });
  }

  return directDrive.getFile(accessToken, fileId);
}

/**
 * Check if a folder exists.
 * @param {string} accessToken - OAuth access token
 * @param {string} folderId - Folder ID
 * @returns {Promise<boolean>}
 */
export async function folderExists(accessToken, folderId) {
  try {
    const file = await getFile(accessToken, folderId);
    return file.mimeType === 'application/vnd.google-apps.folder';
  } catch {
    return false;
  }
}

/**
 * Create a shortcut to a file.
 * @param {string} accessToken - OAuth access token
 * @param {string} fileId - File ID to link to
 * @param {string} targetFolderId - Target folder ID
 * @returns {Promise<{id: string, name: string}>}
 */
export async function createShortcut(accessToken, fileId, targetFolderId) {
  if (useBackend()) {
    return withBetterErrors(async () => {
      const response = await DriveService.createShortcut({
        requestBody: {
          targetId: fileId,
          parentId: targetFolderId,
        },
      });
      return { id: response.id };
    });
  }

  return directDrive.createShortcut(accessToken, fileId, targetFolderId);
}

/**
 * Move a file to a different folder.
 * @param {string} accessToken - OAuth access token
 * @param {string} fileId - File ID
 * @param {string} targetFolderId - Target folder ID
 * @returns {Promise<Object>}
 */
export async function moveFileToFolder(accessToken, fileId, targetFolderId) {
  if (useBackend()) {
    return withBetterErrors(async () => {
      await DriveService.moveFile({
        requestBody: {
          fileId,
          newParentId: targetFolderId,
        },
      });
      return { id: fileId };
    });
  }

  return directDrive.moveFileToFolder(accessToken, fileId, targetFolderId);
}

/**
 * Add a file to a folder (multi-parent).
 * Note: Backend doesn't support multi-parent, so this creates a shortcut instead.
 * @param {string} accessToken - OAuth access token
 * @param {string} fileId - File ID
 * @param {string} targetFolderId - Target folder ID
 * @returns {Promise<Object>}
 */
export async function addFileToFolder(accessToken, fileId, targetFolderId) {
  if (useBackend()) {
    // Backend uses service account which may not have edit access to the source file
    // Create a shortcut instead
    return createShortcut(accessToken, fileId, targetFolderId);
  }

  return directDrive.addFileToFolder(accessToken, fileId, targetFolderId);
}

/**
 * Copy a file to a folder.
 * Note: Backend API doesn't support copy, falls back to direct API.
 * @param {string} accessToken - OAuth access token
 * @param {string} fileId - File ID
 * @param {string} targetFolderId - Target folder ID
 * @param {string} [newName] - Optional new name
 * @returns {Promise<Object>}
 */
export async function copyFile(accessToken, fileId, targetFolderId, newName = null) {
  // Backend doesn't have copy endpoint - use direct API
  // This might fail if user doesn't have access - that's expected
  return directDrive.copyFile(accessToken, fileId, targetFolderId, newName);
}

/**
 * Create the complete folder structure for a new grant.
 * @param {string} accessToken - OAuth access token
 * @param {string} grantsFolderId - Parent folder ID
 * @param {string} grantId - Grant ID
 * @param {Object} [grant] - Optional grant data
 * @param {string} [spreadsheetId] - Optional spreadsheet ID
 * @returns {Promise<Object>}
 */
export async function createGrantFolderStructure(accessToken, grantsFolderId, grantId, grant = null, spreadsheetId = null) {
  // This is a complex operation that creates multiple resources
  // For now, implement it using the unified primitives

  // Create the grant folder
  const grantFolder = await createFolder(accessToken, grantId, grantsFolderId);

  // Create Tracker doc, Proposal doc, and Reports folder
  const [trackerDoc, proposalDoc, reportsFolder] = await Promise.all([
    createDoc(accessToken, `${grantId}-Tracker`, grantFolder.id),
    createDoc(accessToken, `${grantId}-Proposal`, grantFolder.id),
    createFolder(accessToken, 'Reports', grantFolder.id),
  ]);

  // Initialize Tracker doc with grant metadata if grant data provided
  if (grant) {
    try {
      if (useBackend()) {
        // Use backend endpoint for service account mode
        await initializeTrackerDocViaBackend(trackerDoc.id, grant);
      } else {
        // Use direct Docs API for client-side mode
        const { initializeTrackerDoc } = await import('./docs.js');
        const { readApprovers } = await import('./sheets.js');

        let approvers = [];
        if (spreadsheetId) {
          try {
            approvers = await readApprovers(accessToken, spreadsheetId);
          } catch (err) {
            console.warn('Failed to read approvers:', err);
          }
        }

        await initializeTrackerDoc(accessToken, trackerDoc.id, grant, approvers);
      }
    } catch (err) {
      console.warn('Failed to initialize Tracker doc:', err);
    }
  }

  return {
    folderId: grantFolder.id,
    folderUrl: grantFolder.url,
    trackerUrl: trackerDoc.url,
    proposalUrl: proposalDoc.url,
    reportsFolderId: reportsFolder.id,
  };
}

/**
 * Check if we're using the backend API.
 * @returns {boolean}
 */
export function isUsingBackendApi() {
  return configStore.serviceAccountEnabled;
}

/**
 * Initialize a tracker doc via the backend (service account mode).
 * @param {string} documentId - Document ID
 * @param {Object} grant - Grant data
 * @returns {Promise<void>}
 */
async function initializeTrackerDocViaBackend(documentId, grant) {
  const response = await fetch('/api/docs/initialize-tracker', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      documentId,
      grant: {
        ID: grant.ID || '',
        Title: grant.Title || '',
        Organization: grant.Organization || '',
        Amount: grant.Amount ? String(grant.Amount) : '',
        Status: grant.Status || '',
        Year: grant.Year ? String(grant.Year) : '',
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
}
