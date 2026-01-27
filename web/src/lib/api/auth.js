/**
 * Authentication module supporting both server-side and client-side OAuth.
 *
 * Server-side auth (Cloud Run):
 * - Uses HTTP-only cookies for refresh tokens
 * - Server handles OAuth flow with Google
 * - More secure, no popup windows
 *
 * Client-side auth (Static hosting / user preference):
 * - Uses Google Sign-In library with popup
 * - Tokens stored in localStorage
 * - Works on static hosting (GitHub Pages)
 */

import { configStore } from '../stores/config.svelte.js';

let refreshTimeoutId = null;
let googleAuthInitialized = false;
let googleAuthPromise = null;

// Auth mode: 'server' | 'client' | null (auto-detect)
const AUTH_MODE_KEY = 'gt_auth_mode';

// Extended scope preference
const EXTENDED_SCOPE_KEY = 'gt_extended_scope';

// OAuth scopes
const BASE_SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file';
const EXTENDED_SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly';

/**
 * Get the user's preferred auth mode from localStorage.
 * Returns null if no preference set (auto-detect).
 */
export function getAuthModePreference() {
  return localStorage.getItem(AUTH_MODE_KEY);
}

/**
 * Set the user's preferred auth mode.
 * @param {'server'|'client'|null} mode - The preferred mode, or null to clear
 */
export function setAuthModePreference(mode) {
  if (mode) {
    localStorage.setItem(AUTH_MODE_KEY, mode);
  } else {
    localStorage.removeItem(AUTH_MODE_KEY);
  }
}

/**
 * Get whether extended file access (drive.readonly) is enabled.
 * @returns {boolean}
 */
export function hasExtendedScope() {
  return localStorage.getItem(EXTENDED_SCOPE_KEY) === 'true';
}

/**
 * Set the extended scope preference.
 * @param {boolean} enabled
 */
export function setExtendedScope(enabled) {
  if (enabled) {
    localStorage.setItem(EXTENDED_SCOPE_KEY, 'true');
  } else {
    localStorage.removeItem(EXTENDED_SCOPE_KEY);
  }
}

/**
 * Determine which auth mode to use.
 * Priority: user preference > server availability > client-only
 */
export function getAuthMode() {
  const preference = getAuthModePreference();

  // If user has a preference and it's valid, use it
  if (preference === 'client') {
    return 'client';
  }
  if (preference === 'server' && configStore.serverAuthAvailable) {
    return 'server';
  }

  // Auto-detect based on server availability
  return configStore.serverAuthAvailable ? 'server' : 'client';
}

// ============================================
// Server-side auth (cookies)
// ============================================

/**
 * Get the access token from the cookie (server mode).
 * @returns {string|null} The access token or null if not found
 */
export function getAccessToken() {
  // Check server cookie first
  const cookieMatch = document.cookie.match(/(?:^|; )gt_access_token=([^;]*)/);
  if (cookieMatch) {
    return decodeURIComponent(cookieMatch[1]);
  }

  // Fall back to localStorage for client mode
  return localStorage.getItem('gt_access_token');
}

/**
 * Get user info from cookie or localStorage.
 * @returns {Object|null} User info { email, name, picture } or null
 */
export function getUserFromCookie() {
  // Try cookie first (server mode)
  const cookieMatch = document.cookie.match(/(?:^|; )gt_user=([^;]*)/);
  if (cookieMatch) {
    try {
      const decoded = atob(decodeURIComponent(cookieMatch[1]));
      return JSON.parse(decoded);
    } catch {
      // Fall through
    }
  }

  // Try localStorage (client mode)
  const stored = localStorage.getItem('gt_user');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Fall through
    }
  }

  return null;
}

/**
 * Check if the user is authenticated.
 * @returns {boolean}
 */
export function isAuthenticated() {
  return getAccessToken() !== null;
}

/**
 * Initialize authentication state.
 * Checks for existing cookies/storage and returns user state.
 * @returns {Promise<{authenticated: boolean, user: Object|null, accessToken: string|null}>}
 */
export async function initializeAuth() {
  const accessToken = getAccessToken();
  const user = getUserFromCookie();

  if (accessToken && user) {
    return {
      authenticated: true,
      user,
      accessToken,
    };
  }

  // Try to refresh if we have a server refresh token
  if (configStore.serverAuthAvailable) {
    try {
      const tokenData = await refreshToken();
      const refreshedUser = getUserFromCookie();
      return {
        authenticated: true,
        user: refreshedUser,
        accessToken: tokenData.access_token,
      };
    } catch {
      // No valid session
    }
  }

  return {
    authenticated: false,
    user: null,
    accessToken: null,
  };
}

/**
 * Redirect to server-side sign in.
 * The server handles the OAuth flow and sets cookies.
 */
export function signIn() {
  window.location.href = '/auth/login';
}

/**
 * Sign out - handles both server and client mode.
 * @returns {Promise<void>}
 */
export async function signOut() {
  cancelTokenRefresh();

  // Clear server cookies
  if (configStore.serverAuthAvailable) {
    try {
      await fetch('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors
    }
  }

  // Clear client-side storage
  localStorage.removeItem('gt_access_token');
  localStorage.removeItem('gt_user');
  localStorage.removeItem('gt_token_expiry');

  // Reload to reset state
  window.location.href = '/';
}

/**
 * Refresh the access token using the server.
 * The server uses the HttpOnly refresh_token cookie.
 * @returns {Promise<{access_token: string, expires_in: number}>}
 */
export async function refreshToken() {
  const response = await fetch('/auth/refresh', {
    method: 'POST',
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }

  return response.json();
}

// ============================================
// Client-side auth (Google Sign-In)
// ============================================

/**
 * Load the Google Sign-In API.
 * @returns {Promise<void>}
 */
function loadGoogleSignIn() {
  if (googleAuthPromise) {
    return googleAuthPromise;
  }

  googleAuthPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.google?.accounts) {
      googleAuthInitialized = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      googleAuthInitialized = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Google Sign-In'));
    document.head.appendChild(script);
  });

  return googleAuthPromise;
}

/**
 * Sign in using client-side Google Sign-In (popup).
 * @param {string} clientId - Google OAuth client ID
 * @param {Object} [options] - Options
 * @param {boolean} [options.extendedScope] - Request extended file access
 * @returns {Promise<{user: Object, accessToken: string}>}
 */
export async function signInClient(clientId, options = {}) {
  await loadGoogleSignIn();

  // Use extended scope if requested or if previously enabled
  const useExtended = options.extendedScope || hasExtendedScope();
  const scope = useExtended ? EXTENDED_SCOPES : BASE_SCOPES;

  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope,
      callback: async (tokenResponse) => {
        if (tokenResponse.error) {
          reject(new Error(tokenResponse.error));
          return;
        }

        try {
          // Fetch user info
          const user = await getUserInfo(tokenResponse.access_token);

          // Store in localStorage
          localStorage.setItem('gt_access_token', tokenResponse.access_token);
          localStorage.setItem('gt_user', JSON.stringify(user));
          localStorage.setItem(
            'gt_token_expiry',
            String(Date.now() + tokenResponse.expires_in * 1000)
          );

          // Set auth mode preference
          setAuthModePreference('client');

          // Track if extended scope was requested/granted
          if (options.extendedScope) {
            setExtendedScope(true);
          }

          resolve({
            user,
            accessToken: tokenResponse.access_token,
          });
        } catch (err) {
          reject(err);
        }
      },
    });

    client.requestAccessToken();
  });
}

/**
 * Request extended file access (drive.readonly scope).
 * This triggers a re-authentication with the additional scope.
 * @param {string} clientId - Google OAuth client ID
 * @returns {Promise<{user: Object, accessToken: string}>}
 */
export async function requestExtendedAccess(clientId) {
  return signInClient(clientId, { extendedScope: true });
}

/**
 * Revoke extended file access.
 * Clears the preference and triggers re-auth with base scope.
 * @param {string} clientId - Google OAuth client ID
 * @returns {Promise<{user: Object, accessToken: string}>}
 */
export async function revokeExtendedAccess(clientId) {
  setExtendedScope(false);

  await loadGoogleSignIn();

  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: BASE_SCOPES,
      callback: async (tokenResponse) => {
        if (tokenResponse.error) {
          reject(new Error(tokenResponse.error));
          return;
        }

        try {
          const user = await getUserInfo(tokenResponse.access_token);

          localStorage.setItem('gt_access_token', tokenResponse.access_token);
          localStorage.setItem('gt_user', JSON.stringify(user));
          localStorage.setItem(
            'gt_token_expiry',
            String(Date.now() + tokenResponse.expires_in * 1000)
          );

          setAuthModePreference('client');

          resolve({
            user,
            accessToken: tokenResponse.access_token,
          });
        } catch (err) {
          reject(err);
        }
      },
    });

    client.requestAccessToken();
  });
}

/**
 * Fetch user profile information from Google.
 * @param {string} accessToken - OAuth access token
 * @returns {Promise<{email: string, name: string, picture: string}>}
 */
export async function getUserInfo(accessToken) {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }

  const data = await response.json();
  return {
    email: data.email,
    name: data.name,
    picture: data.picture,
  };
}

// ============================================
// Token refresh scheduling
// ============================================

/**
 * Schedule automatic token refresh before expiry.
 * @param {number} expiresIn - Seconds until token expires
 * @param {function} onRefresh - Callback with new token data
 * @param {function} onError - Callback on refresh failure
 */
export function scheduleTokenRefresh(expiresIn, onRefresh, onError) {
  cancelTokenRefresh();

  // Refresh 5 minutes before expiry (or half the time if less than 10 min)
  const refreshBuffer = Math.min(300, Math.floor(expiresIn / 2));
  const refreshDelay = (expiresIn - refreshBuffer) * 1000;

  if (refreshDelay > 0) {
    refreshTimeoutId = setTimeout(async () => {
      try {
        const tokenData = await refreshToken();
        onRefresh(tokenData);
        // Schedule next refresh
        scheduleTokenRefresh(tokenData.expires_in, onRefresh, onError);
      } catch (error) {
        onError(error);
      }
    }, refreshDelay);
  }
}

/**
 * Cancel any scheduled token refresh.
 */
export function cancelTokenRefresh() {
  if (refreshTimeoutId) {
    clearTimeout(refreshTimeoutId);
    refreshTimeoutId = null;
  }
}

// Legacy exports for compatibility
export function initializeGoogleAuth() {
  return Promise.resolve();
}
