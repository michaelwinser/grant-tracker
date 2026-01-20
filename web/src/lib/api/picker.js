/**
 * Google Picker API module.
 * Handles file/spreadsheet selection from Google Drive.
 */

let pickerLoaded = false;
let pickerLoadPromise = null;

/**
 * Load the Google Picker API.
 * @returns {Promise<void>}
 */
export function loadPickerApi() {
  if (pickerLoaded) {
    return Promise.resolve();
  }

  if (pickerLoadPromise) {
    return pickerLoadPromise;
  }

  pickerLoadPromise = new Promise((resolve, reject) => {
    // Check if gapi is available
    if (!window.gapi) {
      // Load the gapi script
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => loadPickerClient(resolve, reject);
      script.onerror = () => reject(new Error('Failed to load Google API script'));
      document.head.appendChild(script);
    } else {
      loadPickerClient(resolve, reject);
    }
  });

  return pickerLoadPromise;
}

/**
 * Load the picker client library.
 */
function loadPickerClient(resolve, reject) {
  window.gapi.load('picker', {
    callback: () => {
      pickerLoaded = true;
      resolve();
    },
    onerror: () => {
      reject(new Error('Failed to load Google Picker API'));
    },
  });
}

/**
 * Open the Google Picker to select a spreadsheet.
 * @param {string} accessToken - OAuth access token
 * @param {string} clientId - Google OAuth client ID (for app ID extraction)
 * @returns {Promise<{id: string, name: string, url: string}|null>} - Selected file or null if cancelled
 */
export async function openSpreadsheetPicker(accessToken, clientId) {
  await loadPickerApi();

  return new Promise((resolve) => {
    // Extract app ID from client ID (everything before the first dot)
    const appId = clientId.split('-')[0];

    const view = new window.google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS)
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false)
      .setMode(window.google.picker.DocsViewMode.LIST);

    const picker = new window.google.picker.PickerBuilder()
      .setAppId(appId)
      .setOAuthToken(accessToken)
      .addView(view)
      .addView(new window.google.picker.DocsUploadView())
      .setTitle('Select Grant Tracker Spreadsheet')
      .setCallback((data) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const doc = data.docs[0];
          resolve({
            id: doc.id,
            name: doc.name,
            url: doc.url,
          });
        } else if (data.action === window.google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();

    picker.setVisible(true);
  });
}

/**
 * Open the Google Picker to select a folder.
 * @param {string} accessToken - OAuth access token
 * @param {string} clientId - Google OAuth client ID (for app ID extraction)
 * @returns {Promise<{id: string, name: string, url: string}|null>} - Selected folder or null if cancelled
 */
export async function openFolderPicker(accessToken, clientId) {
  await loadPickerApi();

  return new Promise((resolve) => {
    // Extract app ID from client ID (everything before the first dot)
    const appId = clientId.split('-')[0];

    const view = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true)
      .setMode(window.google.picker.DocsViewMode.LIST);

    const picker = new window.google.picker.PickerBuilder()
      .setAppId(appId)
      .setOAuthToken(accessToken)
      .addView(view)
      .setTitle('Select Root Folder for Grant Tracker')
      .setCallback((data) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const folder = data.docs[0];
          resolve({
            id: folder.id,
            name: folder.name,
            url: folder.url || `https://drive.google.com/drive/folders/${folder.id}`,
          });
        } else if (data.action === window.google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();

    picker.setVisible(true);
  });
}

/**
 * Open the Google Picker to select or upload files.
 * @param {string} accessToken - OAuth access token
 * @param {string} clientId - Google OAuth client ID (for app ID extraction)
 * @param {Object} options - Picker options
 * @param {string} options.title - Picker dialog title
 * @param {boolean} options.multiSelect - Allow selecting multiple files
 * @param {string} options.uploadParentId - Parent folder ID for uploads (optional)
 * @returns {Promise<Array<{id: string, name: string, url: string, mimeType: string}>|null>} - Selected files or null if cancelled
 */
export async function openFilePicker(accessToken, clientId, options = {}) {
  await loadPickerApi();

  return new Promise((resolve) => {
    // Extract app ID from client ID (everything before the first dot)
    const appId = clientId.split('-')[0];

    // View for selecting existing files (include folders for navigation)
    const docsView = new window.google.picker.DocsView()
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)
      .setMode(window.google.picker.DocsViewMode.LIST);

    // View for uploading new files
    const uploadView = new window.google.picker.DocsUploadView();
    if (options.uploadParentId) {
      uploadView.setParent(options.uploadParentId);
    }

    const builder = new window.google.picker.PickerBuilder()
      .setAppId(appId)
      .setOAuthToken(accessToken)
      .addView(docsView)
      .addView(uploadView)
      .setTitle(options.title || 'Select Files')
      .setCallback((data) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const files = data.docs.map((doc) => ({
            id: doc.id,
            name: doc.name,
            url: doc.url || `https://drive.google.com/file/d/${doc.id}`,
            mimeType: doc.mimeType,
          }));
          resolve(files);
        } else if (data.action === window.google.picker.Action.CANCEL) {
          resolve(null);
        }
      });

    // Enable multi-select if requested
    if (options.multiSelect) {
      builder.enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED);
    }

    builder.build().setVisible(true);
  });
}
