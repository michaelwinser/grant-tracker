/**
 * Simple hash-based router for GitHub Pages SPA.
 * Routes: #/, #/grants, #/grant/:id
 */

// Reactive state
let currentPath = $state(window.location.hash.slice(1) || '/');
let params = $state({});
let query = $state({});

/**
 * Parse the current hash and extract route info.
 */
function parseHash() {
  let hash = window.location.hash.slice(1) || '/';
  params = {};
  query = {};

  // Parse query string if present
  const queryIndex = hash.indexOf('?');
  if (queryIndex !== -1) {
    const queryString = hash.slice(queryIndex + 1);
    hash = hash.slice(0, queryIndex);
    const searchParams = new URLSearchParams(queryString);
    for (const [key, value] of searchParams) {
      query[key] = value;
    }
  }

  currentPath = hash;

  // Match /grant/:id pattern
  const grantMatch = hash.match(/^\/grant\/(.+)$/);
  if (grantMatch) {
    params = { id: decodeURIComponent(grantMatch[1]) };
  }
}

// Initialize and listen for hash changes
if (typeof window !== 'undefined') {
  parseHash();
  window.addEventListener('hashchange', parseHash);
}

/**
 * Navigate to a new route.
 * @param {string} path - The path to navigate to
 */
export function navigate(path) {
  window.location.hash = path;
}

/**
 * Update query parameters on the current route.
 * @param {Object} updates - Key-value pairs to update (null/undefined values remove the key)
 */
export function updateQuery(updates) {
  const newQuery = { ...query };

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === '') {
      delete newQuery[key];
    } else {
      newQuery[key] = value;
    }
  }

  // Build the new URL
  const basePath = currentPath;
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(newQuery)) {
    searchParams.set(key, value);
  }

  const queryString = searchParams.toString();
  const newPath = queryString ? `${basePath}?${queryString}` : basePath;

  // Use replaceState to avoid cluttering history for filter changes
  window.history.replaceState(null, '', `#${newPath}`);
  parseHash();
}

/**
 * Get the current year.
 * @returns {number}
 */
export function getCurrentYear() {
  return new Date().getFullYear();
}

/**
 * Get the current route name.
 * @returns {string} - 'dashboard', 'grants', 'grant-detail', 'action-items', or 'not-found'
 */
export function getRoute() {
  if (currentPath === '/' || currentPath === '') {
    return 'dashboard';
  }
  if (currentPath === '/grants') {
    return 'grants';
  }
  if (currentPath.startsWith('/grant/')) {
    return 'grant-detail';
  }
  if (currentPath === '/action-items') {
    return 'action-items';
  }
  if (currentPath === '/reports') {
    return 'reports';
  }
  if (currentPath === '/budget') {
    return 'budget';
  }
  return 'not-found';
}

// Export reactive getters
export const router = {
  get path() {
    return currentPath;
  },
  get params() {
    return params;
  },
  get query() {
    return query;
  },
  get route() {
    return getRoute();
  },
  navigate,
  updateQuery,
  getCurrentYear,
};
