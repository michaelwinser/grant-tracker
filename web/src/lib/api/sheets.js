/**
 * Google Sheets API wrapper module.
 * Handles spreadsheet creation, validation, and schema initialization.
 */

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

/**
 * Required sheets and their column headers for Grant Tracker.
 */
export const SCHEMA = {
  Grants: [
    'grant_id',
    'title',
    'organization',
    'contact_name',
    'contact_email',
    'type',
    'category_a_pct',
    'category_b_pct',
    'category_c_pct',
    'category_d_pct',
    'ecosystem',
    'amount',
    'grant_year',
    'status',
    'program_manager',
    'proposal_doc_url',
    'internal_notes_url',
    'drive_folder_url',
    'github_repo',
    'created_at',
    'updated_at',
    'status_changed_at',
    'notes',
  ],
  ActionItems: [
    'item_id',
    'grant_id',
    'description',
    'assignee',
    'due_date',
    'status',
    'source',
    'created_at',
    'completed_at',
  ],
  Reports: [
    'report_id',
    'grant_id',
    'period',
    'report_type',
    'status',
    'due_date',
    'received_date',
    'url',
    'notes',
  ],
  Artifacts: [
    'artifact_id',
    'grant_id',
    'artifact_type',
    'title',
    'url',
    'date',
    'added_by',
    'created_at',
  ],
  StatusHistory: [
    'history_id',
    'grant_id',
    'from_status',
    'to_status',
    'changed_by',
    'changed_at',
    'notes',
  ],
  Config: ['key', 'value'],
};

/**
 * Default configuration values for a new spreadsheet.
 */
const DEFAULT_CONFIG = [
  ['key', 'value'],
  ['team_members', '[]'],
  ['categories', '["Category A", "Category B", "Category C", "Category D"]'],
  ['drive_root_folder_id', ''],
  ['templates_folder_id', ''],
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
    const error = await response.json().catch(() => ({}));
    if (response.status === 404) {
      throw new Error('Spreadsheet not found. It may have been deleted or you may not have access.');
    }
    if (response.status === 403) {
      throw new Error('You do not have permission to access this spreadsheet.');
    }
    throw new Error(error.error?.message || `Failed to fetch spreadsheet: ${response.status}`);
  }

  return response.json();
}

/**
 * Validate that a spreadsheet has the required schema.
 * @param {string} accessToken - OAuth access token
 * @param {string} spreadsheetId - Spreadsheet ID
 * @returns {Promise<{valid: boolean, missingSheets: string[], metadata: Object}>}
 */
export async function validateSchema(accessToken, spreadsheetId) {
  const metadata = await getSpreadsheetMetadata(accessToken, spreadsheetId);

  const existingSheets = new Set(
    metadata.sheets?.map((s) => s.properties.title) || []
  );

  const requiredSheets = Object.keys(SCHEMA);
  const missingSheets = requiredSheets.filter((sheet) => !existingSheets.has(sheet));

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
 * Create a new Grant Tracker spreadsheet with all required sheets.
 * @param {string} accessToken - OAuth access token
 * @param {string} title - Spreadsheet title
 * @returns {Promise<{id: string, name: string, url: string}>}
 */
export async function createSpreadsheet(accessToken, title = 'Grant Tracker') {
  // Build sheet requests with headers
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
      properties: {
        title,
      },
      sheets,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Failed to create spreadsheet: ${response.status}`);
  }

  const data = await response.json();

  // Add default config values
  await addDefaultConfig(accessToken, data.spreadsheetId);

  return {
    id: data.spreadsheetId,
    name: data.properties.title,
    url: data.spreadsheetUrl,
  };
}

/**
 * Add default configuration values to the Config sheet.
 * @param {string} accessToken - OAuth access token
 * @param {string} spreadsheetId - Spreadsheet ID
 */
async function addDefaultConfig(accessToken, spreadsheetId) {
  const response = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/Config!A1:B${DEFAULT_CONFIG.length}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: DEFAULT_CONFIG,
      }),
    }
  );

  if (!response.ok) {
    console.warn('Failed to add default config values');
  }
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
      properties: {
        title: sheetName,
      },
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
    const error = await batchResponse.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Failed to add sheets');
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
        body: JSON.stringify({
          values: [headers],
        }),
      }
    );
  }

  // Format headers
  const metadata = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const formatRequests = [];

  for (const sheetName of missingSheets) {
    const sheetInfo = metadata.sheets?.find((s) => s.properties.title === sheetName);
    if (!sheetInfo) continue;

    const headers = SCHEMA[sheetName];
    formatRequests.push({
      repeatCell: {
        range: {
          sheetId: sheetInfo.properties.sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: headers.length,
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
            backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
          },
        },
        fields: 'userEnteredFormat(textFormat,backgroundColor)',
      },
    });
  }

  if (formatRequests.length > 0) {
    await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests: formatRequests }),
    });
  }

  // Add default config if Config sheet was just created
  if (missingSheets.includes('Config')) {
    await addDefaultConfig(accessToken, spreadsheetId);
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
