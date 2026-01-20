/**
 * Data models and type definitions for Grant Tracker.
 * Uses JSDoc for type annotations (works with VS Code IntelliSense).
 *
 * NOTE: Status values are now loaded dynamically from the Status sheet.
 * Use grantsStore.statusValues instead of these constants for dropdowns.
 * These constants are kept for reference and fallback.
 */

/**
 * Grant status values representing the pipeline stages.
 * NOTE: These may not match actual values in the spreadsheet.
 * Prefer using grantsStore.statusValues for dynamic values.
 * @readonly
 * @enum {string}
 */
export const GrantStatus = {
  INITIAL_CONTACT: 'Initial Contact',
  MEETING: 'Meeting',
  PROPOSAL_DEVELOPMENT: 'Proposal Development',
  STAKEHOLDER_REVIEW: 'Stakeholder Review',
  APPROVED: 'Approved',
  NOTIFICATION: 'Notification',
  SIGNING: 'Signing',
  DISBURSEMENT: 'Disbursement',
  ACTIVE: 'Active',
  FINISHED: 'Finished',
  REJECTED: 'Rejected',
  DEFERRED: 'Deferred',
};

/**
 * All status values in pipeline order.
 * NOTE: Prefer using grantsStore.statusValues for dynamic values.
 * @type {string[]}
 */
export const GRANT_STATUS_ORDER = [
  GrantStatus.INITIAL_CONTACT,
  GrantStatus.MEETING,
  GrantStatus.PROPOSAL_DEVELOPMENT,
  GrantStatus.STAKEHOLDER_REVIEW,
  GrantStatus.APPROVED,
  GrantStatus.NOTIFICATION,
  GrantStatus.SIGNING,
  GrantStatus.DISBURSEMENT,
  GrantStatus.ACTIVE,
  GrantStatus.FINISHED,
  GrantStatus.REJECTED,
  GrantStatus.DEFERRED,
];

/**
 * Terminal statuses (not in active pipeline).
 * @type {string[]}
 */
export const TERMINAL_STATUSES = [
  GrantStatus.FINISHED,
  GrantStatus.REJECTED,
  GrantStatus.DEFERRED,
];

/**
 * @typedef {Object} Grant
 * @property {string} ID - Primary identifier (e.g., "PYPI-2026-Packaging")
 * @property {string} Title - Human-readable name
 * @property {string} Organization - Grantee/vendor organization
 * @property {string} Status - Current pipeline stage
 * @property {number} [Amount] - Grant/contract value
 * @property {string} [Primary_Contact] - Primary contact person
 * @property {string} [Other_Contacts] - Additional contacts
 * @property {number} [Year] - Year of work
 * @property {string} [Beneficiary] - Ecosystem/project beneficiary
 * @property {string} [Tags] - Comma-separated tags
 * @property {number} [Cat_A_Percent] - % allocation to Category A
 * @property {number} [Cat_B_Percent] - % allocation to Category B
 * @property {number} [Cat_C_Percent] - % allocation to Category C
 * @property {number} [Cat_D_Percent] - % allocation to Category D
 */

// ============================================================================
// DEFERRED FEATURES - These types are kept for future phases but not used yet
// ============================================================================

/**
 * Action item status values.
 * DEFERRED: ActionItems feature is planned for a future phase.
 * @readonly
 * @enum {string}
 */
export const ActionItemStatus = {
  OPEN: 'Open',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

/**
 * Report type values.
 * DEFERRED: Reports feature is planned for a future phase.
 * @readonly
 * @enum {string}
 */
export const ReportType = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  ANNUAL: 'Annual',
};

/**
 * Report status values.
 * DEFERRED: Reports feature is planned for a future phase.
 * @readonly
 * @enum {string}
 */
export const ReportStatus = {
  EXPECTED: 'Expected',
  RECEIVED: 'Received',
  OVERDUE: 'Overdue',
};

/**
 * Artifact type values.
 * DEFERRED: Artifacts feature is planned for a future phase.
 * @readonly
 * @enum {string}
 */
export const ArtifactType = {
  BLOG_POST: 'Blog Post',
  MEETING_NOTES: 'Meeting Notes',
  ANNOUNCEMENT: 'Announcement',
  FINAL_REPORT: 'Final Report',
  OTHER: 'Other',
};

/**
 * Generate a unique ID with a prefix.
 * @param {string} prefix - ID prefix (e.g., "AI", "RPT", "ART")
 * @returns {string}
 */
export function generateId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${prefix}-${timestamp}${random}`.toUpperCase();
}

/**
 * Generate a grant ID from organization and title.
 * Format: CODE-YEAR-Codename (e.g., "PYPI-2026-Packaging")
 * @param {string} organization
 * @param {number} year
 * @param {string} title
 * @returns {string}
 */
export function generateGrantId(organization, year, title) {
  const code = extractOrgCode(organization);
  const codename = extractCodename(title);
  return `${code}-${year}-${codename}`;
}

/**
 * Extract a 2-4 letter code from an organization name.
 * @param {string} org
 * @returns {string}
 */
function extractOrgCode(org) {
  // Remove common suffixes
  const cleaned = org
    .replace(/\s+(Inc|LLC|Foundation|Project|Initiative)\.?$/i, '')
    .trim();

  // If short enough, use as-is
  if (cleaned.length <= 4) {
    return cleaned.toUpperCase();
  }

  // If multiple words, use initials
  const words = cleaned.split(/\s+/);
  if (words.length > 1) {
    return words
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 4);
  }

  // Single long word: take first 4 chars
  return cleaned.slice(0, 4).toUpperCase();
}

/**
 * Extract a codename from a grant title.
 * @param {string} title
 * @returns {string}
 */
function extractCodename(title) {
  const stopWords = new Set(['the', 'a', 'an', 'for', 'and', 'or', 'of', 'to', 'in']);
  const words = title.split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w.toLowerCase()));

  // Prefer longer words
  const sorted = words.sort((a, b) => b.length - a.length);
  const word = sorted[0] || 'Grant';

  // Capitalize first letter, lowercase rest
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Validate a grant ID format.
 * @param {string} id
 * @returns {boolean}
 */
export function isValidGrantId(id) {
  return /^[A-Z]{2,4}-\d{4}-[A-Za-z]+$/.test(id);
}

/**
 * Get current timestamp in ISO format.
 * @returns {string}
 */
export function nowTimestamp() {
  return new Date().toISOString();
}

/**
 * Get current date in YYYY-MM-DD format.
 * @returns {string}
 */
export function todayDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Parse a number from a cell value (handles currency formatting).
 * @param {any} value
 * @returns {number|null}
 */
export function parseNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  // Remove currency symbols and commas
  const cleaned = String(value).replace(/[$,]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Normalize a row object, parsing numbers and handling empty strings.
 * @param {Object} row - Raw row object from sheets
 * @param {string[]} numberFields - Fields that should be parsed as numbers
 * @returns {Object}
 */
export function normalizeRow(row, numberFields = []) {
  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === '' || value === undefined) {
      normalized[key] = null;
    } else if (numberFields.includes(key)) {
      normalized[key] = parseNumber(value);
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}
