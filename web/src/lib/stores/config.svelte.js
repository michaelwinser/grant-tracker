/**
 * Application configuration store.
 * Fetches runtime config from the server (client ID, etc).
 */

let config = $state({
  clientId: null,
  loaded: false,
  error: null,
});

let loadPromise = null;

/**
 * Load configuration from the server.
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
      if (!response.ok) {
        throw new Error('Failed to load config');
      }
      const data = await response.json();
      config.clientId = data.clientId;
      config.loaded = true;
    } catch (err) {
      config.error = err.message;
      console.error('Failed to load config:', err);
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
};
