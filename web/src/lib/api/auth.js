/**
 * Server-based authentication module.
 * Uses HTTP-only cookies for refresh tokens and regular cookies for access tokens.
 * The server handles the OAuth flow with Google.
 */

let refreshTimeoutId = null;

/**
 * Get the access token from the cookie.
 * @returns {string|null} The access token or null if not found
 */
export function getAccessToken() {
  const match = document.cookie.match(/(?:^|; )gt_access_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Get user info from the cookie.
 * @returns {Object|null} User info { email, name, picture } or null
 */
export function getUserFromCookie() {
  const match = document.cookie.match(/(?:^|; )gt_user=([^;]*)/);
  if (!match) return null;

  try {
    const decoded = atob(decodeURIComponent(match[1]));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Check if the user is authenticated (has valid cookies).
 * @returns {boolean}
 */
export function isAuthenticated() {
  return getAccessToken() !== null;
}

/**
 * Initialize authentication state.
 * Checks for existing cookies and returns user state.
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

  // If we have a refresh token cookie (HttpOnly, can't check directly),
  // try to refresh the access token
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
    return {
      authenticated: false,
      user: null,
      accessToken: null,
    };
  }
}

/**
 * Redirect to sign in.
 * The server handles the OAuth flow and sets cookies.
 */
export function signIn() {
  window.location.href = '/auth/login';
}

/**
 * Sign out by calling the server logout endpoint.
 * This clears all auth cookies.
 * @returns {Promise<void>}
 */
export async function signOut() {
  cancelTokenRefresh();

  try {
    await fetch('/auth/logout', { method: 'POST' });
  } catch {
    // Ignore errors - cookies might already be cleared
  }

  // Clear any client-side state and redirect
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

// Legacy exports for compatibility - these are no longer needed with server auth
// but kept to avoid breaking imports during transition
export function initializeGoogleAuth() {
  // No-op - server handles OAuth
  return Promise.resolve();
}
