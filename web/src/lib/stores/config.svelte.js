/**
 * Application configuration store.
 * Fetches runtime config from the server, with fallback for static hosting.
 */

let config = $state({
  clientId: null,
  loaded: false,
  error: null,
  // True if server-side auth endpoints are available (Cloud Run)
  // False for static hosting (GitHub Pages)
  serverAuthAvailable: false,
  // True if service account API is available (for consistent file access)
  serviceAccountEnabled: false,
  // Spreadsheet ID (only set when service account is enabled)
  spreadsheetId: null,
  // Grants folder ID (only set when service account is enabled)
  grantsFolderId: null,
});

let loadPromise = null;

/**
 * Load configuration from the server.
 * Falls back to VITE_GOOGLE_CLIENT_ID for static hosting.
 * Returns cached config if already loaded.
 */
export async function loadConfig() {
  if (config.loaded) {
    return config;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        config.clientId = data.clientId;
        config.serverAuthAvailable = true;
        config.serviceAccountEnabled = data.serviceAccountEnabled || false;
        config.spreadsheetId = data.spreadsheetId || null;
        config.grantsFolderId = data.grantsFolderId || null;
        config.loaded = true;
        console.log(
          'Config loaded from server',
          config.serviceAccountEnabled ? '(service account enabled)' : '(client-side auth)'
        );
        return config;
      }
    } catch (err) {
      // Server not available - this is expected for static hosting
      console.log('Server config not available, using static hosting mode');
    }

    // Fallback to build-time config for static hosting
    const buildTimeClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (buildTimeClientId) {
      config.clientId = buildTimeClientId;
      config.serverAuthAvailable = false;
      config.loaded = true;
      console.log('Config loaded from build-time env (client-side auth only)');
    } else {
      config.error = 'No client ID available. Configure VITE_GOOGLE_CLIENT_ID for static hosting.';
      console.error(config.error);
    }

    return config;
  })();

  return loadPromise;
}

/**
 * Get the client ID.
 * Must call loadConfig() first.
 */
export function getClientId() {
  return config.clientId;
}

export const configStore = {
  get clientId() {
    return config.clientId;
  },
  get loaded() {
    return config.loaded;
  },
  get error() {
    return config.error;
  },
  get serverAuthAvailable() {
    return config.serverAuthAvailable;
  },
  get serviceAccountEnabled() {
    return config.serviceAccountEnabled;
  },
  get spreadsheetId() {
    return config.spreadsheetId;
  },
  get grantsFolderId() {
    return config.grantsFolderId;
  },
};
