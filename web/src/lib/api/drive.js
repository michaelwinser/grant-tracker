/**
 * Google Drive API module.
 * Handles folder creation, file listing, and document management.
 */

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

/**
 * Create a folder in Google Drive.
 * @param {string} accessToken - OAuth access token
 * @param {string} name - Folder name
 * @param {string} [parentId] - Parent folder ID (optional)
 * @returns {Promise<{id: string, name: string, url: string}>}
 */
export async function createFolder(accessToken, name, parentId) {
  const metadata = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  const response = await fetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Failed to create folder (${response.status})`);
  }

  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    url: `https://drive.google.com/drive/folders/${data.id}`,
  };
}

/**
 * List files/folders in a folder.
 * @param {string} accessToken - OAuth access token
 * @param {string} folderId - Folder ID to list contents of
 * @param {Object} [options] - Options
 * @param {string} [options.mimeType] - Filter by MIME type
 * @param {boolean} [options.foldersOnly] - Only return folders
 * @returns {Promise<Array<{id: string, name: string, mimeType: string, modifiedTime: string}>>}
 */
export async function listFiles(accessToken, folderId, options = {}) {
  let query = `'${folderId}' in parents and trashed = false`;

  if (options.foldersOnly) {
    query += ` and mimeType = 'application/vnd.google-apps.folder'`;
  } else if (options.mimeType) {
    query += ` and mimeType = '${options.mimeType}'`;
  }

  const params = new URLSearchParams({
    q: query,
    fields: 'files(id, name, mimeType, modifiedTime, webViewLink)',
    orderBy: 'name',
    pageSize: '1000',
  });

  const response = await fetch(`${DRIVE_API_BASE}/files?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Failed to list files (${response.status})`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Find a folder by name within a parent folder.
 * @param {string} accessToken - OAuth access token
 * @param {string} parentId - Parent folder ID
 * @param {string} name - Folder name to find
 * @returns {Promise<{id: string, name: string}|null>}
 */
export async function findFolder(accessToken, parentId, name) {
  const query = `'${parentId}' in parents and name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

  const params = new URLSearchParams({
    q: query,
    fields: 'files(id, name)',
    pageSize: '1',
  });

  const response = await fetch(`${DRIVE_API_BASE}/files?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Failed to find folder (${response.status})`);
  }

  const data = await response.json();
  return data.files?.[0] || null;
}

/**
 * Find or create a folder by name within a parent folder.
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
  const metadata = {
    name,
    mimeType: 'application/vnd.google-apps.document',
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  const response = await fetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Failed to create document (${response.status})`);
  }

  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    url: `https://docs.google.com/document/d/${data.id}`,
  };
}

/**
 * Get file metadata.
 * @param {string} accessToken - OAuth access token
 * @param {string} fileId - File ID
 * @returns {Promise<{id: string, name: string, mimeType: string, parents: string[]}>}
 */
export async function getFile(accessToken, fileId) {
  const params = new URLSearchParams({
    fields: 'id, name, mimeType, parents, webViewLink',
  });

  const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Failed to get file (${response.status})`);
  }

  return response.json();
}

/**
 * Check if a folder exists and is accessible.
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
 * Create the complete folder structure for a new grant.
 * Creates:
 * - [GRANT-ID]/ folder under the Grants/ folder
 * - [GRANT-ID]-Tracker doc (optionally initialized with grant metadata and approvals)
 * - [GRANT-ID]-Proposal doc
 * - Reports/ subfolder
 *
 * @param {string} accessToken - OAuth access token
 * @param {string} grantsFolderId - ID of the parent Grants/ folder
 * @param {string} grantId - Grant ID (e.g., "PYPI-2026-Packaging")
 * @param {Object} [grant] - Optional grant data to initialize Tracker doc
 * @param {string} [spreadsheetId] - Optional spreadsheet ID to read approvers from
 * @returns {Promise<{folderId: string, folderUrl: string, trackerUrl: string, proposalUrl: string, reportsFolderId: string}>}
 */
export async function createGrantFolderStructure(accessToken, grantsFolderId, grantId, grant = null, spreadsheetId = null) {
  // Import modules dynamically to avoid circular dependencies
  const { initializeTrackerDoc } = await import('./docs.js');
  const { readApprovers } = await import('./sheets.js');

  // Create the grant folder
  const grantFolder = await createFolder(accessToken, grantId, grantsFolderId);

  // Create Tracker doc, Proposal doc, and Reports folder in parallel
  const [trackerDoc, proposalDoc, reportsFolder] = await Promise.all([
    createDoc(accessToken, `${grantId}-Tracker`, grantFolder.id),
    createDoc(accessToken, `${grantId}-Proposal`, grantFolder.id),
    createFolder(accessToken, 'Reports', grantFolder.id),
  ]);

  // Initialize Tracker doc with grant metadata if grant data provided
  if (grant) {
    try {
      // Read approvers from spreadsheet if available
      let approvers = [];
      if (spreadsheetId) {
        try {
          approvers = await readApprovers(accessToken, spreadsheetId);
        } catch (err) {
          console.warn('Failed to read approvers:', err);
        }
      }

      await initializeTrackerDoc(accessToken, trackerDoc.id, grant, approvers);
    } catch (err) {
      console.warn('Failed to initialize Tracker doc:', err);
      // Don't fail the whole operation if doc init fails
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
 * Add a file to a folder (move it from its current location).
 * @param {string} accessToken - OAuth access token
 * @param {string} fileId - File ID to move
 * @param {string} targetFolderId - Target folder ID
 * @returns {Promise<{id: string, name: string}>}
 */
export async function addFileToFolder(accessToken, fileId, targetFolderId) {
  // First get the file's current parents
  const file = await getFile(accessToken, fileId);
  const currentParents = file.parents?.join(',') || '';

  // Update the file's parents
  const params = new URLSearchParams({
    addParents: targetFolderId,
    removeParents: currentParents,
    fields: 'id, name, webViewLink',
  });

  const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}?${params}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Failed to move file (${response.status})`);
  }

  return response.json();
}

/**
 * Create a shortcut to a file in a folder.
 * This doesn't move the original - just creates a link.
 * @param {string} accessToken - OAuth access token
 * @param {string} fileId - File ID to create shortcut for
 * @param {string} targetFolderId - Target folder ID
 * @returns {Promise<{id: string, name: string}>}
 */
export async function createShortcut(accessToken, fileId, targetFolderId) {
  // Get the file name first
  const file = await getFile(accessToken, fileId);

  const metadata = {
    name: file.name,
    mimeType: 'application/vnd.google-apps.shortcut',
    shortcutDetails: {
      targetId: fileId,
    },
    parents: [targetFolderId],
  };

  const response = await fetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Failed to create shortcut (${response.status})`);
  }

  return response.json();
}
