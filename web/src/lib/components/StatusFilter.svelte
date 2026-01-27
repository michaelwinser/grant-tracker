<script>
  import { grantsStore } from '../stores/grants.svelte.js';

  /**
   * @type {{
   *   selectedStatuses: string[],
   *   onchange: (statuses: string[]) => void,
   *   grantCounts?: Record<string, number>
   * }}
   */
  let { selectedStatuses = [], onchange, grantCounts = {} } = $props();

  // Get visible and hidden statuses from config
  let visibleStatuses = $derived(grantsStore.visibleStatuses);
  let hiddenStatuses = $derived(grantsStore.hiddenStatuses);

  // Check if a status is selected
  function isSelected(status) {
    // If no statuses are explicitly selected, visible statuses are "selected"
    if (selectedStatuses.length === 0) {
      return visibleStatuses.includes(status);
    }
    return selectedStatuses.includes(status);
  }

  // Toggle a status
  function toggleStatus(status) {
    let newSelection;

    if (selectedStatuses.length === 0) {
      // First click from default state - if clicking a visible status, show only that one
      // If clicking a hidden status, show all visible plus that one
      if (visibleStatuses.includes(status)) {
        newSelection = [status];
      } else {
        newSelection = [...visibleStatuses, status];
      }
    } else if (selectedStatuses.includes(status)) {
      // Deselect this status
      newSelection = selectedStatuses.filter(s => s !== status);
      // If nothing left selected, return to default (empty = visible only)
      if (newSelection.length === 0) {
        newSelection = [];
      }
    } else {
      // Add this status
      newSelection = [...selectedStatuses, status];
    }

    onchange(newSelection);
  }

  // Select all (clear selection to return to default visible-only state)
  function selectDefault() {
    onchange([]);
  }

  // Select all including hidden
  function selectAll() {
    onchange([...visibleStatuses, ...hiddenStatuses]);
  }

  // Get count for a status
  function getCount(status) {
    return grantCounts[status] || 0;
  }

  // Check if we're in default state (only visible statuses shown)
  let isDefaultState = $derived(selectedStatuses.length === 0);

  // Check if all statuses are selected
  let allSelected = $derived(
    selectedStatuses.length === visibleStatuses.length + hiddenStatuses.length
  );
</script>

<div class="flex flex-wrap items-center gap-2">
  <!-- Default/Reset button -->
  <button
    type="button"
    onclick={selectDefault}
    class="px-2.5 py-1 text-xs font-medium rounded-full transition-colors {isDefaultState
      ? 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300'
      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
  >
    Default
  </button>

  <!-- Visible status chips -->
  {#each visibleStatuses as status}
    {@const count = getCount(status)}
    {@const selected = isSelected(status)}
    <button
      type="button"
      onclick={() => toggleStatus(status)}
      class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full transition-colors {selected
        ? 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300'
        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}"
    >
      {status}
      {#if count > 0}
        <span class="text-[10px] {selected ? 'text-indigo-600' : 'text-gray-400'}">
          {count}
        </span>
      {/if}
    </button>
  {/each}

  <!-- Separator if there are hidden statuses -->
  {#if hiddenStatuses.length > 0}
    <span class="text-gray-300 mx-1">|</span>

    <!-- Hidden status chips (muted) -->
    {#each hiddenStatuses as status}
      {@const count = getCount(status)}
      {@const selected = selectedStatuses.includes(status)}
      <button
        type="button"
        onclick={() => toggleStatus(status)}
        class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full transition-colors {selected
          ? 'bg-gray-200 text-gray-700 ring-1 ring-gray-400'
          : 'bg-gray-50 text-gray-400 hover:bg-gray-100 border border-dashed border-gray-300'}"
      >
        {status}
        {#if count > 0}
          <span class="text-[10px] {selected ? 'text-gray-500' : 'text-gray-400'}">
            {count}
          </span>
        {/if}
      </button>
    {/each}
  {/if}
</div>
