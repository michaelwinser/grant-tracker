/**
 * User authentication state store using Svelte 5 runes.
 * Manages user session, tokens, and team member validation.
 */

import {
  initializeGoogleAuth,
  signIn as authSignIn,
  signOut as authSignOut,
  getUserInfo,
  scheduleTokenRefresh,
  cancelTokenRefresh,
} from '../api/auth.js';

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
 * Initialize the auth system.
 * Loads GSI library but does not attempt auto-login (memory-only tokens).
 */
async function initialize() {
  isLoading = true;
  error = null;

  try {
    if (!clientId) {
      throw new Error('Missing VITE_GOOGLE_CLIENT_ID in environment');
    }
    await initializeGoogleAuth(clientId);
  } catch (err) {
    error = err.message;
  } finally {
    isLoading = false;
  }
}

/**
 * Sign in with Google.
 * Fetches user info and optionally validates against team allowlist.
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
