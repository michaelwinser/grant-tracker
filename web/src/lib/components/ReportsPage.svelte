<script>
  import { reportsStore } from '../stores/reports.svelte.js';
  import { grantsStore } from '../stores/grants.svelte.js';
  import { navigate } from '../router.svelte.js';
  import { ReportStatus, ReportType, todayDate } from '../models.js';

  // Filter state
  let statusFilter = $state('expected');
  let typeFilter = $state('');
  let grantFilter = $state('');
  let periodFilter = $state('');

  // Mark received modal state
  let showMarkReceivedModal = $state(false);
  let selectedReport = $state(null);
  let receivedDate = $state(todayDate());
  let receivedUrl = $state('');
  let isSubmitting = $state(false);

  // Error state
  let reportError = $state('');

  // Get unique periods from reports (e.g., "2026-01", "2026-Q1")
  let availablePeriods = $derived(() => {
    const periods = new Set();
    reportsStore.reports.forEach(report => {
      if (report.period) periods.add(report.period);
    });
    return Array.from(periods).sort().reverse();
  });

  // Get grants that have reports
  let grantsWithReports = $derived(() => {
    const grantIds = new Set();
    reportsStore.reports.forEach(report => {
      if (report.grant_id) grantIds.add(report.grant_id);
    });
    return grantsStore.grants.filter(g => grantIds.has(g.grant_id));
  });

  // Filter reports
  let filteredReports = $derived(() => {
    let items = [...reportsStore.reports];
    const today = todayDate();

    // Apply status filter
    if (statusFilter === 'expected') {
      items = items.filter(r => r.status === ReportStatus.EXPECTED);
    } else if (statusFilter === 'received') {
      items = items.filter(r => r.status === ReportStatus.RECEIVED);
    } else if (statusFilter === 'overdue') {
      items = items.filter(r => r.status === ReportStatus.EXPECTED && r.due_date && r.due_date < today);
    }

    // Apply type filter
    if (typeFilter) {
      items = items.filter(r => r.report_type === typeFilter);
    }

    // Apply grant filter
    if (grantFilter) {
      items = items.filter(r => r.grant_id === grantFilter);
    }

    // Apply period filter
    if (periodFilter) {
      items = items.filter(r => r.period === periodFilter);
    }

    // Sort by due date (earliest first)
    items.sort((a, b) => {
      if (a.due_date && b.due_date) {
        return a.due_date.localeCompare(b.due_date);
      }
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });

    return items;
  });

  // Check if report is overdue
  function isOverdue(report) {
    if (report.status !== ReportStatus.EXPECTED) return false;
    return report.due_date && report.due_date < todayDate();
  }

  // Get status badge class
  function getStatusBadgeClass(report) {
    if (report.status === ReportStatus.RECEIVED) {
      return 'bg-green-100 text-green-800';
    }
    if (isOverdue(report)) {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-yellow-100 text-yellow-800';
  }

  // Get status text
  function getStatusText(report) {
    if (report.status === ReportStatus.RECEIVED) {
      return 'Received';
    }
    if (isOverdue(report)) {
      return 'Overdue';
    }
    return 'Expected';
  }

  // Format due date
  function formatDueDate(dueDate) {
    if (!dueDate) return '—';
    const date = new Date(dueDate);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Format received date
  function formatReceivedDate(date) {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Get grant title
  function getGrantTitle(grantId) {
    const grant = grantsStore.getById(grantId);
    return grant?.title || grantId;
  }

  // Open mark received modal
  function openMarkReceived(report) {
    selectedReport = report;
    receivedDate = todayDate();
    receivedUrl = '';
    showMarkReceivedModal = true;
  }

  // Handle mark received submission
  async function handleMarkReceived() {
    if (!selectedReport) return;

    isSubmitting = true;
    reportError = '';

    try {
      await reportsStore.markReceived(
        selectedReport.report_id,
        receivedDate,
        receivedUrl || null
      );
      showMarkReceivedModal = false;
      selectedReport = null;
    } catch (err) {
      reportError = err.message;
    } finally {
      isSubmitting = false;
    }
  }

  // Handle reset to expected
  async function handleResetToExpected(report) {
    reportError = '';
    try {
      await reportsStore.resetToExpected(report.report_id);
    } catch (err) {
      reportError = err.message;
    }
  }

  // Navigate to grant
  function goToGrant(grantId, event) {
    event.stopPropagation();
    navigate(`/grant/${encodeURIComponent(grantId)}`);
  }

  // Clear filters
  function clearFilters() {
    statusFilter = 'expected';
    typeFilter = '';
    grantFilter = '';
    periodFilter = '';
  }

  // Count stats
  let stats = $derived(() => {
    const today = todayDate();
    const expected = reportsStore.reports.filter(r => r.status === ReportStatus.EXPECTED).length;
    const overdue = reportsStore.reports.filter(r =>
      r.status === ReportStatus.EXPECTED && r.due_date && r.due_date < today
    ).length;
    const received = reportsStore.reports.filter(r => r.status === ReportStatus.RECEIVED).length;
    return { expected, overdue, received };
  });
</script>

<div class="space-y-6">
  <!-- Page Header -->
  <div class="flex justify-between items-start">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Report Compliance</h1>
      <p class="text-gray-500 mt-1">
        {stats().expected} expected · {stats().overdue} overdue · {stats().received} received
      </p>
    </div>
  </div>

  <!-- Error display -->
  {#if reportError}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
      {reportError}
      <button onclick={() => reportError = ''} class="ml-2 text-red-500 hover:text-red-700">Dismiss</button>
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
          <option value="expected">Expected</option>
          <option value="overdue">Overdue</option>
          <option value="received">Received</option>
        </select>
      </div>
      <div class="w-36">
        <label for="type-filter" class="block text-xs font-medium text-gray-500 mb-1">Type</label>
        <select
          id="type-filter"
          bind:value={typeFilter}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">All types</option>
          {#each Object.values(ReportType) as type}
            <option value={type}>{type}</option>
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
          {#each grantsWithReports() as grant}
            <option value={grant.grant_id}>{grant.grant_id}</option>
          {/each}
        </select>
      </div>
      <div class="w-40">
        <label for="period-filter" class="block text-xs font-medium text-gray-500 mb-1">Period</label>
        <select
          id="period-filter"
          bind:value={periodFilter}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">All periods</option>
          {#each availablePeriods() as period}
            <option value={period}>{period}</option>
          {/each}
        </select>
      </div>
      {#if typeFilter || grantFilter || periodFilter || statusFilter !== 'expected'}
        <button
          onclick={clearFilters}
          class="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
        >
          Clear filters
        </button>
      {/if}
    </div>
  </div>

  <!-- Reports list -->
  {#if reportsStore.isLoading}
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
      <svg class="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-gray-600">Loading reports...</p>
    </div>
  {:else if filteredReports().length === 0}
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
      <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      {#if reportsStore.reports.length === 0}
        <h3 class="text-lg font-medium text-gray-900 mb-2">No reports yet</h3>
        <p class="text-gray-500">Expected reports will appear here when added to grants.</p>
      {:else}
        <h3 class="text-lg font-medium text-gray-900 mb-2">No matching reports</h3>
        <p class="text-gray-500">Try adjusting your filters.</p>
      {/if}
    </div>
  {:else}
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Grant
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Period
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Due Date
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each filteredReports() as report (report.report_id)}
            <tr class="hover:bg-gray-50 {isOverdue(report) ? 'bg-red-50/50' : ''}">
              <td class="px-6 py-4 whitespace-nowrap">
                {#if report.grant_id}
                  <button
                    onclick={(e) => goToGrant(report.grant_id, e)}
                    class="text-sm text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
                  >
                    {report.grant_id}
                  </button>
                {:else}
                  <span class="text-gray-400">—</span>
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {report.period || '—'}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {report.report_type || '—'}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                <span class="{isOverdue(report) ? 'text-red-600 font-medium' : 'text-gray-900'}">
                  {formatDueDate(report.due_date)}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusBadgeClass(report)}">
                  {getStatusText(report)}
                </span>
                {#if report.status === ReportStatus.RECEIVED && report.received_date}
                  <span class="ml-2 text-xs text-gray-500">
                    {formatReceivedDate(report.received_date)}
                  </span>
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm">
                {#if report.status === ReportStatus.EXPECTED}
                  <button
                    onclick={() => openMarkReceived(report)}
                    class="text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Mark Received
                  </button>
                {:else if report.status === ReportStatus.RECEIVED}
                  <button
                    onclick={() => handleResetToExpected(report)}
                    class="text-gray-500 hover:text-gray-700"
                  >
                    Reset
                  </button>
                  {#if report.url}
                    <a
                      href={report.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="ml-3 text-indigo-600 hover:text-indigo-800"
                    >
                      View
                    </a>
                  {/if}
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Results count -->
    <div class="text-sm text-gray-500">
      Showing {filteredReports().length} of {reportsStore.reports.length} reports
    </div>
  {/if}
</div>

<!-- Mark Received Modal -->
{#if showMarkReceivedModal && selectedReport}
  <div class="fixed inset-0 z-50 overflow-y-auto">
    <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
      <!-- Backdrop -->
      <button
        type="button"
        class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity cursor-default"
        onclick={() => showMarkReceivedModal = false}
        aria-label="Close modal"
      ></button>

      <!-- Modal -->
      <div class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
        <div>
          <h3 class="text-lg font-medium text-gray-900 mb-4">
            Mark Report Received
          </h3>
          <p class="text-sm text-gray-600 mb-4">
            {selectedReport.report_type} report for {selectedReport.grant_id}
            {#if selectedReport.period}
              ({selectedReport.period})
            {/if}
          </p>

          <div class="space-y-4">
            <div>
              <label for="received-date" class="block text-sm font-medium text-gray-700 mb-1">
                Date Received
              </label>
              <input
                type="date"
                id="received-date"
                bind:value={receivedDate}
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label for="report-url" class="block text-sm font-medium text-gray-700 mb-1">
                Report URL (optional)
              </label>
              <input
                type="url"
                id="report-url"
                bind:value={receivedUrl}
                placeholder="https://..."
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onclick={() => showMarkReceivedModal = false}
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="button"
            onclick={handleMarkReceived}
            disabled={isSubmitting}
            class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Mark Received'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
