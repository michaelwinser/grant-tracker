/**
 * Data models and type definitions for Grant Tracker.
 * Uses JSDoc for type annotations (works with VS Code IntelliSense).
 */

/**
 * Grant status values representing the pipeline stages.
 * @readonly
 * @enum {string}
 */
export const GrantStatus = {
  INITIAL_CONTACT: 'Initial Contact',
  EVALUATION_MEETING: 'Evaluation Meeting',
  PROPOSAL_DEVELOPMENT: 'Proposal Development',
  STAKEHOLDER_REVIEW: 'Stakeholder Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  DEFERRED: 'Deferred',
  NOTIFICATION: 'Notification',
  SIGNING: 'Signing',
  DISBURSEMENT: 'Disbursement',
  ACTIVE: 'Active',
  FINISHED: 'Finished',
};

/**
 * All status values in pipeline order.
 * @type {string[]}
 */
export const GRANT_STATUS_ORDER = [
  GrantStatus.INITIAL_CONTACT,
  GrantStatus.EVALUATION_MEETING,
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
 * "Active" pipeline statuses (not rejected/deferred/finished).
 * @type {string[]}
 */
export const ACTIVE_STATUSES = [
  GrantStatus.INITIAL_CONTACT,
  GrantStatus.EVALUATION_MEETING,
  GrantStatus.PROPOSAL_DEVELOPMENT,
  GrantStatus.STAKEHOLDER_REVIEW,
  GrantStatus.APPROVED,
  GrantStatus.NOTIFICATION,
  GrantStatus.SIGNING,
  GrantStatus.DISBURSEMENT,
  GrantStatus.ACTIVE,
];

/**
 * Grant type values.
 * @readonly
 * @enum {string}
 */
export const GrantType = {
  GRANT: 'Grant',
  CONTRACT: 'Contract',
};

/**
 * Action item status values.
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
 * @typedef {Object} Grant
 * @property {string} grant_id - Primary identifier (e.g., "PYPI-2026-Packaging")
 * @property {string} title - Human-readable name
 * @property {string} organization - Grantee/vendor organization
 * @property {string} [contact_name] - Primary contact person
 * @property {string} [contact_email] - Contact email
 * @property {string} type - "Grant" or "Contract"
 * @property {number} [category_a_pct] - % allocation to Category A
 * @property {number} [category_b_pct] - % allocation to Category B
 * @property {number} [category_c_pct] - % allocation to Category C
 * @property {number} [category_d_pct] - % allocation to Category D
 * @property {string} [ecosystem] - Ecosystem beneficiary
 * @property {number} [amount] - Grant/contract value
 * @property {number} [grant_year] - Year of work
 * @property {string} status - Current pipeline stage
 * @property {string} [proposal_doc_url] - Link to collaborative proposal
 * @property {string} [internal_notes_url] - Link to private notes doc
 * @property {string} [drive_folder_url] - Link to grant folder
 * @property {string} [github_repo] - Repo for monthly reports
 * @property {string} [created_at] - When record created
 * @property {string} [updated_at] - Last modification
 * @property {string} [status_changed_at] - When status last changed
 * @property {string} [notes] - Free-form notes
 */

/**
 * @typedef {Object} ActionItem
 * @property {string} item_id - Unique identifier (e.g., "AI-00001")
 * @property {string} grant_id - Foreign key to grant
 * @property {string} description - What needs to be done
 * @property {string} [assignee] - Who's responsible
 * @property {string} [due_date] - When it's due (YYYY-MM-DD)
 * @property {string} status - "Open", "Done", or "Cancelled"
 * @property {string} [source] - Where this came from
 * @property {string} [created_at] - When created
 * @property {string} [completed_at] - When marked done
 */

/**
 * @typedef {Object} Report
 * @property {string} report_id - Unique identifier (e.g., "RPT-00001")
 * @property {string} grant_id - Foreign key to grant
 * @property {string} period - "2025-01" (monthly), "2025-Q1" (quarterly), "2025" (annual)
 * @property {string} report_type - "Monthly", "Quarterly", or "Annual"
 * @property {string} status - "Expected", "Received", or "Overdue"
 * @property {string} [due_date] - When expected (YYYY-MM-DD)
 * @property {string} [received_date] - When actually received
 * @property {string} [url] - Link to report
 * @property {string} [notes] - Notes
 */

/**
 * @typedef {Object} Artifact
 * @property {string} artifact_id - Unique identifier (e.g., "ART-00001")
 * @property {string} grant_id - Foreign key to grant
 * @property {string} artifact_type - Type of artifact
 * @property {string} title - Artifact title
 * @property {string} url - Link to artifact
 * @property {string} [date] - Publication/creation date
 * @property {string} [added_by] - Who added this
 * @property {string} [created_at] - When record created
 */

/**
 * @typedef {Object} StatusHistoryEntry
 * @property {string} history_id - Unique identifier
 * @property {string} grant_id - Foreign key to grant
 * @property {string} [from_status] - Previous status
 * @property {string} to_status - New status
 * @property {string} changed_by - User email
 * @property {string} changed_at - When changed
 * @property {string} [notes] - Optional context
 */

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
