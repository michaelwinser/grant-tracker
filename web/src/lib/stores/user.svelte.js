/**
 * User authentication state store using Svelte 5 runes.
 * Manages user session using server-based OAuth with cookies.
 */

import {
  initializeAuth,
  signIn as authSignIn,
  signInClient,
  signOut as authSignOut,
  getAccessToken,
  getUserFromCookie,
  refreshToken,
  scheduleTokenRefresh,
  cancelTokenRefresh,
  getAuthMode,
} from '../api/auth.js';
import { configStore } from './config.svelte.js';

// Reactive state
let user = $state(null);
let accessToken = $state(null);
let isLoading = $state(true);
let error = $state(null);

// Derived state
const isAuthenticated = $derived(user !== null && accessToken !== null);

/**
 * Initialize the auth system.
 * Checks for existing session via cookies and attempts token refresh if needed.
 */
async function initialize() {
  isLoading = true;
  error = null;

  try {
    const authState = await initializeAuth();

    if (authState.authenticated) {
      user = authState.user;
      accessToken = authState.accessToken;

      // Schedule automatic token refresh
      // Default to 1 hour if we don't know the expiry
      scheduleTokenRefresh(
        3600,
        handleTokenRefresh,
        handleTokenRefreshError
      );

      console.log('Session restored for:', user?.email);
    } else {
      user = null;
      accessToken = null;
    }
  } catch (err) {
    console.error('Auth initialization error:', err);
    error = err.message;
    user = null;
    accessToken = null;
  } finally {
    isLoading = false;
  }
}

/**
 * Sign in with Google.
 * Uses server-side auth if available, otherwise uses client-side popup.
 */
async function signIn() {
  const authMode = getAuthMode();

  if (authMode === 'server') {
    // Server-side auth - redirect to login endpoint
    authSignIn();
  } else {
    // Client-side auth - use popup
    const clientId = configStore.clientId;
    if (!clientId) {
      throw new Error('No client ID configured');
    }

    const result = await signInClient(clientId);
    user = result.user;
    accessToken = result.accessToken;
    isLoading = false;
    error = null;
  }
}

/**
 * Sign out and clear all auth state.
 */
async function signOut() {
  cancelTokenRefresh();
  user = null;
  accessToken = null;
  error = null;

  // This will redirect to / after clearing cookies
  await authSignOut();
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
 * Set user directly (for client-side auth).
 * @param {Object} userData - User info { email, name, picture }
 * @param {string} token - Access token
 */
function setUser(userData, token) {
  user = userData;
  accessToken = token;
  isLoading = false;
  error = null;
}

/**
 * Handle successful token refresh.
 */
function handleTokenRefresh(tokenData) {
  accessToken = tokenData.access_token;
  // Also update user from cookie in case it was refreshed
  const cookieUser = getUserFromCookie();
  if (cookieUser) {
    user = cookieUser;
  }
}

/**
 * Handle token refresh failure.
 */
function handleTokenRefreshError(err) {
  console.warn('Token refresh failed:', err.message);
  // Token refresh failed - user will need to re-authenticate
  // Clear state to trigger sign-in
  user = null;
  accessToken = null;
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
  setUser,
  validateTeamMember,
  setAccessDenied,
  clearError,
};
