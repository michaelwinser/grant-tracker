<script>
  import { grantsStore } from '../stores/grants.svelte.js';
  import { actionItemsStore } from '../stores/actionItems.svelte.js';
  import { router, navigate, updateQuery, getCurrentYear } from '../router.svelte.js';
  import StatusBadge from './StatusBadge.svelte';
  import StatusFilter from './StatusFilter.svelte';
  import GrantFormModal from './GrantFormModal.svelte';

  // Modal state
  let showNewGrantModal = $state(false);

  // Initialize filters from URL or defaults
  const currentYear = getCurrentYear();

  // Parse status filter from URL (comma-separated list)
  function parseStatusFromUrl() {
    const urlStatus = router.query.status;
    if (!urlStatus) return [];
    if (urlStatus === 'all') return [...grantsStore.visibleStatuses, ...grantsStore.hiddenStatuses];
    return urlStatus.split(',').filter(Boolean);
  }

  // Filter state
  let searchQuery = $state('');
  let selectedStatuses = $state(parseStatusFromUrl());
  let yearFilter = $state(router.query.year || String(currentYear));
  let showOnlyWithActions = $state(router.query.actions === 'open');
  let viewMode = $state(router.query.view || 'grouped'); // 'list' or 'grouped'

  // Debounce timer for URL updates
  let urlUpdateTimer = null;
  let lastUrlUpdate = '';

  // Update URL when filters change (debounced, with loop prevention)
  function updateFiltersInUrl() {
    if (urlUpdateTimer) clearTimeout(urlUpdateTimer);
    urlUpdateTimer = setTimeout(() => {
      const updates = {
        year: yearFilter === '' ? null : yearFilter,
        status: selectedStatuses.length === 0 ? null : selectedStatuses.join(','),
        actions: showOnlyWithActions ? 'open' : null,
        view: viewMode === 'grouped' ? null : viewMode,
      };
      // Prevent infinite loop by checking if URL actually changed
      const urlKey = JSON.stringify(updates);
      if (urlKey !== lastUrlUpdate) {
        lastUrlUpdate = urlKey;
        updateQuery(updates);
      }
    }, 150);
  }

  // Watch for filter changes and update URL (only on user-initiated changes)
  $effect(() => {
    // Access the reactive values to track them
    yearFilter;
    selectedStatuses;
    showOnlyWithActions;
    viewMode;
    updateFiltersInUrl();
  });

  // Get unique years from grants (as strings for select binding)
  let availableYears = $derived.by(() => {
    const years = new Set();
    grantsStore.grants.forEach(g => {
      if (g.Year) years.add(String(g.Year));
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  });

  // Get grant counts by status (for the filter chips)
  let grantCountsByStatus = $derived.by(() => {
    const counts = {};
    // Count grants matching current year filter
    const yearFiltered = yearFilter
      ? grantsStore.grants.filter(g => g.Year === parseInt(yearFilter))
      : grantsStore.grants;

    yearFiltered.forEach(g => {
      counts[g.Status] = (counts[g.Status] || 0) + 1;
    });
    return counts;
  });

  // Get grants with open action items
  let grantsWithOpenActions = $derived.by(() => {
    const grantIds = new Set();
    actionItemsStore.openItems.forEach(item => {
      if (item.grant_id) grantIds.add(item.grant_id);
    });
    return grantIds;
  });

  // Count of grants with open action items (for current filters)
  let openActionsCount = $derived(grantsWithOpenActions.size);

  // Determine which statuses to show based on selection
  let effectiveStatuses = $derived(
    selectedStatuses.length === 0 ? grantsStore.visibleStatuses : selectedStatuses
  );

  // Filter and sort grants
  let filteredGrants = $derived.by(() => {
    let result = [...grantsStore.grants];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(g =>
        g.Title?.toLowerCase().includes(query) ||
        g.Organization?.toLowerCase().includes(query) ||
        g.ID?.toLowerCase().includes(query) ||
        g.Beneficiary?.toLowerCase().includes(query) ||
        g.Tags?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    result = result.filter(g => effectiveStatuses.includes(g.Status));

    // Apply year filter
    if (yearFilter) {
      result = result.filter(g => g.Year === parseInt(yearFilter));
    }

    // Apply "has open action items" filter
    if (showOnlyWithActions) {
      result = result.filter(g => grantsWithOpenActions.has(g.ID));
    }

    return result;
  });

  // Group grants by year and status for grouped view
  let groupedGrants = $derived.by(() => {
    const sortOrder = grantsStore.statusSortOrder;

    // Group by year first, then by status
    const byYear = {};
    filteredGrants.forEach(g => {
      const year = g.Year || 'Unknown';
      if (!byYear[year]) byYear[year] = {};
      const status = g.Status || 'Unknown';
      if (!byYear[year][status]) byYear[year][status] = [];
      byYear[year][status].push(g);
    });

    // Convert to sorted array structure
    const years = Object.keys(byYear).sort((a, b) => {
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      return parseInt(b) - parseInt(a); // Descending by year
    });

    return years.map(year => ({
      year,
      statuses: Object.keys(byYear[year])
        .sort((a, b) => (sortOrder[a] || 999) - (sortOrder[b] || 999))
        .map(status => ({
          status,
          grants: byYear[year][status],
        })),
    }));
  });

  // Sort grants for list view
  let sortedGrants = $derived.by(() => {
    const grants = [...filteredGrants];
    const sortOrder = grantsStore.statusSortOrder;

    // Sort by year (desc), then status (by sort order), then ID
    grants.sort((a, b) => {
      // Year descending
      const yearA = a.Year || 0;
      const yearB = b.Year || 0;
      if (yearA !== yearB) return yearB - yearA;

      // Status by sort order
      const statusOrderA = sortOrder[a.Status] || 999;
      const statusOrderB = sortOrder[b.Status] || 999;
      if (statusOrderA !== statusOrderB) return statusOrderA - statusOrderB;

      // ID alphabetically
      return (a.ID || '').localeCompare(b.ID || '');
    });

    return grants;
  });

  function formatAmount(amount) {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function getPrimaryCategory(grant) {
    const categories = [
      { name: 'A', pct: grant.Cat_A_Percent },
      { name: 'B', pct: grant.Cat_B_Percent },
      { name: 'C', pct: grant.Cat_C_Percent },
      { name: 'D', pct: grant.Cat_D_Percent },
    ].filter(c => c.pct > 0);

    if (categories.length === 0) return null;
    return categories.sort((a, b) => b.pct - a.pct)[0].name;
  }

  function getCategoryColor(category) {
    switch (category) {
      case 'A': return 'bg-blue-100 text-blue-800';
      case 'B': return 'bg-green-100 text-green-800';
      case 'C': return 'bg-orange-100 text-orange-800';
      case 'D': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function handleRowClick(grant) {
    navigate(`/grant/${encodeURIComponent(grant.ID)}`);
  }

  function handleGrantSaved(grant) {
    navigate(`/grant/${encodeURIComponent(grant.ID)}`);
  }

  function handleStatusFilterChange(statuses) {
    selectedStatuses = statuses;
  }

  // Get open action item count for a grant
  function getOpenActionCount(grantId) {
    return actionItemsStore.actionItems.filter(
      item => item.grant_id === grantId && item.status === 'Open'
    ).length;
  }
</script>

<div class="space-y-6">
  <!-- Page Header -->
  <div class="flex justify-between items-start">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Grants</h1>
      <p class="text-gray-500 mt-1">
        {filteredGrants.length} of {grantsStore.grantCount} grants
      </p>
    </div>
    <button
      onclick={() => showNewGrantModal = true}
      class="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
    >
      <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
      </svg>
      New Grant
    </button>
  </div>

  <!-- Filters -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
    <!-- Top row: Search and Year -->
    <div class="flex flex-wrap gap-4">
      <div class="flex-1 min-w-[200px]">
        <label for="grant-search" class="block text-xs font-medium text-gray-500 mb-1">Search</label>
        <input
          id="grant-search"
          type="text"
          placeholder="Search grants..."
          bind:value={searchQuery}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
      <div class="w-32">
        <label for="year-filter" class="block text-xs font-medium text-gray-500 mb-1">Year</label>
        <select
          id="year-filter"
          bind:value={yearFilter}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">All years</option>
          {#each availableYears as year}
            <option value={year}>{year}</option>
          {/each}
        </select>
      </div>
      <div class="w-32">
        <label for="view-mode" class="block text-xs font-medium text-gray-500 mb-1">View</label>
        <select
          id="view-mode"
          bind:value={viewMode}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="grouped">Grouped</option>
          <option value="list">List</option>
        </select>
      </div>
    </div>

    <!-- Status filter chips -->
    <div>
      <label class="block text-xs font-medium text-gray-500 mb-2">Status</label>
      <StatusFilter
        selectedStatuses={selectedStatuses}
        onchange={handleStatusFilterChange}
        grantCounts={grantCountsByStatus}
      />
    </div>

    <!-- Quick filters -->
    <div class="flex items-center gap-3 pt-2 border-t border-gray-100">
      <span class="text-xs font-medium text-gray-500">Quick filters:</span>
      <button
        type="button"
        onclick={() => showOnlyWithActions = !showOnlyWithActions}
        class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full transition-colors {showOnlyWithActions
          ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
        </svg>
        Has open action items
        {#if openActionsCount > 0}
          <span class="text-[10px] {showOnlyWithActions ? 'text-amber-600' : 'text-gray-400'}">
            {openActionsCount}
          </span>
        {/if}
      </button>
    </div>
  </div>

  <!-- Grants Display -->
  {#if grantsStore.isLoading}
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
      <svg class="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-gray-600">Loading grants...</p>
    </div>
  {:else if filteredGrants.length === 0}
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
      <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      {#if grantsStore.grantCount === 0}
        <h3 class="text-lg font-medium text-gray-900 mb-2">No grants yet</h3>
        <p class="text-gray-500">Get started by adding your first grant.</p>
      {:else}
        <h3 class="text-lg font-medium text-gray-900 mb-2">No matching grants</h3>
        <p class="text-gray-500">Try adjusting your search or filters.</p>
      {/if}
    </div>
  {:else if viewMode === 'grouped'}
    <!-- Grouped View -->
    <div class="space-y-6">
      {#each groupedGrants as yearGroup (yearGroup.year)}
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <!-- Year Header -->
          <div class="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">{yearGroup.year}</h2>
          </div>

          {#each yearGroup.statuses as statusGroup (statusGroup.status)}
            <!-- Status Subheader -->
            <div class="px-6 py-2 bg-gray-50/50 border-b border-gray-100 flex items-center gap-2">
              <StatusBadge status={statusGroup.status} />
              <span class="text-xs text-gray-500">({statusGroup.grants.length})</span>
            </div>

            <!-- Grants in this status -->
            <div class="divide-y divide-gray-100">
              {#each statusGroup.grants as grant (grant.ID)}
                {@const openActions = getOpenActionCount(grant.ID)}
                <div
                  class="px-6 py-3 hover:bg-gray-50 cursor-pointer flex items-center gap-4"
                  onclick={() => handleRowClick(grant)}
                  onkeydown={(e) => e.key === 'Enter' && handleRowClick(grant)}
                  role="button"
                  tabindex="0"
                >
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium text-indigo-600">{grant.ID}</span>
                      {#if openActions > 0}
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                          {openActions} action{openActions > 1 ? 's' : ''}
                        </span>
                      {/if}
                    </div>
                    <div class="text-xs text-gray-500 truncate">{grant.Title || grant.Organization || '—'}</div>
                  </div>
                  {#if getPrimaryCategory(grant)}
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {getCategoryColor(getPrimaryCategory(grant))}">
                      {getPrimaryCategory(grant)}
                    </span>
                  {/if}
                  <div class="text-sm text-gray-900 w-24 text-right">
                    {formatAmount(grant.Amount)}
                  </div>
                </div>
              {/each}
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {:else}
    <!-- List View (Table) -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Grant
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Organization
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Category
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Amount
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Year
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each sortedGrants as grant (grant.ID)}
            {@const openActions = getOpenActionCount(grant.ID)}
            <tr
              class="hover:bg-gray-50 cursor-pointer"
              onclick={() => handleRowClick(grant)}
            >
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center gap-2">
                  <div>
                    <div class="text-sm font-medium text-indigo-600">{grant.ID}</div>
                    <div class="text-xs text-gray-500">{grant.Title || '—'}</div>
                  </div>
                  {#if openActions > 0}
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                      {openActions}
                    </span>
                  {/if}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {grant.Organization || '—'}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                {#if getPrimaryCategory(grant)}
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getCategoryColor(getPrimaryCategory(grant))}">
                    {getPrimaryCategory(grant)}
                  </span>
                {:else}
                  <span class="text-gray-400">—</span>
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {formatAmount(grant.Amount)}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <StatusBadge status={grant.Status} />
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {grant.Year || '—'}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- Results count -->
  {#if filteredGrants.length > 0}
    <div class="text-sm text-gray-500">
      Showing {filteredGrants.length} of {grantsStore.grantCount} grants
    </div>
  {/if}
</div>

<!-- New Grant Modal -->
{#if showNewGrantModal}
  <GrantFormModal
    onClose={() => showNewGrantModal = false}
    onSaved={handleGrantSaved}
  />
{/if}
