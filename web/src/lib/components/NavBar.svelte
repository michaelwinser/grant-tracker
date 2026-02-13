<script>
  import { router } from '../router.svelte.js';
  import { spreadsheetStore } from '../stores/spreadsheet.svelte.js';
  import { folderStore } from '../stores/folder.svelte.js';
  import UserMenu from './UserMenu.svelte';
  import SpreadsheetInfo from './SpreadsheetInfo.svelte';

  const navItems = [
    { path: '/', label: 'Dashboard', route: 'dashboard' },
    { path: '/grants', label: 'Grants', route: 'grants' },
    { path: '/budget', label: 'Budget', route: 'budget' },
    { path: '/reports', label: 'Reports', route: 'reports' },
    // Deferred to future phase:
    // { path: '/action-items', label: 'Action Items', route: 'action-items' },
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

        <!-- Quick access links -->
        <div class="flex items-center gap-2">
          {#if folderStore.folderUrl}
            <a
              href={folderStore.folderUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open Drive folder"
              class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
              </svg>
            </a>
          {/if}

          {#if spreadsheetStore.spreadsheetUrl}
            <a
              href={spreadsheetStore.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open Google Sheet"
              class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
              </svg>
            </a>
          {/if}
        </div>

        <UserMenu />
      </div>
    </div>
  </div>
</nav>
