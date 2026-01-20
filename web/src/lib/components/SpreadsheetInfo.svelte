<script>
  import { spreadsheetStore } from '../stores/spreadsheet.svelte.js';
  import { folderStore } from '../stores/folder.svelte.js';

  let showMenu = $state(false);
  let showFolderPicker = $state(false);

  function handleSwitchSpreadsheet() {
    spreadsheetStore.clear();
    showMenu = false;
  }

  function handleOpenSpreadsheet() {
    if (spreadsheetStore.spreadsheetUrl) {
      window.open(spreadsheetStore.spreadsheetUrl, '_blank');
    }
    showMenu = false;
  }

  function handleOpenFolder() {
    if (folderStore.folderUrl) {
      window.open(folderStore.folderUrl, '_blank');
    }
    showMenu = false;
  }

  function handleSetupFolder() {
    showFolderPicker = true;
    showMenu = false;
  }

  function handleChangeFolder() {
    folderStore.clear();
    showFolderPicker = true;
    showMenu = false;
  }

  function handleClickOutside(event) {
    if (showMenu) {
      showMenu = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="relative">
  <button
    onclick={(e) => { e.stopPropagation(); showMenu = !showMenu; }}
    class="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-100 hover:text-white hover:bg-blue-700 rounded-md transition-colors"
  >
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    <span class="max-w-[150px] truncate">{spreadsheetStore.spreadsheetName || 'Spreadsheet'}</span>
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  {#if showMenu}
    <div
      role="menu"
      tabindex="-1"
      class="absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50"
      onkeydown={(e) => { if (e.key === 'Escape') showMenu = false; }}
      onclick={(e) => e.stopPropagation()}
    >
      <div class="py-1">
        <!-- Spreadsheet Section -->
        <div class="px-4 py-2 border-b border-gray-100">
          <p class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Spreadsheet</p>
          <p class="text-sm font-medium text-gray-900 truncate">{spreadsheetStore.spreadsheetName}</p>
        </div>
        <button
          onclick={handleOpenSpreadsheet}
          class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open in Google Sheets
        </button>
        <button
          onclick={handleSwitchSpreadsheet}
          class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Switch Spreadsheet
        </button>

        <!-- Folder Section -->
        <div class="px-4 py-2 border-t border-b border-gray-100 mt-1">
          <p class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Drive Folder</p>
          {#if folderStore.hasFolder}
            <p class="text-sm font-medium text-gray-900 truncate">{folderStore.folderName}</p>
          {:else}
            <p class="text-sm text-gray-500 italic">Not configured</p>
          {/if}
        </div>
        {#if folderStore.hasFolder}
          <button
            onclick={handleOpenFolder}
            class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open in Google Drive
          </button>
          <button
            onclick={handleChangeFolder}
            class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Change Folder
          </button>
        {:else}
          <button
            onclick={handleSetupFolder}
            class="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Set Up Drive Folder
          </button>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Folder Picker Modal -->
  {#if showFolderPicker}
    <div class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <button
          type="button"
          class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity cursor-default"
          onclick={() => showFolderPicker = false}
          aria-label="Close modal"
        ></button>
        <div class="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
          <button
            onclick={() => showFolderPicker = false}
            class="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            aria-label="Close folder picker"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {#await import('./FolderPicker.svelte') then { default: FolderPicker }}
            <FolderPicker />
          {/await}
        </div>
      </div>
    </div>
  {/if}
</div>
