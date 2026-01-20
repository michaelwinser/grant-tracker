<script>
  import { actionItemsStore } from '../stores/actionItems.svelte.js';
  import { grantsStore } from '../stores/grants.svelte.js';
  import { userStore } from '../stores/user.svelte.js';
  import { navigate } from '../router.svelte.js';
  import { ActionItemStatus, todayDate } from '../models.js';

  // Filter state
  let assigneeFilter = $state('');
  let statusFilter = $state('open');
  let grantFilter = $state('');
  let dueDateFilter = $state('');

  // Bulk selection
  let selectedItems = $state(new Set());
  let bulkProcessing = $state(false);

  // Error state
  let itemError = $state('');

  // Get unique assignees from action items
  let assignees = $derived(() => {
    const assigneeSet = new Set();
    actionItemsStore.actionItems.forEach(item => {
      if (item.assignee) assigneeSet.add(item.assignee);
    });
    return Array.from(assigneeSet).sort();
  });

  // Get grants that have action items
  let grantsWithItems = $derived(() => {
    const grantIds = new Set();
    actionItemsStore.actionItems.forEach(item => {
      if (item.grant_id) grantIds.add(item.grant_id);
    });
    return grantsStore.grants.filter(g => grantIds.has(g.grant_id));
  });

  // Filter action items
  let filteredItems = $derived(() => {
    let items = [...actionItemsStore.actionItems];
    const today = todayDate();

    // Apply assignee filter
    if (assigneeFilter) {
      items = items.filter(item => item.assignee === assigneeFilter);
    }

    // Apply status filter
    if (statusFilter === 'open') {
      items = items.filter(item => item.status === ActionItemStatus.OPEN);
    } else if (statusFilter === 'done') {
      items = items.filter(item => item.status === ActionItemStatus.DONE);
    } else if (statusFilter === 'cancelled') {
      items = items.filter(item => item.status === ActionItemStatus.CANCELLED);
    }

    // Apply grant filter
    if (grantFilter) {
      items = items.filter(item => item.grant_id === grantFilter);
    }

    // Apply due date filter
    if (dueDateFilter === 'overdue') {
      items = items.filter(item => item.due_date && item.due_date < today);
    } else if (dueDateFilter === 'today') {
      items = items.filter(item => item.due_date === today);
    } else if (dueDateFilter === 'thisWeek') {
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      const weekEnd = weekFromNow.toISOString().split('T')[0];
      items = items.filter(item => item.due_date && item.due_date >= today && item.due_date <= weekEnd);
    }

    // Sort by due date (earliest first), then by status
    items.sort((a, b) => {
      // Open items first
      if (a.status === ActionItemStatus.OPEN && b.status !== ActionItemStatus.OPEN) return -1;
      if (a.status !== ActionItemStatus.OPEN && b.status === ActionItemStatus.OPEN) return 1;

      // Then by due date
      if (a.due_date && b.due_date) {
        return a.due_date.localeCompare(b.due_date);
      }
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });

    return items;
  });

  // Check if current user's email matches
  let isMyItem = (item) => {
    const userEmail = userStore.user?.email?.toLowerCase();
    return item.assignee?.toLowerCase() === userEmail;
  };

  // Get grant title by ID
  function getGrantTitle(grantId) {
    const grant = grantsStore.getById(grantId);
    return grant?.title || grantId;
  }

  // Check if item is overdue
  function isOverdue(item) {
    if (!item.due_date || item.status !== ActionItemStatus.OPEN) return false;
    return item.due_date < todayDate();
  }

  // Format due date with relative context
  function formatDueDate(dueDate) {
    if (!dueDate) return '—';
    const today = todayDate();
    const date = new Date(dueDate);

    if (dueDate === today) return 'Today';

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dueDate === tomorrow.toISOString().split('T')[0]) return 'Tomorrow';

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dueDate === yesterday.toISOString().split('T')[0]) return 'Yesterday';

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Handle toggle item completion
  async function handleToggleItem(item) {
    itemError = '';
    try {
      if (item.status === ActionItemStatus.DONE) {
        await actionItemsStore.reopen(item.item_id);
      } else {
        await actionItemsStore.markDone(item.item_id);
      }
    } catch (err) {
      itemError = err.message;
    }
  }

  // Handle bulk mark complete
  async function handleBulkComplete() {
    if (selectedItems.size === 0) return;

    bulkProcessing = true;
    itemError = '';

    try {
      for (const itemId of selectedItems) {
        const item = actionItemsStore.getById(itemId);
        if (item && item.status === ActionItemStatus.OPEN) {
          await actionItemsStore.markDone(itemId);
        }
      }
      selectedItems = new Set();
    } catch (err) {
      itemError = err.message;
    } finally {
      bulkProcessing = false;
    }
  }

  // Toggle selection
  function toggleSelection(itemId) {
    const newSet = new Set(selectedItems);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    selectedItems = newSet;
  }

  // Toggle select all visible
  function toggleSelectAll() {
    const openItems = filteredItems().filter(item => item.status === ActionItemStatus.OPEN);
    const allSelected = openItems.every(item => selectedItems.has(item.item_id));

    if (allSelected) {
      selectedItems = new Set();
    } else {
      selectedItems = new Set(openItems.map(item => item.item_id));
    }
  }

  // Navigate to grant detail
  function goToGrant(grantId, event) {
    event.stopPropagation();
    navigate(`/grant/${encodeURIComponent(grantId)}`);
  }

  // Quick filter: show only my items
  function showMyItems() {
    const userEmail = userStore.user?.email;
    if (userEmail) {
      assigneeFilter = userEmail;
    }
  }

  // Clear all filters
  function clearFilters() {
    assigneeFilter = '';
    statusFilter = 'open';
    grantFilter = '';
    dueDateFilter = '';
  }
</script>

<div class="space-y-6">
  <!-- Page Header -->
  <div class="flex justify-between items-start">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Action Items</h1>
      <p class="text-gray-500 mt-1">
        {actionItemsStore.openItems.length} open · {actionItemsStore.overdueItems().length} overdue
      </p>
    </div>
    <div class="flex gap-2">
      <button
        onclick={showMyItems}
        class="px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
      >
        My Items
      </button>
    </div>
  </div>

  <!-- Error display -->
  {#if itemError}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
      {itemError}
      <button onclick={() => itemError = ''} class="ml-2 text-red-500 hover:text-red-700">Dismiss</button>
    </div>
  {/if}

  <!-- Filters -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
    <div class="flex flex-wrap gap-4 items-end">
      <div class="w-40">
        <label for="status-filter" class="block text-xs font-medium text-gray-500 mb-1">Status</label>
        <select
          id="status-filter"
          bind:value={statusFilter}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">All</option>
          <option value="open">Open</option>
          <option value="done">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div class="w-48">
        <label for="assignee-filter" class="block text-xs font-medium text-gray-500 mb-1">Assignee</label>
        <select
          id="assignee-filter"
          bind:value={assigneeFilter}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">All assignees</option>
          {#each assignees() as assignee}
            <option value={assignee}>{assignee}</option>
          {/each}
        </select>
      </div>
      <div class="w-48">
        <label for="grant-filter" class="block text-xs font-medium text-gray-500 mb-1">Grant</label>
        <select
          id="grant-filter"
          bind:value={grantFilter}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">All grants</option>
          {#each grantsWithItems() as grant}
            <option value={grant.grant_id}>{grant.grant_id}</option>
          {/each}
        </select>
      </div>
      <div class="w-40">
        <label for="due-filter" class="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
        <select
          id="due-filter"
          bind:value={dueDateFilter}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">Any time</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="thisWeek">This week</option>
        </select>
      </div>
      {#if assigneeFilter || grantFilter || dueDateFilter || statusFilter !== 'open'}
        <button
          onclick={clearFilters}
          class="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
        >
          Clear filters
        </button>
      {/if}
    </div>
  </div>

  <!-- Bulk actions bar -->
  {#if selectedItems.size > 0}
    <div class="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 flex items-center justify-between">
      <span class="text-sm text-indigo-700">
        {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected
      </span>
      <div class="flex gap-2">
        <button
          onclick={() => selectedItems = new Set()}
          class="px-3 py-1 text-sm text-indigo-600 hover:text-indigo-700"
        >
          Clear selection
        </button>
        <button
          onclick={handleBulkComplete}
          disabled={bulkProcessing}
          class="px-3 py-1 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {bulkProcessing ? 'Processing...' : 'Mark Complete'}
        </button>
      </div>
    </div>
  {/if}

  <!-- Action items list -->
  {#if actionItemsStore.isLoading}
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
      <svg class="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-gray-600">Loading action items...</p>
    </div>
  {:else if filteredItems().length === 0}
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
      <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
      {#if actionItemsStore.actionItems.length === 0}
        <h3 class="text-lg font-medium text-gray-900 mb-2">No action items yet</h3>
        <p class="text-gray-500">Action items will appear here when added to grants.</p>
      {:else}
        <h3 class="text-lg font-medium text-gray-900 mb-2">No matching items</h3>
        <p class="text-gray-500">Try adjusting your filters.</p>
      {/if}
    </div>
  {:else}
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            {#if statusFilter === 'open'}
              <th class="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={filteredItems().filter(i => i.status === ActionItemStatus.OPEN).length > 0 &&
                           filteredItems().filter(i => i.status === ActionItemStatus.OPEN).every(i => selectedItems.has(i.item_id))}
                  onchange={toggleSelectAll}
                  class="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
              </th>
            {/if}
            <th class="w-12 px-4 py-3"></th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Grant
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Assignee
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Due Date
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each filteredItems() as item (item.item_id)}
            <tr class="hover:bg-gray-50 {isMyItem(item) ? 'bg-indigo-50/30' : ''}">
              {#if statusFilter === 'open'}
                <td class="px-4 py-4">
                  {#if item.status === ActionItemStatus.OPEN}
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.item_id)}
                      onchange={() => toggleSelection(item.item_id)}
                      class="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                    />
                  {/if}
                </td>
              {/if}
              <td class="px-4 py-4">
                {#if actionItemsStore.isSyncedItem(item)}
                  <!-- Synced items show status indicator instead of checkbox -->
                  <div class="h-5 w-5 flex items-center justify-center" title="Resolve in Google Docs to mark done">
                    {#if item.status === ActionItemStatus.DONE}
                      <svg class="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                    {:else}
                      <div class="w-4 h-4 rounded-full border-2 border-blue-400"></div>
                    {/if}
                  </div>
                {:else}
                  <input
                    type="checkbox"
                    checked={item.status === ActionItemStatus.DONE}
                    disabled={item.status === ActionItemStatus.CANCELLED}
                    onchange={() => handleToggleItem(item)}
                    class="h-5 w-5 text-green-600 rounded border-gray-300 focus:ring-green-500 {item.status === ActionItemStatus.CANCELLED ? 'opacity-50' : ''}"
                  />
                {/if}
              </td>
              <td class="px-6 py-4">
                <div class="text-sm {item.status === ActionItemStatus.DONE ? 'text-gray-500 line-through' : 'text-gray-900'}">
                  {item.description}
                </div>
                <div class="flex items-center gap-2 mt-1">
                  {#if item.status === ActionItemStatus.CANCELLED}
                    <span class="text-xs text-gray-400">Cancelled</span>
                  {/if}
                  {#if actionItemsStore.isSyncedItem(item)}
                    <a
                      href={item.comment_link || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
                      title={item.status === ActionItemStatus.DONE ? 'Comment resolved' : 'Open comment in docs'}
                    >
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                      {item.status === ActionItemStatus.DONE ? 'resolved' : 'open in docs'}
                    </a>
                  {/if}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                {#if item.grant_id}
                  <button
                    onclick={(e) => goToGrant(item.grant_id, e)}
                    class="text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    {item.grant_id}
                  </button>
                {:else}
                  <span class="text-gray-400">—</span>
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                {#if item.assignee}
                  <span class="{isMyItem(item) ? 'text-indigo-600 font-medium' : 'text-gray-900'}">
                    {item.assignee}
                  </span>
                {:else}
                  <span class="text-gray-400">Unassigned</span>
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                {#if item.due_date}
                  <span class="{isOverdue(item) ? 'text-red-600 font-medium' : 'text-gray-900'}">
                    {formatDueDate(item.due_date)}
                  </span>
                {:else}
                  <span class="text-gray-400">—</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Results count -->
    <div class="text-sm text-gray-500">
      Showing {filteredItems().length} of {actionItemsStore.actionItems.length} action items
    </div>
  {/if}
</div>
