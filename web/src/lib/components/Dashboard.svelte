<script>
  import { grantsStore } from '../stores/grants.svelte.js';
  import { userStore } from '../stores/user.svelte.js';
  import { navigate } from '../router.svelte.js';
  import StatusBadge from './StatusBadge.svelte';

  // Pipeline stages with colors - derived from statusValues
  let pipelineStages = $derived(() => {
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
    return grantsStore.statusValues.map(status => ({
      status,
      color: colorMap[status] || 'bg-gray-100 text-gray-800 border-gray-200',
    }));
  });

  // Get grants grouped by status
  let grantsByStatus = $derived(() => {
    const counts = {};
    grantsStore.grants.forEach(g => {
      counts[g.Status] = (counts[g.Status] || 0) + 1;
    });
    return counts;
  });

  // Get recent grants (first 5 in the list)
  let recentGrants = $derived(() => {
    return grantsStore.grants.slice(0, 5);
  });
</script>

<div class="space-y-6">
  <!-- Page Header -->
  <div>
    <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
    <p class="text-gray-500 mt-1">Welcome back, {userStore.user?.name || 'User'}</p>
  </div>

  <!-- Pipeline Summary -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">Pipeline</h2>
    <div class="flex flex-wrap gap-3">
      {#each pipelineStages() as stage}
        {@const count = grantsByStatus()[stage.status] || 0}
        {#if count > 0}
          <a
            href="#/grants?status={encodeURIComponent(stage.status)}"
            class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border {stage.color} hover:opacity-80 transition-opacity"
          >
            <span class="text-2xl font-bold">{count}</span>
            <span class="text-sm">{stage.status}</span>
          </a>
        {/if}
      {/each}
      {#if grantsStore.grantCount === 0}
        <p class="text-gray-500 text-sm">No grants in the pipeline yet.</p>
      {/if}
    </div>
  </div>

  <!-- Quick Stats -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <a href="#/grants" class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-indigo-300 transition-colors">
      <p class="text-sm text-gray-500 font-medium">Total Grants</p>
      <p class="text-2xl font-bold text-gray-900 mt-1">{grantsStore.grantCount}</p>
    </a>
    <a href="#/grants" class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-green-300 transition-colors">
      <p class="text-sm text-green-600 font-medium">Active Grants</p>
      <p class="text-2xl font-bold text-green-900 mt-1">{grantsStore.activeGrants.length}</p>
    </a>
  </div>

  <!-- Recent Grants -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200">
    <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
      <h2 class="text-lg font-semibold text-gray-900">Grants</h2>
      <a href="#/grants" class="text-sm text-indigo-600 hover:text-indigo-800">View all →</a>
    </div>
    {#if recentGrants().length === 0}
      <div class="px-6 py-8 text-center text-gray-500">
        <p>No grants yet. Create your first grant to get started.</p>
      </div>
    {:else}
      <ul class="divide-y divide-gray-100">
        {#each recentGrants() as grant (grant.ID)}
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
