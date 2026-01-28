/**
 * Reports store using Svelte 5 runes.
 * Manages report compliance tracking with CRUD operations and derived views.
 */

import { createUnifiedSheetsClient, isUsingBackendApi } from '../api/sheets-unified.js';
import { userStore } from './user.svelte.js';
import { spreadsheetStore } from './spreadsheet.svelte.js';
import { configStore } from './config.svelte.js';
import {
  normalizeRow,
  todayDate,
  generateId,
  ReportStatus,
} from '../models.js';

// Reactive state
let reports = $state([]);
let isLoading = $state(false);
let error = $state(null);
let lastLoaded = $state(null);

// Derived state
const overdueReports = $derived(() => {
  const today = todayDate();
  return reports.filter(
    (report) =>
      report.status === ReportStatus.EXPECTED &&
      report.due_date &&
      report.due_date < today
  );
});

const expectedReports = $derived(
  reports.filter((report) => report.status === ReportStatus.EXPECTED)
);

const receivedReports = $derived(
  reports.filter((report) => report.status === ReportStatus.RECEIVED)
);

const reportsByGrant = $derived(() => {
  const grouped = {};
  for (const report of reports) {
    const grantId = report.grant_id || '_ungrouped';
    if (!grouped[grantId]) {
      grouped[grantId] = [];
    }
    grouped[grantId].push(report);
  }
  return grouped;
});

const reportsDueThisMonth = $derived(() => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const monthPrefix = `${year}-${month}`;

  return reports.filter(
    (report) =>
      report.status === ReportStatus.EXPECTED &&
      report.due_date?.startsWith(monthPrefix)
  );
});

/**
 * Get a sheets client instance.
 * Uses backend API when service account is enabled, otherwise direct Google API.
 * @returns {Object}
 */
function getClient() {
  // When using backend API, we don't need spreadsheetId from user selection
  if (isUsingBackendApi()) {
    if (!userStore.accessToken) {
      throw new Error('Not authenticated');
    }
    return createUnifiedSheetsClient(userStore.accessToken, configStore.spreadsheetId);
  }

  // Direct API mode - need user-selected spreadsheet
  if (!userStore.accessToken || !spreadsheetStore.spreadsheetId) {
    throw new Error('Not authenticated or no spreadsheet selected');
  }
  return createUnifiedSheetsClient(userStore.accessToken, spreadsheetStore.spreadsheetId);
}

/**
 * Load all reports from the spreadsheet.
 * @returns {Promise<void>}
 */
async function load() {
  isLoading = true;
  error = null;

  try {
    const client = getClient();
    const rows = await client.readSheet('Reports');
    reports = rows
      .map((row) => normalizeRow(row))
      .filter((row) => row.report_id); // Filter out empty rows
    lastLoaded = new Date();
  } catch (err) {
    error = err.message;
    throw err;
  } finally {
    isLoading = false;
  }
}

/**
 * Create a new expected report.
 * @param {Object} reportData - Report data (grant_id, period, report_type, due_date required)
 * @returns {Promise<Object>} - The created report
 */
async function create(reportData) {
  const newReport = {
    report_id: generateId('RPT'),
    status: ReportStatus.EXPECTED,
    ...reportData,
  };

  // Optimistic update
  const previousReports = [...reports];
  reports = [...reports, newReport];

  try {
    const client = getClient();
    await client.appendRow('Reports', newReport);
    return newReport;
  } catch (err) {
    // Rollback on failure
    reports = previousReports;
    error = err.message;
    throw err;
  }
}

/**
 * Update an existing report.
 * @param {string} reportId - Report ID to update
 * @param {Object} updates - Partial updates
 * @returns {Promise<Object>} - The updated report
 */
async function update(reportId, updates) {
  const index = reports.findIndex((report) => report.report_id === reportId);
  if (index === -1) {
    throw new Error(`Report not found: ${reportId}`);
  }

  const updatedReport = {
    ...reports[index],
    ...updates,
  };

  // Optimistic update
  const previousReports = [...reports];
  reports = reports.map((report) =>
    report.report_id === reportId ? updatedReport : report
  );

  try {
    const client = getClient();
    await client.updateById('Reports', 'report_id', reportId, updatedReport);
    return updatedReport;
  } catch (err) {
    // Rollback on failure
    reports = previousReports;
    error = err.message;
    throw err;
  }
}

/**
 * Mark a report as received.
 * @param {string} reportId - Report ID
 * @param {string} [receivedDate] - Date received (defaults to today)
 * @param {string} [url] - Optional URL to the report
 * @returns {Promise<Object>} - The updated report
 */
async function markReceived(reportId, receivedDate, url) {
  return update(reportId, {
    status: ReportStatus.RECEIVED,
    received_date: receivedDate || todayDate(),
    ...(url && { url }),
  });
}

/**
 * Mark a report as overdue.
 * @param {string} reportId - Report ID
 * @returns {Promise<Object>} - The updated report
 */
async function markOverdue(reportId) {
  return update(reportId, {
    status: ReportStatus.OVERDUE,
  });
}

/**
 * Reset a report to expected status.
 * @param {string} reportId - Report ID
 * @returns {Promise<Object>} - The updated report
 */
async function resetToExpected(reportId) {
  return update(reportId, {
    status: ReportStatus.EXPECTED,
    received_date: null,
    url: null,
  });
}

/**
 * Delete a report.
 * @param {string} reportId - Report ID to delete
 * @returns {Promise<void>}
 */
async function remove(reportId) {
  const index = reports.findIndex((report) => report.report_id === reportId);
  if (index === -1) {
    throw new Error(`Report not found: ${reportId}`);
  }

  // Optimistic update
  const previousReports = [...reports];
  reports = reports.filter((report) => report.report_id !== reportId);

  try {
    const client = getClient();
    await client.deleteById('Reports', 'report_id', reportId);
  } catch (err) {
    // Rollback on failure
    reports = previousReports;
    error = err.message;
    throw err;
  }
}

/**
 * Get a report by ID.
 * @param {string} reportId
 * @returns {Object|undefined}
 */
function getById(reportId) {
  return reports.find((report) => report.report_id === reportId);
}

/**
 * Get all reports for a grant.
 * @param {string} grantId
 * @returns {Object[]}
 */
function getByGrantId(grantId) {
  return reports.filter((report) => report.grant_id === grantId);
}

/**
 * Clear all data (on logout or spreadsheet switch).
 */
function clear() {
  reports = [];
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
export const reportsStore = {
  // State getters (reactive)
  get reports() {
    return reports;
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
  get overdueReports() {
    return overdueReports;
  },
  get expectedReports() {
    return expectedReports;
  },
  get receivedReports() {
    return receivedReports;
  },
  get reportsByGrant() {
    return reportsByGrant;
  },
  get reportsDueThisMonth() {
    return reportsDueThisMonth;
  },

  // Actions
  load,
  create,
  update,
  markReceived,
  markOverdue,
  resetToExpected,
  remove,
  getById,
  getByGrantId,
  clear,
  clearError,
};
