/**
 * User authentication state store using Svelte 5 runes.
 * Manages user session, tokens, and team member validation.
 *
 * Credentials are cached in sessionStorage for persistence across page refreshes.
 * On page load, attempts silent token refresh to restore session.
 */

import {
  initializeGoogleAuth,
  signIn as authSignIn,
  signOut as authSignOut,
  getUserInfo,
  scheduleTokenRefresh,
  cancelTokenRefresh,
  refreshToken,
} from '../api/auth.js';

// Storage key for cached session
const SESSION_CACHE_KEY = 'grant_tracker_session';

// Reactive state
let user = $state(null);
let accessToken = $state(null);
let isLoading = $state(true);
let error = $state(null);

// Derived state
const isAuthenticated = $derived(user !== null && accessToken !== null);

// Client ID from environment
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

/**
 * Save session to sessionStorage.
 */
function cacheSession(userInfo, token) {
  try {
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
      user: userInfo,
      timestamp: Date.now(),
    }));
  } catch (e) {
    // sessionStorage might be unavailable (private browsing, etc.)
    console.warn('Could not cache session:', e);
  }
}

/**
 * Load cached session from sessionStorage.
 */
function loadCachedSession() {
  try {
    const cached = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn('Could not load cached session:', e);
  }
  return null;
}

/**
 * Clear cached session from sessionStorage.
 */
function clearCachedSession() {
  try {
    sessionStorage.removeItem(SESSION_CACHE_KEY);
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Initialize the auth system.
 * Loads GSI library and attempts to restore cached session.
 */
async function initialize() {
  isLoading = true;
  error = null;

  try {
    if (!clientId) {
      throw new Error('Missing VITE_GOOGLE_CLIENT_ID in environment');
    }
    await initializeGoogleAuth(clientId);

    // Try to restore cached session
    const cached = loadCachedSession();
    if (cached?.user) {
      // Attempt silent token refresh
      try {
        const tokenData = await refreshToken();
        accessToken = tokenData.access_token;
        user = cached.user;

        // Schedule automatic refresh
        scheduleTokenRefresh(
          tokenData.expires_in,
          handleTokenRefresh,
          handleTokenRefreshError
        );

        console.log('Session restored for:', user.email);
      } catch (refreshErr) {
        // Silent refresh failed - user needs to sign in again
        console.log('Could not restore session, sign-in required');
        clearCachedSession();
      }
    }
  } catch (err) {
    error = err.message;
  } finally {
    isLoading = false;
  }
}

/**
 * Sign in with Google.
 * Fetches user info and caches session for persistence.
 */
async function signIn() {
  isLoading = true;
  error = null;

  try {
    const tokenData = await authSignIn();
    accessToken = tokenData.access_token;

    // Fetch user profile
    const userInfo = await getUserInfo(accessToken);
    user = userInfo;

    // Cache session for page refresh persistence
    cacheSession(userInfo, accessToken);

    // Schedule automatic token refresh
    scheduleTokenRefresh(
      tokenData.expires_in,
      handleTokenRefresh,
      handleTokenRefreshError
    );

    return userInfo;
  } catch (err) {
    error = err.message;
    accessToken = null;
    user = null;
    throw err;
  } finally {
    isLoading = false;
  }
}

/**
 * Sign out and clear all auth state.
 */
async function signOut() {
  try {
    await authSignOut(accessToken);
  } finally {
    cancelTokenRefresh();
    clearCachedSession();
    user = null;
    accessToken = null;
    error = null;
  }
}

/**
 * Validate user against team member allowlist.
 * @param {string[]} allowedEmails - List of allowed email addresses
 * @returns {boolean} - True if user is allowed
 */
function validateTeamMember(allowedEmails) {
  if (!user?.email) {
    return false;
  }

  const isAllowed = allowedEmails.some(
    (email) => email.toLowerCase() === user.email.toLowerCase()
  );

  if (!isAllowed) {
    error = 'You are not authorized to access this application. Please contact your administrator.';
  }

  return isAllowed;
}

/**
 * Set an access denied error (for external validation).
 * @param {string} message - Error message to display
 */
function setAccessDenied(message) {
  error = message || 'Access denied';
}

/**
 * Clear any existing error.
 */
function clearError() {
  error = null;
}

/**
 * Handle successful token refresh.
 */
function handleTokenRefresh(tokenData) {
  accessToken = tokenData.access_token;
}

/**
 * Handle token refresh failure.
 */
function handleTokenRefreshError(err) {
  // Token refresh failed silently - user will need to re-authenticate
  // on next API call. Don't clear state yet to allow graceful handling.
  console.warn('Token refresh failed:', err.message);
}

// Export the store interface
export const userStore = {
  // State getters (reactive)
  get user() {
    return user;
  },
  get accessToken() {
    return accessToken;
  },
  get isLoading() {
    return isLoading;
  },
  get error() {
    return error;
  },
  get isAuthenticated() {
    return isAuthenticated;
  },

  // Actions
  initialize,
  signIn,
  signOut,
  validateTeamMember,
  setAccessDenied,
  clearError,
};
