/**
 * Google Identity Services authentication module.
 * Handles OAuth token acquisition, refresh, and user info retrieval.
 */

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

let tokenClient = null;
let refreshTimeoutId = null;

/**
 * Initialize the Google Identity Services token client.
 * @param {string} clientId - Google OAuth client ID
 * @returns {Promise<void>}
 */
export function initializeGoogleAuth(clientId) {
  return new Promise((resolve, reject) => {
    // Wait for GSI library to load
    const checkGsi = () => {
      if (window.google?.accounts?.oauth2) {
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          callback: () => {}, // Will be set during signIn
        });
        resolve();
      } else {
        setTimeout(checkGsi, 100);
      }
    };

    // Timeout after 10 seconds
    const timeout = setTimeout(() => {
      reject(new Error('Google Identity Services failed to load'));
    }, 10000);

    checkGsi();
    // Clear timeout if resolved
    const originalResolve = resolve;
    resolve = () => {
      clearTimeout(timeout);
      originalResolve();
    };
  });
}

/**
 * Trigger the OAuth sign-in flow.
 * @returns {Promise<{access_token: string, expires_in: number}>}
 */
export function signIn() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Auth not initialized. Call initializeGoogleAuth first.'));
      return;
    }

    tokenClient.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error_description || response.error));
        return;
      }
      resolve({
        access_token: response.access_token,
        expires_in: response.expires_in,
      });
    };

    tokenClient.error_callback = (error) => {
      if (error.type === 'popup_blocked') {
        reject(new Error('Please allow popups for this site to sign in.'));
      } else if (error.type === 'popup_closed') {
        reject(new Error('Sign-in was cancelled.'));
      } else {
        reject(new Error(error.message || 'Sign-in failed'));
      }
    };

    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

/**
 * Request a new token without user interaction (for refresh).
 * @param {string} [loginHint] - User's email to help Google identify the session
 * @returns {Promise<{access_token: string, expires_in: number}>}
 */
export function refreshToken(loginHint) {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Auth not initialized'));
      return;
    }

    tokenClient.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error_description || response.error));
        return;
      }
      resolve({
        access_token: response.access_token,
        expires_in: response.expires_in,
      });
    };

    tokenClient.error_callback = (error) => {
      // Treat popup_closed and popup_blocked as silent failures
      // (user didn't want to re-auth, or browser blocked it)
      if (error.type === 'popup_closed' || error.type === 'popup_blocked') {
        reject(new Error('Silent refresh not available'));
      } else {
        reject(new Error(error.message || 'Token refresh failed'));
      }
    };

    // Request without prompt to silently refresh
    // login_hint helps Google find the right session
    const options = { prompt: '' };
    if (loginHint) {
      options.hint = loginHint;
    }
    tokenClient.requestAccessToken(options);
  });
}

/**
 * Revoke the current access token and sign out.
 * @param {string} accessToken - The token to revoke
 * @returns {Promise<void>}
 */
export function signOut(accessToken) {
  return new Promise((resolve) => {
    cancelTokenRefresh();

    if (accessToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(accessToken, () => {
        resolve();
      });
    } else {
      resolve();
    }
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
