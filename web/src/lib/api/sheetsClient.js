/**
 * Generic Sheets API client for CRUD operations.
 * Provides read/write methods with exponential backoff for rate limiting.
 */

import { SheetsApiError, SCHEMA } from './sheets.js';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// Exponential backoff configuration
const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 32000;
const MAX_RETRIES = 5;

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter.
 * @param {number} attempt - Current attempt number (0-indexed)
 * @returns {number} - Delay in milliseconds
 */
function getBackoffDelay(attempt) {
  const exponentialDelay = BACKOFF_BASE_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, BACKOFF_MAX_MS);
}

/**
 * Handle API response, throwing appropriate errors.
 * @param {Response} response
 * @param {string} operation
 * @returns {Promise<{ok: boolean, shouldRetry: boolean, error?: SheetsApiError}>}
 */
async function handleResponse(response, operation) {
  if (response.ok) {
    return { ok: true, shouldRetry: false };
  }

  const errorBody = await response.json().catch(() => ({}));
  const errorMessage = errorBody.error?.message || '';
  const errorCode = errorBody.error?.code || response.status;

  // Rate limit - should retry with backoff
  if (response.status === 429 || errorMessage.includes('Quota exceeded') || errorMessage.includes('Rate Limit')) {
    return {
      ok: false,
      shouldRetry: true,
      error: new SheetsApiError(
        'Rate limit exceeded',
        { status: response.status, code: errorCode, isRateLimit: true }
      ),
    };
  }

  // Server errors - might be transient, retry
  if (response.status >= 500) {
    return {
      ok: false,
      shouldRetry: true,
      error: new SheetsApiError(
        errorMessage || `Server error (${response.status})`,
        { status: response.status, code: errorCode }
      ),
    };
  }

  // Permission errors - don't retry
  if (response.status === 403) {
    return {
      ok: false,
      shouldRetry: false,
      error: new SheetsApiError(
        'You do not have permission to perform this operation.',
        { status: 403, code: errorCode, isPermissionError: true }
      ),
    };
  }

  // Not found - don't retry
  if (response.status === 404) {
    return {
      ok: false,
      shouldRetry: false,
      error: new SheetsApiError(
        'Resource not found.',
        { status: 404, code: errorCode, isNotFound: true }
      ),
    };
  }

  // Auth errors - don't retry
  if (response.status === 401) {
    return {
      ok: false,
      shouldRetry: false,
      error: new SheetsApiError(
        'Your session has expired. Please sign out and sign back in.',
        { status: 401, code: errorCode }
      ),
    };
  }

  // Other client errors - don't retry
  return {
    ok: false,
    shouldRetry: false,
    error: new SheetsApiError(
      errorMessage || `${operation} failed (${response.status})`,
      { status: response.status, code: errorCode }
    ),
  };
}

/**
 * Fetch with exponential backoff retry.
 * @param {string} url
 * @param {RequestInit} options
 * @param {string} operation - Description for error messages
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options, operation) {
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await fetch(url, options);
    const result = await handleResponse(response, operation);

    if (result.ok) {
      return response;
    }

    lastError = result.error;

    if (!result.shouldRetry || attempt === MAX_RETRIES - 1) {
      throw lastError;
    }

    const delay = getBackoffDelay(attempt);
    console.warn(`${operation} failed, retrying in ${Math.round(delay)}ms...`, lastError.message);
    await sleep(delay);
  }

  throw lastError;
}

/**
 * Convert a row array to an object using column headers.
 * @param {string[]} headers - Column headers
 * @param {any[]} row - Row values
 * @returns {Object}
 */
export function rowToObject(headers, row) {
  const obj = {};
  headers.forEach((header, i) => {
    obj[header] = row[i] !== undefined ? row[i] : null;
  });
  return obj;
}

/**
 * Convert an object to a row array using column headers.
 * @param {string[]} headers - Column headers
 * @param {Object} obj - Object to convert
 * @returns {any[]}
 */
export function objectToRow(headers, obj) {
  return headers.map((header) => obj[header] ?? '');
}

/**
 * Create a Sheets API client instance.
 * @param {string} accessToken - OAuth access token
 * @param {string} spreadsheetId - Spreadsheet ID
 * @returns {Object} - Client with CRUD methods
 */
export function createSheetsClient(accessToken, spreadsheetId) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  /**
   * Read all rows from a sheet.
   * @param {string} sheetName - Name of the sheet
   * @returns {Promise<Object[]>} - Array of row objects
   */
  async function readSheet(sheetName) {
    const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
    const response = await fetchWithRetry(url, { headers }, `Read ${sheetName}`);
    const data = await response.json();

    if (!data.values || data.values.length === 0) {
      return [];
    }

    const [headerRow, ...rows] = data.values;
    return rows.map((row) => rowToObject(headerRow, row));
  }

  /**
   * Append a row to a sheet.
   * @param {string} sheetName - Name of the sheet
   * @param {Object} rowData - Object with column values
   * @returns {Promise<Object>} - The appended row data
   */
  async function appendRow(sheetName, rowData) {
    const sheetHeaders = SCHEMA[sheetName];
    if (!sheetHeaders) {
      throw new Error(`Unknown sheet: ${sheetName}`);
    }

    const row = objectToRow(sheetHeaders, rowData);
    const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ values: [row] }),
      },
      `Append to ${sheetName}`
    );

    return rowData;
  }

  /**
   * Update a specific row in a sheet.
   * @param {string} sheetName - Name of the sheet
   * @param {number} rowIndex - Row index (0-indexed, excluding header)
   * @param {Object} rowData - Object with column values
   * @returns {Promise<Object>} - The updated row data
   */
  async function updateRow(sheetName, rowIndex, rowData) {
    const sheetHeaders = SCHEMA[sheetName];
    if (!sheetHeaders) {
      throw new Error(`Unknown sheet: ${sheetName}`);
    }

    const row = objectToRow(sheetHeaders, rowData);
    const rowNumber = rowIndex + 2; // +1 for header, +1 for 1-indexed
    const range = `${sheetName}!A${rowNumber}:${columnLetter(sheetHeaders.length)}${rowNumber}`;
    const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

    await fetchWithRetry(
      url,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({ values: [row] }),
      },
      `Update ${sheetName} row ${rowNumber}`
    );

    return rowData;
  }

  /**
   * Delete a row from a sheet by clearing its contents.
   * Note: This clears the row but doesn't remove it to preserve row indices.
   * @param {string} sheetName - Name of the sheet
   * @param {number} rowIndex - Row index (0-indexed, excluding header)
   * @returns {Promise<void>}
   */
  async function clearRow(sheetName, rowIndex) {
    const sheetHeaders = SCHEMA[sheetName];
    if (!sheetHeaders) {
      throw new Error(`Unknown sheet: ${sheetName}`);
    }

    const rowNumber = rowIndex + 2;
    const range = `${sheetName}!A${rowNumber}:${columnLetter(sheetHeaders.length)}${rowNumber}`;
    const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`;

    await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers,
      },
      `Clear ${sheetName} row ${rowNumber}`
    );
  }

  /**
   * Delete a row from a sheet by actually removing it.
   * @param {string} sheetName - Name of the sheet
   * @param {number} rowIndex - Row index (0-indexed, excluding header)
   * @returns {Promise<void>}
   */
  async function deleteRow(sheetName, rowIndex) {
    // First, get sheet ID
    const metadataUrl = `${SHEETS_API_BASE}/${spreadsheetId}?fields=sheets.properties`;
    const metadataResponse = await fetchWithRetry(metadataUrl, { headers }, 'Get sheet metadata');
    const metadata = await metadataResponse.json();

    const sheet = metadata.sheets?.find((s) => s.properties.title === sheetName);
    if (!sheet) {
      throw new Error(`Sheet not found: ${sheetName}`);
    }

    const rowNumber = rowIndex + 2; // +1 for header, +1 for 1-indexed
    const url = `${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`;

    await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: sheet.properties.sheetId,
                  dimension: 'ROWS',
                  startIndex: rowNumber - 1, // 0-indexed
                  endIndex: rowNumber,
                },
              },
            },
          ],
        }),
      },
      `Delete ${sheetName} row ${rowNumber}`
    );
  }

  /**
   * Find the row index of a record by its ID field.
   * @param {string} sheetName - Name of the sheet
   * @param {string} idField - Name of the ID field (e.g., 'grant_id')
   * @param {string} idValue - Value to search for
   * @returns {Promise<number>} - Row index (0-indexed excluding header) or -1 if not found
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
   * @param {Object} updates - Partial updates to apply
   * @returns {Promise<Object>} - The updated row data
   */
  async function updateById(sheetName, idField, idValue, updates) {
    const rows = await readSheet(sheetName);
    const rowIndex = rows.findIndex((row) => row[idField] === idValue);

    if (rowIndex === -1) {
      throw new Error(`${sheetName} with ${idField}="${idValue}" not found`);
    }

    const updatedRow = { ...rows[rowIndex], ...updates };
    return updateRow(sheetName, rowIndex, updatedRow);
  }

  /**
   * Delete a row by finding it by ID.
   * @param {string} sheetName - Name of the sheet
   * @param {string} idField - Name of the ID field
   * @param {string} idValue - ID value to find
   * @returns {Promise<void>}
   */
  async function deleteById(sheetName, idField, idValue) {
    const rowIndex = await findRowIndex(sheetName, idField, idValue);

    if (rowIndex === -1) {
      throw new Error(`${sheetName} with ${idField}="${idValue}" not found`);
    }

    return deleteRow(sheetName, rowIndex);
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
 * Convert a column number to a letter (1 = A, 26 = Z, 27 = AA).
 * @param {number} num - Column number (1-indexed)
 * @returns {string} - Column letter
 */
function columnLetter(num) {
  let letter = '';
  while (num > 0) {
    const remainder = (num - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    num = Math.floor((num - 1) / 26);
  }
  return letter;
}
