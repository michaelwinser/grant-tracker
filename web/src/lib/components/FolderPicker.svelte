<script>
  import { folderStore } from '../stores/folder.svelte.js';
  import { userStore } from '../stores/user.svelte.js';
  import { spreadsheetStore } from '../stores/spreadsheet.svelte.js';
  import { configStore } from '../stores/config.svelte.js';
  import { openFolderPicker } from '../api/picker.js';
  import { createFolder, findOrCreateFolder, listFiles } from '../api/drive-unified.js';
  import { createSpreadsheet, validateSchema } from '../api/sheets.js';

  let mode = $state('select'); // 'select' | 'creating' | 'setting-up' | 'setting-up-spreadsheet'
  let newFolderName = $state('Grant Tracker');
  let spreadsheetSetupAttempted = $state(false);

  // Handle case where folder exists from localStorage but spreadsheet doesn't
  $effect(() => {
    if (
      folderStore.hasFolder &&
      folderStore.hasGrantsFolder &&
      !spreadsheetStore.hasSpreadsheet &&
      !folderStore.isLoading &&
      !spreadsheetSetupAttempted &&
      userStore.isAuthenticated
    ) {
      spreadsheetSetupAttempted = true;
      setupSpreadsheet();
    }
  });

  async function handleSelectExisting() {
    folderStore.clearError();

    try {
      const selected = await openFolderPicker(userStore.accessToken, configStore.clientId);
      if (!selected) return; // User cancelled

      folderStore.setFolder(selected);
      await setupGrantsFolder();
    } catch (err) {
      folderStore.setError(err.message);
    }
  }

  async function handleCreateNew() {
    if (!newFolderName.trim()) {
      folderStore.setError('Please enter a name for the folder');
      return;
    }

    folderStore.clearError();
    mode = 'creating';
    folderStore.setLoading(true);

    try {
      // Create in user's root Drive
      const folder = await createFolder(userStore.accessToken, newFolderName.trim());
      folderStore.setFolder(folder);
      await setupGrantsFolder();
    } catch (err) {
      folderStore.setError(err.message);
      mode = 'select';
    } finally {
      folderStore.setLoading(false);
    }
  }

  async function setupGrantsFolder() {
    mode = 'setting-up';
    folderStore.setLoading(true);

    try {
      // Create or find the Grants/ subfolder
      const grantsFolder = await findOrCreateFolder(
        userStore.accessToken,
        folderStore.folderId,
        'Grants'
      );

      folderStore.setGrantsFolder(grantsFolder.id);

      if (grantsFolder.created) {
        console.log('Created Grants/ subfolder');
      } else {
        console.log('Found existing Grants/ subfolder');
      }

      // Now set up the spreadsheet
      await setupSpreadsheet();
    } catch (err) {
      folderStore.setError(`Failed to set up Grants folder: ${err.message}`);
      mode = 'select';
      folderStore.setLoading(false);
    }
  }

  async function setupSpreadsheet() {
    mode = 'setting-up-spreadsheet';

    try {
      // Search for existing spreadsheet in the root folder
      const spreadsheets = await listFiles(userStore.accessToken, folderStore.folderId, {
        mimeType: 'application/vnd.google-apps.spreadsheet',
      });

      if (spreadsheets.length > 0) {
        // Use the first spreadsheet found
        const existing = spreadsheets[0];
        console.log('Found existing spreadsheet:', existing.name);

        spreadsheetStore.setSpreadsheet({
          id: existing.id,
          name: existing.name,
          url: existing.webViewLink || `https://docs.google.com/spreadsheets/d/${existing.id}`,
        });

        // Validate schema - App.svelte will handle validation via effect
        // but we can mark it validated here if valid
        try {
          const result = await validateSchema(userStore.accessToken, existing.id);
          if (result.valid) {
            spreadsheetStore.markValidated();
          }
        } catch (err) {
          console.warn('Could not validate existing spreadsheet:', err);
          // Let App.svelte handle validation retry
        }
      } else {
        // Create new spreadsheet in the root folder
        console.log('Creating new spreadsheet in folder');
        const created = await createSpreadsheet(
          userStore.accessToken,
          'Grant Tracker',
          folderStore.folderId
        );

        spreadsheetStore.setSpreadsheet(created);
        spreadsheetStore.markValidated(); // New spreadsheet has correct schema
      }

      mode = 'select';
    } catch (err) {
      folderStore.setError(`Failed to set up spreadsheet: ${err.message}`);
      mode = 'select';
    } finally {
      folderStore.setLoading(false);
    }
  }

  function handleChangeFolder() {
    folderStore.clear();
    spreadsheetStore.clear();
    spreadsheetSetupAttempted = false;
  }
</script>

{#if folderStore.hasFolder && folderStore.hasGrantsFolder && spreadsheetStore.hasSpreadsheet}
  <!-- Setup complete - show folder info -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <div>
          <p class="text-sm font-medium text-gray-900">{folderStore.folderName}</p>
          <a
            href={folderStore.folderUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs text-blue-600 hover:underline"
          >
            Open in Drive
          </a>
        </div>
      </div>
      <button
        onclick={handleChangeFolder}
        class="text-sm text-gray-500 hover:text-gray-700"
      >
        Change
      </button>
    </div>
  </div>
{:else if folderStore.isLoading}
  <!-- Loading State -->
  <div class="text-center py-8">
    <svg class="animate-spin h-10 w-10 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <p class="text-gray-600">
      {#if mode === 'creating'}
        Creating folder...
      {:else if mode === 'setting-up'}
        Setting up Grants folder...
      {:else if mode === 'setting-up-spreadsheet'}
        Setting up spreadsheet...
      {:else}
        Loading...
      {/if}
    </p>
  </div>
{:else}
  <!-- Selection UI -->
  <div class="max-w-lg mx-auto">
    <div class="bg-white rounded-lg shadow-lg p-6">
      <div class="text-center mb-6">
        <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-900">Select Root Folder</h2>
        <p class="text-gray-600 mt-1">
          Choose a folder to store grant documents and files.
        </p>
      </div>

      {#if folderStore.error}
        <div class="mb-4 p-4 bg-red-50 rounded-lg">
          <p class="text-sm text-red-700">{folderStore.error}</p>
        </div>
      {/if}

      <div class="space-y-4">
        <!-- Select Existing Button -->
        <button
          onclick={handleSelectExisting}
          class="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          Select Existing Folder
        </button>

        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-300"></div>
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-2 bg-white text-gray-500">or</span>
          </div>
        </div>

        <!-- Create New Form -->
        <div class="space-y-3">
          <label for="new-folder-name" class="block text-sm font-medium text-gray-700">
            Create a new folder
          </label>
          <input
            id="new-folder-name"
            type="text"
            bind:value={newFolderName}
            placeholder="Grant Tracker"
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onclick={handleCreateNew}
            class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Create New Folder
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
