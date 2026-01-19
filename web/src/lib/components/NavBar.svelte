<script>
  import { router } from '../router.svelte.js';
  import { spreadsheetStore } from '../stores/spreadsheet.svelte.js';
  import UserMenu from './UserMenu.svelte';
  import SpreadsheetInfo from './SpreadsheetInfo.svelte';

  const navItems = [
    { path: '/', label: 'Dashboard', route: 'dashboard' },
    { path: '/grants', label: 'Grants', route: 'grants' },
    { path: '/action-items', label: 'Action Items', route: 'action-items' },
  ];

  function isActive(route) {
    // Grant detail counts as grants being active
    if (route === 'grants' && router.route === 'grant-detail') {
      return true;
    }
    return router.route === route;
  }
</script>

<nav class="bg-white border-b border-gray-200 sticky top-0 z-50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between h-14">
      <div class="flex items-center space-x-8">
        <a href="#/" class="text-xl font-semibold text-gray-900">Grant Tracker</a>
        <div class="hidden md:flex space-x-1">
          {#each navItems as item}
            <a
              href="#{item.path}"
              class="px-3 py-2 text-sm font-medium rounded-md transition-colors {isActive(item.route)
                ? 'text-indigo-600 bg-indigo-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
            >
              {item.label}
            </a>
          {/each}
        </div>
      </div>
      <div class="flex items-center space-x-4">
        {#if spreadsheetStore.hasSpreadsheet && spreadsheetStore.isValidated}
          <SpreadsheetInfo />
        {/if}
        <UserMenu />
      </div>
    </div>
  </div>
</nav>
