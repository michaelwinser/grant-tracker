/**
 * Unified Sheets API client.
 *
 * Uses the backend API when service account is enabled (for consistent access),
 * or falls back to direct Google Sheets API calls (client-side auth).
 */

import { configStore } from '../stores/config.svelte.js';
import { createSheetsClient } from './sheetsClient.js';
import { SheetsService, rowsToObjects } from './backend.js';

/**
 * Create a unified sheets client.
 *
 * @param {string} accessToken - User's OAuth access token (for direct API or auth verification)
 * @param {string} spreadsheetId - Spreadsheet ID (used for direct API mode)
 * @returns {Object} - Client with CRUD methods
 */
export function createUnifiedSheetsClient(accessToken, spreadsheetId) {
  // Use backend API if service account is enabled
  if (configStore.serviceAccountEnabled) {
    return createBackendSheetsClient();
  }

  // Fall back to direct Google API
  return createSheetsClient(accessToken, spreadsheetId);
}

/**
 * Create a sheets client that uses the backend API.
 * @returns {Object} - Client with CRUD methods matching sheetsClient interface
 */
function createBackendSheetsClient() {
  /**
   * Read all rows from a sheet.
   * @param {string} sheetName - Name of the sheet
   * @returns {Promise<Object[]>} - Array of row objects
   */
  async function readSheet(sheetName) {
    const response = await SheetsService.readSheet({
      requestBody: { sheet: sheetName },
    });

    return rowsToObjects(response);
  }

  /**
   * Append a row to a sheet.
   * @param {string} sheetName - Name of the sheet
   * @param {Object} rowData - Object with column values
   * @returns {Promise<Object>} - The appended row data
   */
  async function appendRow(sheetName, rowData) {
    await SheetsService.appendRow({
      requestBody: {
        sheet: sheetName,
        row: rowData,
      },
    });

    return rowData;
  }

  /**
   * Update a specific row in a sheet (by index - not typically used with backend).
   * For backend, prefer updateById.
   * @param {string} sheetName - Name of the sheet
   * @param {number} rowIndex - Row index (0-indexed, excluding header)
   * @param {Object} rowData - Object with column values
   * @returns {Promise<Object>} - The updated row data
   */
  async function updateRow(sheetName, rowIndex, rowData) {
    // Backend doesn't support direct row index updates
    // This is a compatibility shim - find the ID and use updateById
    console.warn('updateRow by index not supported with backend API, use updateById instead');
    throw new Error('updateRow by index not supported with backend API');
  }

  /**
   * Find the row index of a record by its ID field.
   * Note: With backend API, this reads all data to find the index.
   * @param {string} sheetName - Name of the sheet
   * @param {string} idField - Name of the ID field
   * @param {string} idValue - Value to search for
   * @returns {Promise<number>} - Row index or -1 if not found
   */
  async function findRowIndex(sheetName, idField, idValue) {
    const rows = await readSheet(sheetName);
    return rows.findIndex((row) => row[idField] === idValue);
  }

  /**
   * Update a row by finding it by ID.
   * @param {string} sheetName - Name of the sheet
   * @param {string} idField - Name of the ID field
   * @param {string} idValue - ID value to find
   * @param {Object} updates - Full row data or partial updates
   * @returns {Promise<Object>} - The updated row data
   */
  async function updateById(sheetName, idField, idValue, updates) {
    await SheetsService.updateRow({
      requestBody: {
        sheet: sheetName,
        idColumn: idField,
        id: idValue,
        data: updates,
      },
    });

    return updates;
  }

  /**
   * Delete a row by finding it by ID.
   * @param {string} sheetName - Name of the sheet
   * @param {string} idField - Name of the ID field
   * @param {string} idValue - ID value to find
   * @returns {Promise<void>}
   */
  async function deleteById(sheetName, idField, idValue) {
    await SheetsService.deleteRow({
      requestBody: {
        sheet: sheetName,
        idColumn: idField,
        id: idValue,
      },
    });
  }

  /**
   * Delete a row from a sheet by index.
   * @param {string} sheetName - Name of the sheet
   * @param {number} rowIndex - Row index (0-indexed, excluding header)
   * @returns {Promise<void>}
   */
  async function deleteRow(sheetName, rowIndex) {
    // Backend doesn't support direct row index deletion
    console.warn('deleteRow by index not supported with backend API, use deleteById instead');
    throw new Error('deleteRow by index not supported with backend API');
  }

  /**
   * Clear a row (not implemented for backend - use deleteById instead).
   */
  async function clearRow(sheetName, rowIndex) {
    console.warn('clearRow not supported with backend API, use deleteById instead');
    throw new Error('clearRow not supported with backend API');
  }

  return {
    readSheet,
    appendRow,
    updateRow,
    clearRow,
    deleteRow,
    findRowIndex,
    updateById,
    deleteById,
  };
}

/**
 * Check if we're using the backend API.
 * @returns {boolean}
 */
export function isUsingBackendApi() {
  return configStore.serviceAccountEnabled;
}
