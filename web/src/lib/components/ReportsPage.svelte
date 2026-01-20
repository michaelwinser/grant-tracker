<script>
  import { grantsStore } from '../stores/grants.svelte.js';
  import { userStore } from '../stores/user.svelte.js';
  import { navigate } from '../router.svelte.js';
  import { listFiles } from '../api/drive.js';

  // State
  let allReports = $state([]);
  let isLoading = $state(false);
  let error = $state(null);
  let loadedGrantIds = $state(new Set());
  let loadInitiated = $state(false);

  // Filter state
  let grantFilter = $state('');
  let searchQuery = $state('');

  // Get grants that have folders
  let grantsWithFolders = $derived.by(() => {
    return grantsStore.grants.filter(g => g.Folder_URL);
  });

  // Extract folder ID from URL
  function getFolderIdFromUrl(url) {
    if (!url) return null;
    const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  // Load reports when grants are available
  $effect(() => {
    const grants = grantsWithFolders;
    const token = userStore.accessToken;

    if (grants.length > 0 && token && !loadInitiated) {
      loadInitiated = true;
      loadAllReports();
    }
  });

  async function loadAllReports() {
    isLoading = true;
    error = null;
    allReports = [];
    loadedGrantIds = new Set();

    try {
      const grants = grantsWithFolders;

      // Load reports for each grant in parallel (with concurrency limit)
      const batchSize = 5;
      for (let i = 0; i < grants.length; i += batchSize) {
        const batch = grants.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(grant => loadGrantReports(grant))
        );

        // Flatten and add to allReports
        for (const reports of results) {
          if (reports.length > 0) {
            allReports = [...allReports, ...reports];
          }
        }
      }

      // Sort by modified time, most recent first
      allReports = allReports.sort((a, b) => {
        if (a.modifiedTime && b.modifiedTime) {
          return b.modifiedTime.localeCompare(a.modifiedTime);
        }
        return 0;
      });
    } catch (err) {
      error = err.message;
    } finally {
      isLoading = false;
    }
  }

  async function loadGrantReports(grant) {
    const folderId = getFolderIdFromUrl(grant.Folder_URL);
    if (!folderId) return [];

    try {
      // First, list files in grant folder to find Reports subfolder
      const grantFiles = await listFiles(userStore.accessToken, folderId);
      const reportsFolder = grantFiles.find(
        f => f.mimeType === 'application/vnd.google-apps.folder' && f.name === 'Reports'
      );

      if (!reportsFolder) return [];

      // List files in Reports folder
      const reportFiles = await listFiles(userStore.accessToken, reportsFolder.id);

      loadedGrantIds = new Set([...loadedGrantIds, grant.ID]);

      // Add grant info to each report
      return reportFiles.map(file => ({
        ...file,
        grantId: grant.ID,
        grantTitle: grant.Title,
        reportsFolderId: reportsFolder.id,
      }));
    } catch (err) {
      console.error(`Failed to load reports for ${grant.ID}:`, err);
      return [];
    }
  }

  // Filter reports
  let filteredReports = $derived.by(() => {
    let items = [...allReports];

    // Apply grant filter
    if (grantFilter) {
      items = items.filter(r => r.grantId === grantFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(r =>
        r.name.toLowerCase().includes(query) ||
        r.grantId.toLowerCase().includes(query) ||
        (r.grantTitle && r.grantTitle.toLowerCase().includes(query))
      );
    }

    return items;
  });

  // Get unique grants from reports
  let grantsInReports = $derived.by(() => {
    const grantIds = new Set(allReports.map(r => r.grantId));
    return grantsStore.grants.filter(g => grantIds.has(g.ID));
  });

  // Navigate to grant
  function goToGrant(grantId, event) {
    event.stopPropagation();
    navigate(`/grant/${encodeURIComponent(grantId)}`);
  }

  // Clear filters
  function clearFilters() {
    grantFilter = '';
    searchQuery = '';
  }

  // Format file size (if available)
  function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // Get file icon based on mime type
  function getFileIcon(mimeType) {
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType === 'application/vnd.google-apps.document') return 'doc';
    if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'sheet';
    if (mimeType?.startsWith('image/')) return 'image';
    return 'file';
  }

  function refresh() {
    loadInitiated = false;
    loadAllReports();
    loadInitiated = true;
  }
</script>

<div class="space-y-6">
  <!-- Page Header -->
  <div class="flex justify-between items-start">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Reports</h1>
      <p class="text-gray-500 mt-1">
        {allReports.length} report{allReports.length !== 1 ? 's' : ''} from {loadedGrantIds.size} grant{loadedGrantIds.size !== 1 ? 's' : ''}
      </p>
    </div>
    <button
      onclick={refresh}
      disabled={isLoading}
      class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
    >
      <svg class="w-4 h-4 {isLoading ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      {isLoading ? 'Loading...' : 'Refresh'}
    </button>
  </div>

  <!-- Error display -->
  {#if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
      {error}
      <button onclick={() => error = null} class="ml-2 text-red-500 hover:text-red-700">Dismiss</button>
    </div>
  {/if}

  <!-- Filters -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
    <div class="flex flex-wrap gap-4 items-end">
      <div class="flex-1 min-w-[200px]">
        <label for="search" class="block text-xs font-medium text-gray-500 mb-1">Search</label>
        <input
          type="text"
          id="search"
          bind:value={searchQuery}
          placeholder="Search reports..."
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
      <div class="w-48">
        <label for="grant-filter" class="block text-xs font-medium text-gray-500 mb-1">Grant</label>
        <select
          id="grant-filter"
          bind:value={grantFilter}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">All grants</option>
          {#each grantsInReports as grant}
            <option value={grant.ID}>{grant.ID}</option>
          {/each}
        </select>
      </div>
      {#if grantFilter || searchQuery}
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
  {#if isLoading && allReports.length === 0}
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
      <svg class="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-gray-600">Loading reports from Drive...</p>
    </div>
  {:else if grantsWithFolders.length === 0}
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
      <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
      <h3 class="text-lg font-medium text-gray-900 mb-2">No grant folders set up</h3>
      <p class="text-gray-500">Create folders for your grants to start tracking reports.</p>
    </div>
  {:else if filteredReports.length === 0}
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
      <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      {#if allReports.length === 0}
        <h3 class="text-lg font-medium text-gray-900 mb-2">No reports yet</h3>
        <p class="text-gray-500">Reports will appear here when files are added to grant Reports/ folders in Drive.</p>
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
              Report
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Grant
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each filteredReports as report (report.id)}
            <tr class="hover:bg-gray-50">
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div class="flex-shrink-0">
                    {#if getFileIcon(report.mimeType) === 'pdf'}
                      <svg class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                      </svg>
                    {:else if getFileIcon(report.mimeType) === 'doc'}
                      <svg class="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                      </svg>
                    {:else if getFileIcon(report.mimeType) === 'sheet'}
                      <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                      </svg>
                    {:else if getFileIcon(report.mimeType) === 'image'}
                      <svg class="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    {:else}
                      <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    {/if}
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">
                      {report.name}
                    </p>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <button
                  onclick={(e) => goToGrant(report.grantId, e)}
                  class="text-sm text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
                >
                  {report.grantId}
                </button>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(report.modifiedTime)}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm">
                <a
                  href={report.webViewLink || `https://drive.google.com/file/d/${report.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  View
                </a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Results count -->
    <div class="text-sm text-gray-500">
      Showing {filteredReports.length} of {allReports.length} reports
    </div>
  {/if}
</div>
