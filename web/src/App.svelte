<script>
  import { userStore } from './lib/stores/user.svelte.js';
  import { spreadsheetStore } from './lib/stores/spreadsheet.svelte.js';
  import { dataStore } from './lib/stores/data.svelte.js';
  import { router } from './lib/router.svelte.js';
  import SignInButton from './lib/components/SignInButton.svelte';
  import NavBar from './lib/components/NavBar.svelte';
  import SpreadsheetPicker from './lib/components/SpreadsheetPicker.svelte';
  import Dashboard from './lib/components/Dashboard.svelte';
  import GrantList from './lib/components/GrantList.svelte';
  import GrantDetail from './lib/components/GrantDetail.svelte';
  import { validateSchema } from './lib/api/sheets.js';

  let title = 'Grant Tracker';
  let isValidatingStored = $state(false);
  let validationResult = $state(null);
  let showInitializePrompt = $state(false);
  // Track which spreadsheet ID we've attempted to validate to prevent loops
  let validationAttemptedFor = $state(null);
  // Track which spreadsheet ID we've loaded data for
  let dataLoadedFor = $state(null);

  // Initialize auth and spreadsheet on mount
  $effect(() => {
    userStore.initialize();
    spreadsheetStore.initialize();
  });

  // Validate stored spreadsheet when user authenticates
  $effect(() => {
    const currentId = spreadsheetStore.spreadsheetId;
    if (
      userStore.isAuthenticated &&
      spreadsheetStore.hasSpreadsheet &&
      !spreadsheetStore.isValidated &&
      !isValidatingStored &&
      validationAttemptedFor !== currentId
    ) {
      validateStoredSpreadsheet();
    }
  });

  // Load data when spreadsheet is validated
  $effect(() => {
    const currentId = spreadsheetStore.spreadsheetId;
    if (
      userStore.isAuthenticated &&
      spreadsheetStore.isValidated &&
      !dataStore.isLoading &&
      dataLoadedFor !== currentId
    ) {
      loadData();
    }
  });

  async function validateStoredSpreadsheet() {
    const spreadsheetId = spreadsheetStore.spreadsheetId;
    isValidatingStored = true;
    validationAttemptedFor = spreadsheetId;
    spreadsheetStore.setLoading(true);

    try {
      const result = await validateSchema(
        userStore.accessToken,
        spreadsheetId
      );

      if (result.valid) {
        spreadsheetStore.markValidated();
      } else {
        validationResult = result;
        showInitializePrompt = true;
      }
    } catch (err) {
      // Spreadsheet no longer accessible - clear it
      spreadsheetStore.clear();
      spreadsheetStore.setError(err.message);
    } finally {
      spreadsheetStore.setLoading(false);
      isValidatingStored = false;
    }
  }

  async function loadData() {
    const spreadsheetId = spreadsheetStore.spreadsheetId;
    dataLoadedFor = spreadsheetId;

    try {
      await dataStore.loadAll();
    } catch (err) {
      console.error('Failed to load data:', err);
      // Don't clear dataLoadedFor - we don't want to retry infinitely on error
    }
  }

  async function handleTryDifferentAccount() {
    await userStore.signOut();
    dataStore.clearAll();
    userStore.clearError();
  }

  function handleClearStoredSpreadsheet() {
    spreadsheetStore.clear();
    dataStore.clearAll();
    validationResult = null;
    showInitializePrompt = false;
    validationAttemptedFor = null;
    dataLoadedFor = null;
  }
</script>

<div class="min-h-screen bg-gray-50">
  {#if userStore.isLoading}
    <!-- Loading state -->
    <div class="min-h-screen flex items-center justify-center">
      <div class="text-center">
        <svg class="animate-spin h-10 w-10 text-indigo-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-gray-600">Loading...</p>
      </div>
    </div>
  {:else if userStore.error && userStore.isAuthenticated}
    <!-- Access denied state (authenticated but not authorized) -->
    <div class="min-h-screen flex items-center justify-center px-4">
      <div class="max-w-md w-full text-center">
        <div class="bg-white rounded-lg shadow-lg p-8">
          <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 class="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p class="text-gray-600 mb-6">{userStore.error}</p>
          <button
            onclick={handleTryDifferentAccount}
            class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Try a different account
          </button>
        </div>
      </div>
    </div>
  {:else if !userStore.isAuthenticated}
    <!-- Sign-in state -->
    <div class="min-h-screen flex items-center justify-center px-4">
      <div class="max-w-md w-full text-center">
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
          <p class="text-gray-600">
            Grant management for your organization. Sign in to continue.
          </p>
        </div>
        <SignInButton />
        {#if userStore.error}
          <div class="mt-4 p-4 bg-red-50 rounded-lg">
            <p class="text-sm text-red-700">{userStore.error}</p>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <!-- Authenticated state -->
    <NavBar />

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {#if !spreadsheetStore.hasSpreadsheet || showInitializePrompt}
        <!-- Spreadsheet selection state -->
        <SpreadsheetPicker />
      {:else if spreadsheetStore.isLoading || isValidatingStored}
        <!-- Validating stored spreadsheet -->
        <div class="text-center py-12">
          <svg class="animate-spin h-10 w-10 text-indigo-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p class="text-gray-600">Validating spreadsheet...</p>
        </div>
      {:else if spreadsheetStore.isValidated && dataStore.isLoading}
        <!-- Loading data -->
        <div class="text-center py-12">
          <svg class="animate-spin h-10 w-10 text-indigo-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p class="text-gray-600">Loading data...</p>
        </div>
      {:else if spreadsheetStore.isValidated && dataStore.anyError}
        <!-- Data loading error -->
        <div class="max-w-lg mx-auto">
          <div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <svg class="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 class="text-lg font-medium text-red-800 mb-2">Failed to Load Data</h3>
            <p class="text-red-700 mb-4">{dataStore.anyError}</p>
            <button
              onclick={() => { dataLoadedFor = null; dataStore.clearAllErrors(); }}
              class="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Retry
            </button>
          </div>
        </div>
      {:else if spreadsheetStore.isValidated && dataStore.isLoaded}
        <!-- Main app content with routing -->
        {#if router.route === 'grants'}
          <GrantList />
        {:else if router.route === 'grant-detail'}
          <GrantDetail />
        {:else}
          <Dashboard />
        {/if}
      {:else}
        <!-- Spreadsheet error state -->
        <div class="max-w-lg mx-auto">
          <div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <svg class="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 class="text-lg font-medium text-red-800 mb-2">Spreadsheet Error</h3>
            <p class="text-red-700 mb-4">{spreadsheetStore.error || 'Unable to access the spreadsheet.'}</p>
            <button
              onclick={handleClearStoredSpreadsheet}
              class="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Select Different Spreadsheet
            </button>
          </div>
        </div>
      {/if}
    </main>
  {/if}
</div>
