/**
 * Backend API client initialization and exports.
 *
 * This module re-exports the generated API client services and provides
 * initialization for the backend API using service account credentials.
 *
 * Usage:
 *   import { SheetsService, DriveService, initBackendApi } from '$lib/api/backend.js';
 *
 *   // Initialize once at app startup
 *   initBackendApi();
 *
 *   // Use services
 *   const data = await SheetsService.readSheet({ requestBody: { sheet: 'Grants' } });
 */

import { OpenAPI } from './generated/index.js';

// Re-export services and types for convenient imports
export { SheetsService } from './generated/services/SheetsService.js';
export { DriveService } from './generated/services/DriveService.js';
export { ConfigService } from './generated/services/ConfigService.js';
export { ApiError } from './generated/core/ApiError.js';

// Re-export types
export * from './generated/models/AppendRowRequest.js';
export * from './generated/models/BatchUpdateRequest.js';
export * from './generated/models/Config.js';
export * from './generated/models/CreateDocRequest.js';
export * from './generated/models/CreateDocResponse.js';
export * from './generated/models/CreateFolderRequest.js';
export * from './generated/models/CreateFolderResponse.js';
export * from './generated/models/CreateShortcutRequest.js';
export * from './generated/models/CreateShortcutResponse.js';
export * from './generated/models/DeleteRowRequest.js';
export * from './generated/models/FileInfo.js';
export * from './generated/models/GetFileRequest.js';
export * from './generated/models/ListFilesRequest.js';
export * from './generated/models/ListFilesResponse.js';
export * from './generated/models/MoveFileRequest.js';
export * from './generated/models/ReadSheetRequest.js';
export * from './generated/models/ReadSheetResponse.js';
export * from './generated/models/ShortcutDetails.js';
export * from './generated/models/SuccessResponse.js';
export * from './generated/models/UpdateRowRequest.js';

/**
 * Initialize the backend API client.
 * Should be called once at app startup.
 *
 * @param {Object} [options] - Configuration options
 * @param {string} [options.baseUrl] - Override the base URL (default: '/api')
 */
export function initBackendApi(options = {}) {
  if (options.baseUrl) {
    OpenAPI.BASE = options.baseUrl;
  }

  // Ensure credentials are included (for session cookies)
  OpenAPI.CREDENTIALS = 'include';
  OpenAPI.WITH_CREDENTIALS = true;
}

/**
 * Check if the API returned an authentication error.
 * @param {Error} error - The error to check
 * @returns {boolean} - True if this is an auth error
 */
export function isAuthError(error) {
  return error?.status === 401;
}

/**
 * Check if the API returned an access denied error.
 * @param {Error} error - The error to check
 * @returns {boolean} - True if this is an access denied error
 */
export function isAccessDeniedError(error) {
  return error?.status === 403;
}

/**
 * Convert sheet data (headers + rows) to array of objects.
 * @param {{headers: string[], rows: any[][]}} data - Data from readSheet
 * @returns {Object[]} - Array of objects with header keys
 */
export function rowsToObjects(data) {
  const { headers, rows } = data;
  if (!headers || !rows) return [];

  return rows.map((row) => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] !== undefined ? row[i] : '';
    });
    return obj;
  });
}

/**
 * Convert an object to a row values array based on headers.
 * @param {Object} obj - The object to convert
 * @param {string[]} headers - The column headers in order
 * @returns {any[]} - Array of values in header order
 */
export function objectToRow(obj, headers) {
  return headers.map((header) => (obj[header] !== undefined ? obj[header] : ''));
}
