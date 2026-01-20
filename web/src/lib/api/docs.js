/**
 * Google Docs API module.
 * Handles document reading, writing, and metadata table management.
 */

const DOCS_API_BASE = 'https://docs.googleapis.com/v1/documents';

/**
 * Named range identifier for the grant metadata table.
 */
export const METADATA_RANGE_NAME = 'GRANT_TRACKER_METADATA';

/**
 * Get a Google Doc's content.
 * @param {string} accessToken - OAuth access token
 * @param {string} documentId - Document ID
 * @returns {Promise<Object>} - Document data
 */
export async function getDocument(accessToken, documentId) {
  const response = await fetch(`${DOCS_API_BASE}/${documentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Failed to get document (${response.status})`);
  }

  return response.json();
}

/**
 * Execute a batch update on a Google Doc.
 * @param {string} accessToken - OAuth access token
 * @param {string} documentId - Document ID
 * @param {Object[]} requests - Array of update requests
 * @returns {Promise<Object>} - Batch update response
 */
export async function batchUpdate(accessToken, documentId, requests) {
  const response = await fetch(`${DOCS_API_BASE}/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Failed to update document (${response.status})`);
  }

  return response.json();
}

/**
 * Find a named range in a document.
 * @param {Object} document - Document data from getDocument
 * @param {string} rangeName - Name of the range to find
 * @returns {{startIndex: number, endIndex: number} | null} - Range indices or null if not found
 */
export function findNamedRange(document, rangeName) {
  const namedRanges = document.namedRanges?.[rangeName];
  if (!namedRanges || namedRanges.namedRanges.length === 0) {
    return null;
  }

  // Get the first named range with this name
  const range = namedRanges.namedRanges[0];
  const ranges = range.ranges || [];

  if (ranges.length === 0) {
    return null;
  }

  // Return the span covering all ranges
  const startIndex = Math.min(...ranges.map(r => r.startIndex));
  const endIndex = Math.max(...ranges.map(r => r.endIndex));

  return {
    startIndex,
    endIndex,
    namedRangeId: range.namedRangeId,
  };
}

/**
 * Find the first table in a document.
 * @param {Object} document - Document data from getDocument
 * @returns {{startIndex: number, endIndex: number} | null} - Table indices or null if not found
 */
export function findFirstTable(document) {
  const content = document.body?.content || [];

  for (const element of content) {
    if (element.table) {
      return {
        startIndex: element.startIndex,
        endIndex: element.endIndex,
      };
    }
  }

  return null;
}

/**
 * Build requests to create a metadata table with grant data.
 * @param {Object} grant - Grant data object
 * @param {number} insertIndex - Index to insert the table at
 * @returns {{requests: Object[], tableEndIndex: number}} - Requests and estimated end index
 */
export function buildMetadataTableRequests(grant, insertIndex) {
  // Define the metadata fields to display
  const metadataFields = [
    { label: 'Grant ID', value: grant.ID || '' },
    { label: 'Title', value: grant.Title || '' },
    { label: 'Organization', value: grant.Organization || '' },
    { label: 'Status', value: grant.Status || '' },
    { label: 'Amount', value: grant.Amount ? `$${Number(grant.Amount).toLocaleString()}` : '' },
    { label: 'Year', value: grant.Year?.toString() || '' },
    { label: 'Primary Contact', value: grant.Primary_Contact || '' },
    { label: 'Beneficiary', value: grant.Beneficiary || '' },
    { label: 'Tags', value: grant.Tags || '' },
  ];

  const rows = metadataFields.length;
  const cols = 2;

  const requests = [];

  // Insert the table
  requests.push({
    insertTable: {
      rows,
      columns: cols,
      location: { index: insertIndex },
    },
  });

  return { requests, rows, cols, metadataFields };
}

/**
 * Build requests to populate table cells with data.
 * Table must already exist. This finds cell indices and inserts text.
 * @param {Object} document - Document data (after table insertion)
 * @param {Object[]} metadataFields - Array of {label, value} objects
 * @returns {Object[]} - Requests to populate cells
 */
export function buildTablePopulationRequests(document, metadataFields) {
  const table = findFirstTable(document);
  if (!table) {
    throw new Error('No table found in document');
  }

  // Find the table element in the document
  const content = document.body?.content || [];
  let tableElement = null;

  for (const element of content) {
    if (element.table && element.startIndex === table.startIndex) {
      tableElement = element.table;
      break;
    }
  }

  if (!tableElement) {
    throw new Error('Could not find table element');
  }

  const requests = [];

  // Iterate through rows and cells to insert text
  // We need to go in reverse order because insertions shift indices
  for (let rowIdx = tableElement.tableRows.length - 1; rowIdx >= 0; rowIdx--) {
    const row = tableElement.tableRows[rowIdx];
    const fieldData = metadataFields[rowIdx];

    if (!fieldData) continue;

    // Process cells in reverse order (value first, then label)
    for (let cellIdx = row.tableCells.length - 1; cellIdx >= 0; cellIdx--) {
      const cell = row.tableCells[cellIdx];
      const text = cellIdx === 0 ? fieldData.label : fieldData.value;

      // Find the paragraph inside the cell
      const cellContent = cell.content || [];
      for (const para of cellContent) {
        if (para.paragraph) {
          // Insert text at the start of the paragraph
          const insertIdx = para.startIndex;

          if (text) {
            requests.push({
              insertText: {
                location: { index: insertIdx },
                text: text,
              },
            });

            // Bold the label column
            if (cellIdx === 0) {
              requests.push({
                updateTextStyle: {
                  range: {
                    startIndex: insertIdx,
                    endIndex: insertIdx + text.length,
                  },
                  textStyle: { bold: true },
                  fields: 'bold',
                },
              });
            }
          }
          break;
        }
      }
    }
  }

  return requests;
}

/**
 * Initialize a Tracker document with metadata table.
 * Creates the table and named range.
 * @param {string} accessToken - OAuth access token
 * @param {string} documentId - Document ID
 * @param {Object} grant - Grant data object
 * @returns {Promise<void>}
 */
export async function initializeTrackerDoc(accessToken, documentId, grant) {
  // First, insert the table structure
  const { requests: tableRequests, rows, metadataFields } = buildMetadataTableRequests(grant, 1);

  await batchUpdate(accessToken, documentId, tableRequests);

  // Get the updated document to find table indices
  const doc = await getDocument(accessToken, documentId);

  // Populate the table cells
  const populateRequests = buildTablePopulationRequests(doc, metadataFields);

  if (populateRequests.length > 0) {
    await batchUpdate(accessToken, documentId, populateRequests);
  }

  // Get document again to find final table bounds for named range
  const finalDoc = await getDocument(accessToken, documentId);
  const tableRange = findFirstTable(finalDoc);

  if (tableRange) {
    // Create the named range around the table
    await batchUpdate(accessToken, documentId, [{
      createNamedRange: {
        name: METADATA_RANGE_NAME,
        range: {
          startIndex: tableRange.startIndex,
          endIndex: tableRange.endIndex,
        },
      },
    }]);
  }
}

/**
 * Update the metadata table in a Tracker document.
 * Finds existing table (via named range or first table), deletes it,
 * and recreates with updated data.
 * @param {string} accessToken - OAuth access token
 * @param {string} documentId - Document ID
 * @param {Object} grant - Grant data object
 * @returns {Promise<void>}
 */
export async function updateTrackerDoc(accessToken, documentId, grant) {
  const doc = await getDocument(accessToken, documentId);

  // Try to find the named range first
  let range = findNamedRange(doc, METADATA_RANGE_NAME);
  let insertIndex = 1;

  if (range) {
    // Delete the named range first (it will be recreated)
    await batchUpdate(accessToken, documentId, [{
      deleteNamedRange: {
        namedRangeId: range.namedRangeId,
      },
    }]);

    // Delete the content in the range
    await batchUpdate(accessToken, documentId, [{
      deleteContentRange: {
        range: {
          startIndex: range.startIndex,
          endIndex: range.endIndex,
        },
      },
    }]);

    insertIndex = range.startIndex;
  } else {
    // No named range - check for existing table
    const existingTable = findFirstTable(doc);

    if (existingTable) {
      // Delete the existing table
      await batchUpdate(accessToken, documentId, [{
        deleteContentRange: {
          range: {
            startIndex: existingTable.startIndex,
            endIndex: existingTable.endIndex,
          },
        },
      }]);
      insertIndex = existingTable.startIndex;
    }
  }

  // Now create the new table at the determined position
  const { requests: tableRequests, metadataFields } = buildMetadataTableRequests(grant, insertIndex);

  await batchUpdate(accessToken, documentId, tableRequests);

  // Get updated document and populate cells
  const updatedDoc = await getDocument(accessToken, documentId);
  const populateRequests = buildTablePopulationRequests(updatedDoc, metadataFields);

  if (populateRequests.length > 0) {
    await batchUpdate(accessToken, documentId, populateRequests);
  }

  // Create the named range
  const finalDoc = await getDocument(accessToken, documentId);
  const tableRange = findFirstTable(finalDoc);

  if (tableRange) {
    await batchUpdate(accessToken, documentId, [{
      createNamedRange: {
        name: METADATA_RANGE_NAME,
        range: {
          startIndex: tableRange.startIndex,
          endIndex: tableRange.endIndex,
        },
      },
    }]);
  }
}

/**
 * Sync a grant's data to its Tracker document.
 * Initializes or updates the metadata table as needed.
 * @param {string} accessToken - OAuth access token
 * @param {string} trackerUrl - Tracker document URL
 * @param {Object} grant - Grant data object
 * @returns {Promise<void>}
 */
export async function syncGrantToTrackerDoc(accessToken, trackerUrl, grant) {
  // Extract document ID from URL
  const match = trackerUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) {
    throw new Error('Invalid Tracker document URL');
  }

  const documentId = match[1];

  // Check if document has the metadata table
  const doc = await getDocument(accessToken, documentId);
  const existingRange = findNamedRange(doc, METADATA_RANGE_NAME);
  const existingTable = findFirstTable(doc);

  if (existingRange || existingTable) {
    // Update existing table
    await updateTrackerDoc(accessToken, documentId, grant);
  } else {
    // Initialize new table
    await initializeTrackerDoc(accessToken, documentId, grant);
  }
}
