<script>
  import { spreadsheetStore } from '../stores/spreadsheet.svelte.js';

  let showMenu = $state(false);

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
      class="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50"
      onkeydown={(e) => { if (e.key === 'Escape') showMenu = false; }}
      onclick={(e) => e.stopPropagation()}
    >
      <div class="py-1">
        <div class="px-4 py-2 border-b border-gray-100">
          <p class="text-sm font-medium text-gray-900 truncate">{spreadsheetStore.spreadsheetName}</p>
          <p class="text-xs text-gray-500 truncate">ID: {spreadsheetStore.spreadsheetId}</p>
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
      </div>
    </div>
  {/if}
</div>
