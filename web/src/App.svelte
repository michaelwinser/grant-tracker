<script>
  import { userStore } from './lib/stores/user.svelte.js';
  import SignInButton from './lib/components/SignInButton.svelte';
  import UserMenu from './lib/components/UserMenu.svelte';

  let title = 'Grant Tracker';

  // Initialize auth on mount
  $effect(() => {
    userStore.initialize();
  });

  async function handleTryDifferentAccount() {
    await userStore.signOut();
    userStore.clearError();
  }
</script>

<main class="min-h-screen bg-gray-50">
  {#if userStore.isLoading}
    <!-- Loading state -->
    <div class="min-h-screen flex items-center justify-center">
      <div class="text-center">
        <svg class="animate-spin h-10 w-10 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
            class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
    <header class="bg-blue-600 text-white shadow-lg">
      <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <h1 class="text-xl font-bold">{title}</h1>
        <UserMenu />
      </div>
    </header>

    <div class="max-w-7xl mx-auto px-4 py-8">
      <div class="bg-white rounded-lg shadow p-6">
        <p class="text-gray-600">
          Welcome, {userStore.user?.name || 'User'}! You are signed in as {userStore.user?.email}.
        </p>
        <p class="text-gray-500 mt-2 text-sm">
          Select a spreadsheet to get started (coming in Phase 2).
        </p>
      </div>
    </div>
  {/if}
</main>
