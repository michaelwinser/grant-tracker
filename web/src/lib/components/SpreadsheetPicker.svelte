<script>
  import { spreadsheetStore } from '../stores/spreadsheet.svelte.js';
  import { userStore } from '../stores/user.svelte.js';
  import { openSpreadsheetPicker } from '../api/picker.js';
  import {
    createSpreadsheet,
    validateSchema,
    initializeMissingSheets,
  } from '../api/sheets.js';

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  let mode = $state('select'); // 'select' | 'creating' | 'validating' | 'initializing'
  let newSheetName = $state('Grant Tracker');
  let validationResult = $state(null);
  let showInitializePrompt = $state(false);

  async function handleSelectExisting() {
    spreadsheetStore.clearError();

    try {
      const selected = await openSpreadsheetPicker(userStore.accessToken, clientId);
      if (!selected) return; // User cancelled

      spreadsheetStore.setSpreadsheet(selected);
      await validateSelectedSpreadsheet();
    } catch (err) {
      spreadsheetStore.setError(err.message);
    }
  }

  async function handleCreateNew() {
    if (!newSheetName.trim()) {
      spreadsheetStore.setError('Please enter a name for the spreadsheet');
      return;
    }

    spreadsheetStore.clearError();
    mode = 'creating';
    spreadsheetStore.setLoading(true);

    try {
      const spreadsheet = await createSpreadsheet(
        userStore.accessToken,
        newSheetName.trim()
      );
      spreadsheetStore.setSpreadsheet(spreadsheet);
      spreadsheetStore.markValidated();
      mode = 'select';
    } catch (err) {
      spreadsheetStore.setError(err.message);
      mode = 'select';
    } finally {
      spreadsheetStore.setLoading(false);
    }
  }

  async function validateSelectedSpreadsheet() {
    mode = 'validating';
    spreadsheetStore.setLoading(true);

    try {
      const result = await validateSchema(
        userStore.accessToken,
        spreadsheetStore.spreadsheetId
      );

      if (result.valid) {
        spreadsheetStore.markValidated();
        mode = 'select';
      } else {
        validationResult = result;
        showInitializePrompt = true;
        mode = 'select';
      }
    } catch (err) {
      spreadsheetStore.setError(err.message);
      mode = 'select';
    } finally {
      spreadsheetStore.setLoading(false);
    }
  }

  async function handleInitializeSchema() {
    showInitializePrompt = false;
    mode = 'initializing';
    spreadsheetStore.setLoading(true);

    try {
      await initializeMissingSheets(
        userStore.accessToken,
        spreadsheetStore.spreadsheetId,
        validationResult.missingSheets
      );
      spreadsheetStore.markValidated();
      validationResult = null;
      mode = 'select';
    } catch (err) {
      spreadsheetStore.setError(err.message);
      mode = 'select';
    } finally {
      spreadsheetStore.setLoading(false);
    }
  }

  function handleCancelInitialize() {
    showInitializePrompt = false;
    spreadsheetStore.clear();
    validationResult = null;
  }

  function handleSwitchSpreadsheet() {
    spreadsheetStore.clear();
    validationResult = null;
    showInitializePrompt = false;
  }
</script>

<div class="max-w-lg mx-auto">
  {#if showInitializePrompt && validationResult}
    <!-- Initialize Schema Prompt -->
    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
      <div class="flex items-start">
        <div class="flex-shrink-0">
          <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div class="ml-3 flex-1">
          <h3 class="text-lg font-medium text-yellow-800">Schema Setup Required</h3>
          <p class="mt-2 text-sm text-yellow-700">
            The selected spreadsheet is missing some required sheets:
          </p>
          <ul class="mt-2 text-sm text-yellow-700 list-disc list-inside">
            {#each validationResult.missingSheets as sheet}
              <li>{sheet}</li>
            {/each}
          </ul>
          <p class="mt-3 text-sm text-yellow-700">
            Would you like to add these sheets with the proper column headers?
          </p>
          <div class="mt-4 flex gap-3">
            <button
              onclick={handleInitializeSchema}
              class="px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
            >
              Initialize Schema
            </button>
            <button
              onclick={handleCancelInitialize}
              class="px-4 py-2 border border-yellow-300 text-yellow-700 text-sm font-medium rounded-md hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
            >
              Choose Different Spreadsheet
            </button>
          </div>
        </div>
      </div>
    </div>
  {:else if spreadsheetStore.isLoading}
    <!-- Loading State -->
    <div class="text-center py-8">
      <svg class="animate-spin h-10 w-10 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-gray-600">
        {#if mode === 'creating'}
          Creating spreadsheet...
        {:else if mode === 'validating'}
          Validating spreadsheet schema...
        {:else if mode === 'initializing'}
          Initializing spreadsheet schema...
        {:else}
          Loading...
        {/if}
      </p>
    </div>
  {:else}
    <!-- Selection UI -->
    <div class="bg-white rounded-lg shadow-lg p-6">
      <div class="text-center mb-6">
        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-900">Select Spreadsheet</h2>
        <p class="text-gray-600 mt-1">
          Choose an existing Grant Tracker spreadsheet or create a new one.
        </p>
      </div>

      {#if spreadsheetStore.error}
        <div class="mb-4 p-4 bg-red-50 rounded-lg">
          <p class="text-sm text-red-700">{spreadsheetStore.error}</p>
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
          Select from Google Drive
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
          <label for="new-sheet-name" class="block text-sm font-medium text-gray-700">
            Create a new spreadsheet
          </label>
          <input
            id="new-sheet-name"
            type="text"
            bind:value={newSheetName}
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
            Create New Spreadsheet
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
