<script>
  import { grantsStore } from '../stores/grants.svelte.js';
  import { actionItemsStore } from '../stores/actionItems.svelte.js';
  import { reportsStore } from '../stores/reports.svelte.js';
  import { userStore } from '../stores/user.svelte.js';
  import { navigate } from '../router.svelte.js';
  import StatusBadge from './StatusBadge.svelte';

  // Get recent grants (last 5 updated)
  let recentGrants = $derived(() => {
    return [...grantsStore.grants]
      .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
      .slice(0, 5);
  });

  // Get my action items (current user's open items)
  let myOpenItems = $derived(() => {
    const userEmail = userStore.user?.email;
    const userName = userStore.user?.name;
    return actionItemsStore.openItems.filter(item => {
      const assignee = item.assignee?.toLowerCase() || '';
      return assignee.includes(userEmail?.toLowerCase() || '') ||
             assignee.includes(userName?.toLowerCase() || '') ||
             assignee === userName;
    }).slice(0, 5);
  });

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }

  function formatDueDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((date - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `Due in ${diffDays} days`;
  }

  function isOverdue(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  }
</script>

<div class="space-y-6">
  <!-- Page Header -->
  <div>
    <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
    <p class="text-gray-500 mt-1">Welcome back, {userStore.user?.name || 'User'}</p>
  </div>

  <!-- Quick Stats -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
    <a href="#/grants" class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-indigo-300 transition-colors">
      <p class="text-sm text-gray-500 font-medium">Total Grants</p>
      <p class="text-2xl font-bold text-gray-900 mt-1">{grantsStore.grantCount}</p>
    </a>
    <a href="#/grants?status=Active" class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-green-300 transition-colors">
      <p class="text-sm text-green-600 font-medium">Active Grants</p>
      <p class="text-2xl font-bold text-green-900 mt-1">{grantsStore.activeGrants.length}</p>
    </a>
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <p class="text-sm text-yellow-600 font-medium">Open Action Items</p>
      <p class="text-2xl font-bold text-yellow-900 mt-1">{actionItemsStore.openItems.length}</p>
    </div>
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <p class="text-sm text-red-600 font-medium">Overdue Reports</p>
      <p class="text-2xl font-bold text-red-900 mt-1">{reportsStore.overdueReports.length}</p>
    </div>
  </div>

  <div class="grid lg:grid-cols-2 gap-6">
    <!-- My Action Items -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200">
      <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h2 class="text-lg font-semibold text-gray-900">My Action Items</h2>
        <span class="text-sm text-gray-500">{myOpenItems().length} open</span>
      </div>
      {#if myOpenItems().length === 0}
        <div class="px-6 py-8 text-center text-gray-500">
          <svg class="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>No open action items assigned to you.</p>
        </div>
      {:else}
        <ul class="divide-y divide-gray-100">
          {#each myOpenItems() as item (item.item_id)}
            <li class="px-6 py-4 hover:bg-gray-50">
              <div class="flex items-start gap-3">
                <input type="checkbox" disabled class="mt-1 h-4 w-4 rounded border-gray-300" />
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-gray-900">{item.description}</p>
                  <div class="flex items-center gap-2 mt-1">
                    <a href="#/grant/{encodeURIComponent(item.grant_id)}" class="text-xs text-indigo-600 hover:underline">
                      {item.grant_id}
                    </a>
                    {#if item.due_date}
                      <span class="text-xs {isOverdue(item.due_date) ? 'text-red-600 font-medium' : 'text-gray-500'}">
                        {formatDueDate(item.due_date)}
                      </span>
                    {/if}
                  </div>
                </div>
                {#if isOverdue(item.due_date)}
                  <span class="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                    Overdue
                  </span>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <!-- Recent Grants -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200">
      <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h2 class="text-lg font-semibold text-gray-900">Recent Activity</h2>
        <a href="#/grants" class="text-sm text-indigo-600 hover:text-indigo-800">View all →</a>
      </div>
      {#if recentGrants().length === 0}
        <div class="px-6 py-8 text-center text-gray-500">
          <p>No grants yet. Create your first grant to get started.</p>
        </div>
      {:else}
        <ul class="divide-y divide-gray-100">
          {#each recentGrants() as grant (grant.grant_id)}
            <li>
              <a href="#/grant/{encodeURIComponent(grant.grant_id)}" class="block px-6 py-4 hover:bg-gray-50">
                <div class="flex items-center justify-between">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-indigo-600 truncate">{grant.grant_id}</p>
                    <p class="text-xs text-gray-500 truncate">{grant.title || grant.organization || '—'}</p>
                  </div>
                  <div class="ml-4 flex items-center gap-3">
                    <StatusBadge status={grant.status} />
                    <span class="text-xs text-gray-400">{formatDate(grant.updated_at)}</span>
                  </div>
                </div>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>

  <!-- Reports Due This Month -->
  {#if reportsStore.reportsDueThisMonth.length > 0}
    <div class="bg-white rounded-lg shadow-sm border border-gray-200">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">Reports Due This Month</h2>
      </div>
      <ul class="divide-y divide-gray-100">
        {#each reportsStore.reportsDueThisMonth as report (report.report_id)}
          <li class="px-6 py-4 hover:bg-gray-50 flex items-center justify-between">
            <div>
              <a href="#/grant/{encodeURIComponent(report.grant_id)}" class="text-sm font-medium text-indigo-600 hover:underline">
                {report.grant_id}
              </a>
              <p class="text-xs text-gray-500">{report.report_type} · {report.period}</p>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs text-gray-500">Due {formatDate(report.due_date)}</span>
              {#if report.status === 'Overdue'}
                <span class="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                  Overdue
                </span>
              {:else if report.status === 'Received'}
                <span class="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                  Received
                </span>
              {:else}
                <span class="inline-flex items-center rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700">
                  Expected
                </span>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>
