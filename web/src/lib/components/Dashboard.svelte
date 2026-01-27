<script>
  import { grantsStore } from '../stores/grants.svelte.js';
  import { actionItemsStore } from '../stores/actionItems.svelte.js';
  import { userStore } from '../stores/user.svelte.js';
  import { router, navigate, updateQuery, getCurrentYear } from '../router.svelte.js';
  import StatusBadge from './StatusBadge.svelte';

  // Initialize year filter from URL or default to current year
  const currentYear = getCurrentYear();
  let yearFilter = $state(router.query.year || String(currentYear));
  let lastYearUpdate = yearFilter;

  // Update URL when year filter changes (with loop prevention)
  $effect(() => {
    if (yearFilter !== lastYearUpdate) {
      lastYearUpdate = yearFilter;
      updateQuery({ year: yearFilter === '' ? null : yearFilter });
    }
  });

  // Get unique years from grants (as strings for select binding)
  let availableYears = $derived.by(() => {
    const years = new Set();
    grantsStore.grants.forEach(g => {
      if (g.Year) years.add(String(g.Year));
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  });

  // Filter grants by year
  let filteredGrants = $derived.by(() => {
    if (!yearFilter) return grantsStore.grants;
    return grantsStore.grants.filter(g => g.Year === parseInt(yearFilter));
  });

  // Pipeline stages with colors - only show visible statuses
  let pipelineStages = $derived.by(() => {
    const colorMap = {
      'Initial Contact': 'bg-gray-100 text-gray-800 border-gray-200',
      'Meeting': 'bg-blue-100 text-blue-800 border-blue-200',
      'Proposal Development': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Stakeholder Review': 'bg-purple-100 text-purple-800 border-purple-200',
      'Approved': 'bg-green-100 text-green-800 border-green-200',
      'Notification': 'bg-teal-100 text-teal-800 border-teal-200',
      'Signing': 'bg-orange-100 text-orange-800 border-orange-200',
      'Disbursement': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'Active': 'bg-green-100 text-green-800 border-green-200',
      'Finished': 'bg-gray-100 text-gray-600 border-gray-200',
      'Rejected': 'bg-red-100 text-red-800 border-red-200',
      'Deferred': 'bg-gray-100 text-gray-500 border-gray-200',
    };
    // Only show visible statuses (not hidden by default)
    return grantsStore.visibleStatuses.map(status => ({
      status,
      color: colorMap[status] || 'bg-gray-100 text-gray-800 border-gray-200',
    }));
  });

  // Get grants grouped by status (for current year filter)
  let grantsByStatus = $derived.by(() => {
    const counts = {};
    filteredGrants.forEach(g => {
      counts[g.Status] = (counts[g.Status] || 0) + 1;
    });
    return counts;
  });

  // Get recent grants (first 5 filtered by year)
  let recentGrants = $derived(filteredGrants.slice(0, 5));

  // Count grants with open action items
  let grantsWithOpenActions = $derived(
    filteredGrants.filter(g => {
      return actionItemsStore.openItems.some(item => item.grant_id === g.ID);
    }).length
  );

  // Count overdue action items
  let overdueActionCount = $derived(actionItemsStore.overdueItems.length);
</script>

<div class="space-y-6">
  <!-- Page Header -->
  <div class="flex justify-between items-start">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p class="text-gray-500 mt-1">Welcome back, {userStore.user?.name || 'User'}</p>
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
  </div>

  <!-- Pipeline Summary -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">Pipeline {yearFilter ? `(${yearFilter})` : ''}</h2>
    <div class="flex flex-wrap gap-3">
      {#each pipelineStages as stage}
        {@const count = grantsByStatus[stage.status] || 0}
        {#if count > 0}
          <a
            href="#/grants?status={encodeURIComponent(stage.status)}{yearFilter ? `&year=${yearFilter}` : ''}"
            class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border {stage.color} hover:opacity-80 transition-opacity"
          >
            <span class="text-2xl font-bold">{count}</span>
            <span class="text-sm">{stage.status}</span>
          </a>
        {/if}
      {/each}
      {#if filteredGrants.length === 0}
        <p class="text-gray-500 text-sm">No grants in the pipeline{yearFilter ? ` for ${yearFilter}` : ''}.</p>
      {/if}
    </div>
  </div>

  <!-- Quick Stats -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
    <a href="#/grants{yearFilter ? `?year=${yearFilter}` : ''}" class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-indigo-300 transition-colors">
      <p class="text-sm text-gray-500 font-medium">Grants {yearFilter ? `(${yearFilter})` : ''}</p>
      <p class="text-2xl font-bold text-gray-900 mt-1">{filteredGrants.length}</p>
    </a>
    <a href="#/grants?status=Active{yearFilter ? `&year=${yearFilter}` : ''}" class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-green-300 transition-colors">
      <p class="text-sm text-green-600 font-medium">Active</p>
      <p class="text-2xl font-bold text-green-900 mt-1">{grantsByStatus['Active'] || 0}</p>
    </a>
    <a href="#/grants?actions=open{yearFilter ? `&year=${yearFilter}` : ''}" class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-amber-300 transition-colors">
      <p class="text-sm text-amber-600 font-medium">Need Attention</p>
      <p class="text-2xl font-bold text-amber-900 mt-1">{grantsWithOpenActions}</p>
    </a>
    <a href="#/action-items" class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-red-300 transition-colors">
      <p class="text-sm text-red-600 font-medium">Overdue Actions</p>
      <p class="text-2xl font-bold text-red-900 mt-1">{overdueActionCount}</p>
    </a>
  </div>

  <!-- Recent Grants -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200">
    <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
      <h2 class="text-lg font-semibold text-gray-900">Recent Grants {yearFilter ? `(${yearFilter})` : ''}</h2>
      <a href="#/grants{yearFilter ? `?year=${yearFilter}` : ''}" class="text-sm text-indigo-600 hover:text-indigo-800">View all →</a>
    </div>
    {#if recentGrants.length === 0}
      <div class="px-6 py-8 text-center text-gray-500">
        <p>No grants yet. Create your first grant to get started.</p>
      </div>
    {:else}
      <ul class="divide-y divide-gray-100">
        {#each recentGrants as grant (grant.ID)}
          <li>
            <a href="#/grant/{encodeURIComponent(grant.ID)}" class="block px-6 py-4 hover:bg-gray-50">
              <div class="flex items-center justify-between">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-indigo-600 truncate">{grant.ID}</p>
                  <p class="text-xs text-gray-500 truncate">{grant.Title || grant.Organization || '—'}</p>
                </div>
                <div class="ml-4 flex items-center gap-3">
                  <StatusBadge status={grant.Status} />
                </div>
              </div>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
