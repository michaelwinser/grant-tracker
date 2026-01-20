/**
 * Google Sheets API wrapper module.
 * Handles spreadsheet creation, validation, and schema initialization.
 */

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

/**
 * Custom error class for Sheets API errors with additional context.
 */
export class SheetsApiError extends Error {
  constructor(message, { status, code, isRateLimit = false, isPermissionError = false, isNotFound = false } = {}) {
    super(message);
    this.name = 'SheetsApiError';
    this.status = status;
    this.code = code;
    this.isRateLimit = isRateLimit;
    this.isPermissionError = isPermissionError;
    this.isNotFound = isNotFound;
  }
}

/**
 * Handle API response errors with user-friendly messages.
 * @param {Response} response - Fetch response
 * @param {string} operation - Description of the operation for error messages
 * @throws {SheetsApiError}
 */
async function handleApiError(response, operation) {
  const errorBody = await response.json().catch(() => ({}));
  const errorMessage = errorBody.error?.message || '';
  const errorCode = errorBody.error?.code || response.status;

  // Rate limit errors
  if (response.status === 429 || errorMessage.includes('Quota exceeded') || errorMessage.includes('Rate Limit')) {
    throw new SheetsApiError(
      'Too many requests. Please wait a moment and try again.',
      { status: response.status, code: errorCode, isRateLimit: true }
    );
  }

  // Permission errors
  if (response.status === 403) {
    throw new SheetsApiError(
      'You do not have permission to access this spreadsheet. Please select a spreadsheet you own or have been granted access to.',
      { status: 403, code: errorCode, isPermissionError: true }
    );
  }

  // Not found errors
  if (response.status === 404) {
    throw new SheetsApiError(
      'Spreadsheet not found. It may have been deleted or moved.',
      { status: 404, code: errorCode, isNotFound: true }
    );
  }

  // Authentication errors
  if (response.status === 401) {
    throw new SheetsApiError(
      'Your session has expired. Please sign out and sign back in.',
      { status: 401, code: errorCode }
    );
  }

  // Generic error
  throw new SheetsApiError(
    errorMessage || `${operation} failed (${response.status})`,
    { status: response.status, code: errorCode }
  );
}

/**
 * Required sheets and their column headers for Grant Tracker.
 * Simplified schema - dropdown values come from separate Status/Tags sheets.
 */
export const SCHEMA = {
  Grants: [
    'ID',
    'Title',
    'Organization',
    'Status',
    'Amount',
    'Primary_Contact',
    'Other_Contacts',
    'Year',
    'Beneficiary',
    'Tags',
    'Cat_A_Percent',
    'Cat_B_Percent',
    'Cat_C_Percent',
    'Cat_D_Percent',
    'Folder_URL',
    'Proposal_URL',
    'Tracker_URL',
  ],
  Status: ['Status'],
  Tags: ['Name'],
};

/**
 * Default status values for new spreadsheets.
 */
export const DEFAULT_STATUS_VALUES = [
  'Initial Contact',
  'Meeting',
  'Proposal Development',
  'Stakeholder Review',
  'Approved',
  'Notification',
  'Signing',
  'Disbursement',
  'Active',
  'Finished',
  'Rejected',
  'Deferred',
];

/**
 * Default tag values for new spreadsheets.
 */
export const DEFAULT_TAG_VALUES = [
  'Python',
  'Rust',
  'Security',
  'Infrastructure',
];

/**
 * Numeric fields that need parsing from formatted strings.
 */
export const NUMERIC_FIELDS = [
  'Amount',
  'Year',
  'Cat_A_Percent',
  'Cat_B_Percent',
  'Cat_C_Percent',
  'Cat_D_Percent',
];

/**
 * Fetch spreadsheet metadata.
 * @param {string} accessToken - OAuth access token
 * @param {string} spreadsheetId - Spreadsheet ID
 * @returns {Promise<Object>} - Spreadsheet metadata
 */
export async function getSpreadsheetMetadata(accessToken, spreadsheetId) {
  const response = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}?fields=spreadsheetId,properties.title,sheets.properties`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    await handleApiError(response, 'Fetch spreadsheet');
  }

  return response.json();
}

/**
 * Validate that a spreadsheet has the required schema.
 * Only requires Grants sheet - Status and Tags are optional (can use defaults).
 * Also ensures all required columns exist (adds missing ones).
 * @param {string} accessToken - OAuth access token
 * @param {string} spreadsheetId - Spreadsheet ID
 * @returns {Promise<{valid: boolean, missingSheets: string[], metadata: Object}>}
 */
export async function validateSchema(accessToken, spreadsheetId) {
  const metadata = await getSpreadsheetMetadata(accessToken, spreadsheetId);

  const existingSheets = new Set(
    metadata.sheets?.map((s) => s.properties.title) || []
  );

  // Only Grants sheet is strictly required
  const requiredSheets = ['Grants'];
  const missingSheets = requiredSheets.filter((sheet) => !existingSheets.has(sheet));

  // If valid, ensure all columns exist
  if (missingSheets.length === 0) {
    await ensureGrantsColumns(accessToken, spreadsheetId);
  }

  return {
    valid: missingSheets.length === 0,
    missingSheets,
    metadata: {
      id: metadata.spreadsheetId,
      name: metadata.properties.title,
      sheets: Array.from(existingSheets),
    },
  };
}

/**
 * Ensure the Grants sheet has all required columns.
 * Adds any missing columns to the header row.
 * @param {string} accessToken - OAuth access token
 * @param {string} spreadsheetId - Spreadsheet ID
 */
async function ensureGrantsColumns(accessToken, spreadsheetId) {
  // Read current headers from the Grants sheet
  const response = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/Grants!1:1`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    console.warn('Could not read Grants headers for column check');
    return;
  }

  const data = await response.json();
  const currentHeaders = data.values?.[0] || [];
  const requiredHeaders = SCHEMA.Grants;

  // Find missing columns
  const missingHeaders = requiredHeaders.filter(
    (h) => !currentHeaders.includes(h)
  );

  if (missingHeaders.length === 0) {
    return; // All columns exist
  }

  console.log('Adding missing columns to Grants sheet:', missingHeaders);

  // Calculate the starting column for new headers
  const startColumn = currentHeaders.length;
  const endColumn = startColumn + missingHeaders.length;
  const startColLetter = columnIndexToLetter(startColumn);
  const endColLetter = columnIndexToLetter(endColumn - 1);

  // Add the missing headers
  const updateResponse = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/Grants!${startColLetter}1:${endColLetter}1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [missingHeaders],
      }),
    }
  );

  if (!updateResponse.ok) {
    console.warn('Failed to add missing columns:', await updateResponse.text());
  }
}

/**
 * Convert a 0-indexed column number to a letter (0 = A, 25 = Z, 26 = AA).
 * @param {number} index - Column index (0-indexed)
 * @returns {string} - Column letter
 */
function columnIndexToLetter(index) {
  let letter = '';
  let num = index + 1; // Convert to 1-indexed
  while (num > 0) {
    const remainder = (num - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    num = Math.floor((num - 1) / 26);
  }
  return letter;
}

/**
 * Create a new Grant Tracker spreadsheet with all required sheets.
 * @param {string} accessToken - OAuth access token
 * @param {string} title - Spreadsheet title
 * @returns {Promise<{id: string, name: string, url: string}>}
 */
export async function createSpreadsheet(accessToken, title = 'Grant Tracker') {
  // Build sheet definitions with headers
  const sheets = Object.entries(SCHEMA).map(([sheetName, headers]) => ({
    properties: {
      title: sheetName,
    },
    data: [
      {
        startRow: 0,
        startColumn: 0,
        rowData: [
          {
            values: headers.map((header) => ({
              userEnteredValue: { stringValue: header },
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
              },
            })),
          },
        ],
      },
    ],
  }));

  const response = await fetch(SHEETS_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets,
    }),
  });

  if (!response.ok) {
    await handleApiError(response, 'Create spreadsheet');
  }

  const data = await response.json();

  // Apply basic formatting (freeze headers) and add default dropdown values
  await applyBasicFormatting(accessToken, data.spreadsheetId, data.sheets);
  await addDefaultDropdownValues(accessToken, data.spreadsheetId);

  return {
    id: data.spreadsheetId,
    name: data.properties.title,
    url: data.spreadsheetUrl,
  };
}

/**
 * Apply basic formatting: freeze header rows, set column widths.
 * @param {string} accessToken - OAuth access token
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {Object[]} sheets - Array of sheet metadata
 */
async function applyBasicFormatting(accessToken, spreadsheetId, sheets) {
  const requests = [];

  for (const sheet of sheets) {
    const sheetId = sheet.properties.sheetId;

    // Freeze the header row
    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 1 },
        },
        fields: 'gridProperties.frozenRowCount',
      },
    });
  }

  if (requests.length === 0) return;

  await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });
}

/**
 * Add default values to Status and Tags sheets.
 * @param {string} accessToken - OAuth access token
 * @param {string} spreadsheetId - Spreadsheet ID
 */
async function addDefaultDropdownValues(accessToken, spreadsheetId) {
  const data = [
    {
      range: 'Status!A2:A',
      values: DEFAULT_STATUS_VALUES.map((s) => [s]),
    },
    {
      range: 'Tags!A2:A',
      values: DEFAULT_TAG_VALUES.map((t) => [t]),
    },
  ];

  await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data,
      }),
    }
  );
}

/**
 * Initialize missing sheets in an existing spreadsheet.
 * @param {string} accessToken - OAuth access token
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {string[]} missingSheets - List of sheets to create
 * @returns {Promise<void>}
 */
export async function initializeMissingSheets(accessToken, spreadsheetId, missingSheets) {
  if (missingSheets.length === 0) return;

  // Add sheets via batchUpdate
  const requests = missingSheets.map((sheetName) => ({
    addSheet: {
      properties: { title: sheetName },
    },
  }));

  const batchResponse = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!batchResponse.ok) {
    await handleApiError(batchResponse, 'Add sheets');
  }

  // Add headers to each new sheet
  for (const sheetName of missingSheets) {
    const headers = SCHEMA[sheetName];
    if (!headers) continue;

    await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/${sheetName}!A1:${columnLetter(headers.length)}1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [headers] }),
      }
    );
  }

  // Add default values for Status and Tags sheets if created
  if (missingSheets.includes('Status') || missingSheets.includes('Tags')) {
    await addDefaultDropdownValues(accessToken, spreadsheetId);
  }
}

/**
 * Read dropdown values from the Status sheet.
 * @param {string} accessToken - OAuth access token
 * @param {string} spreadsheetId - Spreadsheet ID
 * @returns {Promise<string[]>} - List of status values
 */
export async function readStatusValues(accessToken, spreadsheetId) {
  try {
    const response = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Status!A2:A?majorDimension=COLUMNS`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      // Status sheet may not exist, return defaults
      return DEFAULT_STATUS_VALUES;
    }

    const data = await response.json();
    const values = data.values?.[0] || [];
    return values.length > 0 ? values : DEFAULT_STATUS_VALUES;
  } catch {
    return DEFAULT_STATUS_VALUES;
  }
}

/**
 * Read dropdown values from the Tags sheet.
 * @param {string} accessToken - OAuth access token
 * @param {string} spreadsheetId - Spreadsheet ID
 * @returns {Promise<string[]>} - List of tag values
 */
export async function readTagValues(accessToken, spreadsheetId) {
  try {
    const response = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Tags!A2:A?majorDimension=COLUMNS`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      // Tags sheet may not exist, return defaults
      return DEFAULT_TAG_VALUES;
    }

    const data = await response.json();
    const values = data.values?.[0] || [];
    return values.length > 0 ? values : DEFAULT_TAG_VALUES;
  } catch {
    return DEFAULT_TAG_VALUES;
  }
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
