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
};
