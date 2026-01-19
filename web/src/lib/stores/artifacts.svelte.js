/**
 * Artifacts store using Svelte 5 runes.
 * Manages artifact data (blog posts, meeting notes, announcements linked to grants).
 */

import { createSheetsClient } from '../api/sheetsClient.js';
import { userStore } from './user.svelte.js';
import { spreadsheetStore } from './spreadsheet.svelte.js';
import { normalizeRow, nowTimestamp, generateId } from '../models.js';

// Reactive state
let artifacts = $state([]);
let isLoading = $state(false);
let error = $state(null);
let lastLoaded = $state(null);

// Derived state - artifacts grouped by grant
const artifactsByGrant = $derived(() => {
  const grouped = {};
  for (const artifact of artifacts) {
    const grantId = artifact.grant_id || '_ungrouped';
    if (!grouped[grantId]) {
      grouped[grantId] = [];
    }
    grouped[grantId].push(artifact);
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
 * Load all artifacts from the spreadsheet.
 * @returns {Promise<void>}
 */
async function load() {
  isLoading = true;
  error = null;

  try {
    const client = getClient();
    const rows = await client.readSheet('Artifacts');
    artifacts = rows
      .map((row) => normalizeRow(row))
      .filter((row) => row.artifact_id); // Filter out empty rows
    lastLoaded = new Date();
  } catch (err) {
    error = err.message;
    throw err;
  } finally {
    isLoading = false;
  }
}

/**
 * Create a new artifact.
 * @param {Object} artifactData - Artifact data
 * @returns {Promise<Object>} - The created artifact
 */
async function create(artifactData) {
  const now = nowTimestamp();
  const newArtifact = {
    artifact_id: generateId('ART'),
    added_by: userStore.user?.email || userStore.user?.name || 'Unknown',
    created_at: now,
    ...artifactData,
  };

  // Optimistic update
  const previousArtifacts = [...artifacts];
  artifacts = [...artifacts, newArtifact];

  try {
    const client = getClient();
    await client.appendRow('Artifacts', newArtifact);
    return newArtifact;
  } catch (err) {
    // Rollback on failure
    artifacts = previousArtifacts;
    error = err.message;
    throw err;
  }
}

/**
 * Update an existing artifact.
 * @param {string} artifactId - Artifact ID to update
 * @param {Object} updates - Partial updates
 * @returns {Promise<Object>} - The updated artifact
 */
async function update(artifactId, updates) {
  const index = artifacts.findIndex((a) => a.artifact_id === artifactId);
  if (index === -1) {
    throw new Error(`Artifact not found: ${artifactId}`);
  }

  const updatedArtifact = {
    ...artifacts[index],
    ...updates,
  };

  // Optimistic update
  const previousArtifacts = [...artifacts];
  artifacts = artifacts.map((a) =>
    a.artifact_id === artifactId ? updatedArtifact : a
  );

  try {
    const client = getClient();
    await client.updateById('Artifacts', 'artifact_id', artifactId, updatedArtifact);
    return updatedArtifact;
  } catch (err) {
    // Rollback on failure
    artifacts = previousArtifacts;
    error = err.message;
    throw err;
  }
}

/**
 * Delete an artifact.
 * @param {string} artifactId - Artifact ID to delete
 * @returns {Promise<void>}
 */
async function remove(artifactId) {
  const index = artifacts.findIndex((a) => a.artifact_id === artifactId);
  if (index === -1) {
    throw new Error(`Artifact not found: ${artifactId}`);
  }

  // Optimistic update
  const previousArtifacts = [...artifacts];
  artifacts = artifacts.filter((a) => a.artifact_id !== artifactId);

  try {
    const client = getClient();
    await client.deleteById('Artifacts', 'artifact_id', artifactId);
  } catch (err) {
    // Rollback on failure
    artifacts = previousArtifacts;
    error = err.message;
    throw err;
  }
}

/**
 * Get an artifact by ID.
 * @param {string} artifactId
 * @returns {Object|undefined}
 */
function getById(artifactId) {
  return artifacts.find((a) => a.artifact_id === artifactId);
}

/**
 * Get all artifacts for a grant.
 * @param {string} grantId
 * @returns {Object[]}
 */
function getByGrantId(grantId) {
  return artifacts.filter((a) => a.grant_id === grantId);
}

/**
 * Clear all data (on logout or spreadsheet switch).
 */
function clear() {
  artifacts = [];
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
export const artifactsStore = {
  // State getters (reactive)
  get artifacts() {
    return artifacts;
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
  get artifactsByGrant() {
    return artifactsByGrant;
  },

  // Actions
  load,
  create,
  update,
  remove,
  getById,
  getByGrantId,
  clear,
  clearError,
};
