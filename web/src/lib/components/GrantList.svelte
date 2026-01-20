<script>
  import { grantsStore } from '../stores/grants.svelte.js';
  import { router, navigate } from '../router.svelte.js';
  import StatusBadge from './StatusBadge.svelte';
  import GrantFormModal from './GrantFormModal.svelte';

  // Modal state
  let showNewGrantModal = $state(false);

  // Filter state - initialize from URL query params
  let searchQuery = $state('');
  let statusFilter = $state(router.query.status || '');
  let yearFilter = $state(router.query.year || '');

  // Sort state
  let sortColumn = $state('ID');
  let sortDirection = $state('asc');

  // Get unique years from grants
  let availableYears = $derived(() => {
    const years = new Set();
    grantsStore.grants.forEach(g => {
      if (g.Year) years.add(g.Year);
    });
    return Array.from(years).sort((a, b) => b - a);
  });

  // Filter and sort grants
  let filteredGrants = $derived(() => {
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
    if (statusFilter) {
      result = result.filter(g => g.Status === statusFilter);
    }

    // Apply year filter
    if (yearFilter) {
      result = result.filter(g => g.Year === parseInt(yearFilter));
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];

      // Handle null/undefined values
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      // Numeric comparison for amount and year
      if (sortColumn === 'Amount' || sortColumn === 'Year') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  });

  function handleSort(column) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }
  }

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
    // Find the category with highest percentage
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

  function getSortIcon(column) {
    if (sortColumn !== column) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  }

  function handleGrantSaved(grant) {
    // Navigate to the new grant's detail page
    navigate(`/grant/${encodeURIComponent(grant.ID)}`);
  }
</script>

<div class="space-y-6">
  <!-- Page Header -->
  <div class="flex justify-between items-start">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Grants</h1>
      <p class="text-gray-500 mt-1">
        {grantsStore.grantCount} grants · {grantsStore.activeGrants.length} active
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
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
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
      <div class="w-48">
        <label for="status-filter" class="block text-xs font-medium text-gray-500 mb-1">Status</label>
        <select
          id="status-filter"
          bind:value={statusFilter}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">All statuses</option>
          {#each grantsStore.statusValues as status}
            <option value={status}>{status}</option>
          {/each}
        </select>
      </div>
      <div class="w-32">
        <label for="year-filter" class="block text-xs font-medium text-gray-500 mb-1">Year</label>
        <select
          id="year-filter"
          bind:value={yearFilter}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">All years</option>
          {#each availableYears() as year}
            <option value={year}>{year}</option>
          {/each}
        </select>
      </div>
    </div>
  </div>

  <!-- Grants Table -->
  {#if grantsStore.isLoading}
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
      <svg class="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-gray-600">Loading grants...</p>
    </div>
  {:else if filteredGrants().length === 0}
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
  {:else}
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onclick={() => handleSort('ID')}
            >
              Grant <span class="text-gray-400">{getSortIcon('ID')}</span>
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onclick={() => handleSort('Organization')}
            >
              Organization <span class="text-gray-400">{getSortIcon('Organization')}</span>
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Category
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onclick={() => handleSort('Amount')}
            >
              Amount <span class="text-gray-400">{getSortIcon('Amount')}</span>
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onclick={() => handleSort('Status')}
            >
              Status <span class="text-gray-400">{getSortIcon('Status')}</span>
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onclick={() => handleSort('Year')}
            >
              Year <span class="text-gray-400">{getSortIcon('Year')}</span>
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each filteredGrants() as grant (grant.ID)}
            <tr
              class="hover:bg-gray-50 cursor-pointer"
              onclick={() => handleRowClick(grant)}
            >
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-indigo-600">{grant.ID}</div>
                <div class="text-xs text-gray-500">{grant.Title || '—'}</div>
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

    <!-- Results count -->
    <div class="text-sm text-gray-500">
      Showing {filteredGrants().length} of {grantsStore.grantCount} grants
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
