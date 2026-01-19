/**
 * Simple hash-based router for GitHub Pages SPA.
 * Routes: #/, #/grants, #/grant/:id
 */

// Reactive state
let currentPath = $state(window.location.hash.slice(1) || '/');
let params = $state({});

/**
 * Parse the current hash and extract route info.
 */
function parseHash() {
  const hash = window.location.hash.slice(1) || '/';
  currentPath = hash;
  params = {};

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
 * @returns {string} - 'dashboard', 'grants', 'grant-detail', or 'not-found'
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
  get route() {
    return getRoute();
  },
  navigate,
};
