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
 * Named range identifier for the approvals table.
 */
export const APPROVALS_RANGE_NAME = 'GRANT_TRACKER_APPROVALS';

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
  return findTableByIndex(document, 0);
}

/**
 * Find a heading paragraph by its text content.
 * @param {Object} document - Document data from getDocument
 * @param {string} headingText - Text to search for (trimmed comparison)
 * @returns {{startIndex: number, endIndex: number, isHeading: boolean} | null}
 */
export function findHeading(document, headingText) {
  const content = document.body?.content || [];

  for (const element of content) {
    if (element.paragraph) {
      const text = element.paragraph.elements?.[0]?.textRun?.content || '';
      if (text.trim() === headingText) {
        const style = element.paragraph.paragraphStyle?.namedStyleType || '';
        return {
          startIndex: element.startIndex,
          endIndex: element.endIndex,
          isHeading: style.startsWith('HEADING'),
        };
      }
    }
  }

  return null;
}

/**
 * Find a table by its position in the document.
 * @param {Object} document - Document data from getDocument
 * @param {number} tableIndex - 0-indexed position of the table
 * @returns {{startIndex: number, endIndex: number, tableElement: Object} | null}
 */
export function findTableByIndex(document, tableIndex) {
  const content = document.body?.content || [];
  let tableCount = 0;

  for (const element of content) {
    if (element.table) {
      if (tableCount === tableIndex) {
        return {
          startIndex: element.startIndex,
          endIndex: element.endIndex,
          tableElement: element.table,
        };
      }
      tableCount++;
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
 * Build requests to create an approvals table.
 * @param {string[]} approverNames - List of approver names
 * @param {number} insertIndex - Index to insert the table at
 * @returns {{requests: Object[], rows: number, cols: number, approvalFields: Object[]}}
 */
export function buildApprovalsTableRequests(approverNames, insertIndex) {
  // Build approval fields - one row per approver
  const approvalFields = approverNames.map(name => ({
    label: name,
    value: '', // Empty approval status initially
  }));

  const rows = approvalFields.length;
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

  return { requests, rows, cols, approvalFields };
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
 * Initialize a Tracker document with metadata and approvals tables.
 * Creates both tables with named ranges.
 * @param {string} accessToken - OAuth access token
 * @param {string} documentId - Document ID
 * @param {Object} grant - Grant data object
 * @param {string[]} [approvers] - Optional list of approver names
 * @returns {Promise<void>}
 */
export async function initializeTrackerDoc(accessToken, documentId, grant, approvers = []) {
  // First, insert "Status" heading
  await batchUpdate(accessToken, documentId, [
    { insertText: { location: { index: 1 }, text: 'Status\n' } },
  ]);

  // Get document and format as H1
  let doc = await getDocument(accessToken, documentId);
  await batchUpdate(accessToken, documentId, [{
    updateParagraphStyle: {
      range: { startIndex: 1, endIndex: 8 }, // "Status\n"
      paragraphStyle: { namedStyleType: 'HEADING_1' },
      fields: 'namedStyleType',
    },
  }]);

  // Get document to find insert position after heading
  doc = await getDocument(accessToken, documentId);
  const bodyEnd = doc.body?.content?.slice(-1)[0]?.endIndex || 1;

  // Insert the metadata table structure
  const { requests: tableRequests, metadataFields } = buildMetadataTableRequests(grant, bodyEnd - 1);

  await batchUpdate(accessToken, documentId, tableRequests);

  // Get the updated document to find table indices
  doc = await getDocument(accessToken, documentId);

  // Populate the metadata table cells
  const populateRequests = buildTablePopulationRequests(doc, metadataFields);

  if (populateRequests.length > 0) {
    await batchUpdate(accessToken, documentId, populateRequests);
  }

  // Get document again to find metadata section bounds (heading + table)
  doc = await getDocument(accessToken, documentId);
  const statusHeading = findHeading(doc, 'Status');
  const metadataTable = findFirstTable(doc);

  // Create named range for entire Status section (heading + table)
  if (statusHeading && metadataTable) {
    await batchUpdate(accessToken, documentId, [{
      createNamedRange: {
        name: METADATA_RANGE_NAME,
        range: {
          startIndex: statusHeading.startIndex,
          endIndex: metadataTable.endIndex,
        },
      },
    }]);
  }

  // Add approvals section if approvers provided
  if (approvers && approvers.length > 0) {
    // Get fresh document state
    doc = await getDocument(accessToken, documentId);

    // Find insert position (after metadata table + some space)
    const insertIndex = metadataTable ? metadataTable.endIndex : 1;

    // Insert heading
    await batchUpdate(accessToken, documentId, [
      { insertText: { location: { index: insertIndex }, text: '\nApprovals\n' } },
    ]);

    // Format as H1
    doc = await getDocument(accessToken, documentId);
    // Find the "Approvals" paragraph and format it
    const content = doc.body?.content || [];
    for (const element of content) {
      if (element.paragraph) {
        const text = element.paragraph.elements?.[0]?.textRun?.content || '';
        if (text.trim() === 'Approvals') {
          await batchUpdate(accessToken, documentId, [{
            updateParagraphStyle: {
              range: { startIndex: element.startIndex, endIndex: element.endIndex },
              paragraphStyle: { namedStyleType: 'HEADING_1' },
              fields: 'namedStyleType',
            },
          }]);
          break;
        }
      }
    }

    // Get document to find new insert position
    doc = await getDocument(accessToken, documentId);
    const bodyEnd = doc.body?.content?.slice(-1)[0]?.endIndex || 1;

    // Build and insert approvals table
    const { requests: approvalsRequests, approvalFields } = buildApprovalsTableRequests(approvers, bodyEnd - 1);

    await batchUpdate(accessToken, documentId, approvalsRequests);

    // Get document and populate approvals table
    doc = await getDocument(accessToken, documentId);
    const approvalsTable = findTableByIndex(doc, 1); // Second table

    if (approvalsTable && approvalsTable.tableElement) {
      const approvalsPopulateRequests = buildTablePopulationRequestsForTable(
        approvalsTable.tableElement,
        approvalFields
      );

      if (approvalsPopulateRequests.length > 0) {
        await batchUpdate(accessToken, documentId, approvalsPopulateRequests);
      }

      // Get final document state and create named range for entire Approvals section
      doc = await getDocument(accessToken, documentId);
      const approvalsHeading = findHeading(doc, 'Approvals');
      const finalApprovalsTable = findTableByIndex(doc, 1);

      if (approvalsHeading && finalApprovalsTable) {
        await batchUpdate(accessToken, documentId, [{
          createNamedRange: {
            name: APPROVALS_RANGE_NAME,
            range: {
              startIndex: approvalsHeading.startIndex,
              endIndex: finalApprovalsTable.endIndex,
            },
          },
        }]);
      }
    }
  }
}

/**
 * Build requests to populate a specific table's cells.
 * @param {Object} tableElement - The table element from document structure
 * @param {Object[]} fields - Array of {label, value} objects
 * @returns {Object[]} - Requests to populate cells
 */
function buildTablePopulationRequestsForTable(tableElement, fields) {
  const requests = [];

  // Iterate through rows and cells to insert text
  // We need to go in reverse order because insertions shift indices
  for (let rowIdx = tableElement.tableRows.length - 1; rowIdx >= 0; rowIdx--) {
    const row = tableElement.tableRows[rowIdx];
    const fieldData = fields[rowIdx];

    if (!fieldData) continue;

    // Process cells in reverse order (value first, then label)
    for (let cellIdx = row.tableCells.length - 1; cellIdx >= 0; cellIdx--) {
      const cell = row.tableCells[cellIdx];
      const text = cellIdx === 0 ? fieldData.label : fieldData.value;

      // Find the paragraph inside the cell
      const cellContent = cell.content || [];
      for (const para of cellContent) {
        if (para.paragraph) {
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
 * Update the metadata section (Status heading + table) in a Tracker document.
 * Finds existing section via named range, deletes it, and recreates with updated data.
 * @param {string} accessToken - OAuth access token
 * @param {string} documentId - Document ID
 * @param {Object} grant - Grant data object
 * @returns {Promise<void>}
 */
export async function updateTrackerDoc(accessToken, documentId, grant) {
  let doc = await getDocument(accessToken, documentId);

  // Find the named range (which includes heading + table)
  const range = findNamedRange(doc, METADATA_RANGE_NAME);
  let insertIndex = 1;

  if (range) {
    // Delete the named range first
    await batchUpdate(accessToken, documentId, [{
      deleteNamedRange: {
        namedRangeId: range.namedRangeId,
      },
    }]);

    // Delete the content in the range (heading + table)
    await batchUpdate(accessToken, documentId, [{
      deleteContentRange: {
        range: {
          startIndex: range.startIndex,
          endIndex: range.endIndex,
        },
      },
    }]);

    insertIndex = range.startIndex;
  }
  // If no named range, we insert at position 1 (start of document)

  // Insert "Status" heading
  await batchUpdate(accessToken, documentId, [
    { insertText: { location: { index: insertIndex }, text: 'Status\n' } },
  ]);

  // Format as H1
  doc = await getDocument(accessToken, documentId);
  const statusHeading = findHeading(doc, 'Status');
  if (statusHeading) {
    await batchUpdate(accessToken, documentId, [{
      updateParagraphStyle: {
        range: { startIndex: statusHeading.startIndex, endIndex: statusHeading.endIndex },
        paragraphStyle: { namedStyleType: 'HEADING_1' },
        fields: 'namedStyleType',
      },
    }]);
  }

  // Get fresh document state for table insertion
  doc = await getDocument(accessToken, documentId);
  const headingAfterFormat = findHeading(doc, 'Status');
  const tableInsertIndex = headingAfterFormat?.endIndex || (insertIndex + 7);

  // Create the table
  const { requests: tableRequests, metadataFields } = buildMetadataTableRequests(grant, tableInsertIndex);
  await batchUpdate(accessToken, documentId, tableRequests);

  // Populate the table cells
  doc = await getDocument(accessToken, documentId);
  const populateRequests = buildTablePopulationRequests(doc, metadataFields);
  if (populateRequests.length > 0) {
    await batchUpdate(accessToken, documentId, populateRequests);
  }

  // Create the named range covering heading + table
  doc = await getDocument(accessToken, documentId);
  const finalHeading = findHeading(doc, 'Status');
  const finalTable = findFirstTable(doc);

  if (finalHeading && finalTable) {
    await batchUpdate(accessToken, documentId, [{
      createNamedRange: {
        name: METADATA_RANGE_NAME,
        range: {
          startIndex: finalHeading.startIndex,
          endIndex: finalTable.endIndex,
        },
      },
    }]);
  }
}

/**
 * Ensure the metadata section (Status heading + table) exists and is up-to-date.
 * @param {string} accessToken - OAuth access token
 * @param {string} documentId - Document ID
 * @param {Object} grant - Grant data object
 * @returns {Promise<number>} - End index of the section
 */
async function ensureMetadataSection(accessToken, documentId, grant) {
  let doc = await getDocument(accessToken, documentId);
  const existingRange = findNamedRange(doc, METADATA_RANGE_NAME);

  if (existingRange) {
    // Section exists - update it (this recreates heading + table)
    await updateTrackerDoc(accessToken, documentId, grant);
    doc = await getDocument(accessToken, documentId);
    const updatedRange = findNamedRange(doc, METADATA_RANGE_NAME);
    return updatedRange?.endIndex || 1;
  }

  // Section doesn't exist - create it from scratch using updateTrackerDoc
  // (which handles creating heading + table + named range)
  await updateTrackerDoc(accessToken, documentId, grant);
  doc = await getDocument(accessToken, documentId);
  const newRange = findNamedRange(doc, METADATA_RANGE_NAME);
  return newRange?.endIndex || 1;
}

/**
 * Ensure the Approvals section (heading + table) exists.
 * If it exists, leaves it alone to preserve user edits. If missing, creates it.
 * @param {string} accessToken - OAuth access token
 * @param {string} documentId - Document ID
 * @param {string[]} approvers - List of approver names
 * @param {number} insertAfterIndex - Index to insert section after (if creating)
 * @returns {Promise<void>}
 */
async function ensureApprovalsSection(accessToken, documentId, approvers, insertAfterIndex) {
  let doc = await getDocument(accessToken, documentId);
  const existingRange = findNamedRange(doc, APPROVALS_RANGE_NAME);

  if (existingRange) {
    // Approvals section exists - leave it alone (don't overwrite user edits)
    return;
  }

  // Section doesn't exist - create heading + table

  // Insert heading
  await batchUpdate(accessToken, documentId, [
    { insertText: { location: { index: insertAfterIndex }, text: '\nApprovals\n' } },
  ]);

  // Format as H1
  doc = await getDocument(accessToken, documentId);
  const heading = findHeading(doc, 'Approvals');
  if (heading) {
    await batchUpdate(accessToken, documentId, [{
      updateParagraphStyle: {
        range: { startIndex: heading.startIndex, endIndex: heading.endIndex },
        paragraphStyle: { namedStyleType: 'HEADING_1' },
        fields: 'namedStyleType',
      },
    }]);
  }

  // Insert table at end of document
  doc = await getDocument(accessToken, documentId);
  const bodyEnd = doc.body?.content?.slice(-1)[0]?.endIndex || 1;
  const { requests: tableRequests, approvalFields } = buildApprovalsTableRequests(approvers, bodyEnd - 1);
  await batchUpdate(accessToken, documentId, tableRequests);

  // Populate the table
  doc = await getDocument(accessToken, documentId);
  const approvalsTable = findTableByIndex(doc, 1);

  if (approvalsTable && approvalsTable.tableElement) {
    const populateRequests = buildTablePopulationRequestsForTable(approvalsTable.tableElement, approvalFields);
    if (populateRequests.length > 0) {
      await batchUpdate(accessToken, documentId, populateRequests);
    }
  }

  // Create named range covering heading + table
  doc = await getDocument(accessToken, documentId);
  const finalHeading = findHeading(doc, 'Approvals');
  const finalTable = findTableByIndex(doc, 1);

  if (finalHeading && finalTable) {
    await batchUpdate(accessToken, documentId, [{
      createNamedRange: {
        name: APPROVALS_RANGE_NAME,
        range: {
          startIndex: finalHeading.startIndex,
          endIndex: finalTable.endIndex,
        },
      },
    }]);
  }
}

/**
 * Sync a grant's data to its Tracker document.
 * Recreates any missing sections (Status heading + table, Approvals heading + table).
 * @param {string} accessToken - OAuth access token
 * @param {string} trackerUrl - Tracker document URL
 * @param {Object} grant - Grant data object
 * @param {string[]} [approvers] - Optional list of approver names for recreating Approvals section
 * @returns {Promise<void>}
 */
export async function syncGrantToTrackerDoc(accessToken, trackerUrl, grant, approvers = []) {
  // Extract document ID from URL
  const match = trackerUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) {
    throw new Error('Invalid Tracker document URL');
  }

  const documentId = match[1];

  // Ensure Status section (heading + table) exists and is up-to-date
  const metadataEndIndex = await ensureMetadataSection(accessToken, documentId, grant);

  // If approvers provided, ensure Approvals section exists
  if (approvers && approvers.length > 0) {
    await ensureApprovalsSection(accessToken, documentId, approvers, metadataEndIndex);
  }
}
