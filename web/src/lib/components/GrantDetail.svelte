<script>
  import { grantsStore } from '../stores/grants.svelte.js';
  import { folderStore } from '../stores/folder.svelte.js';
  import { userStore } from '../stores/user.svelte.js';
  import { router, navigate } from '../router.svelte.js';
  import StatusBadge from './StatusBadge.svelte';
  import GrantFormModal from './GrantFormModal.svelte';
  import { createGrantFolderStructure, listFiles, addFileToFolder } from '../api/drive.js';
  import { openFilePicker } from '../api/picker.js';

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Edit modal state
  let showEditModal = $state(false);

  let isUpdatingStatus = $state(false);
  let statusError = $state(null);
  let isCreatingFolder = $state(false);
  let folderError = $state(null);

  // Attachments state
  let attachments = $state([]);
  let isLoadingAttachments = $state(false);
  let attachmentsError = $state(null);

  // Reports state
  let reports = $state([]);
  let reportsFolderId = $state(null);
  let isLoadingReports = $state(false);
  let reportsError = $state(null);

  // Add file state
  let isAddingAttachment = $state(false);
  let isAddingReport = $state(false);
  let addFileError = $state(null);

  let grant = $derived(() => {
    const grantId = router.params.id;
    return grantsStore.grants.find(g => g.ID === grantId);
  });

  async function handleStatusChange(event) {
    const newStatus = event.target.value;
    const currentGrant = grant();
    if (!currentGrant || newStatus === currentGrant.Status) return;

    isUpdatingStatus = true;
    statusError = null;

    try {
      // Update the grant status
      await grantsStore.update(currentGrant.ID, { Status: newStatus });
    } catch (err) {
      statusError = err.message;
      // Reset the select to the original value
      event.target.value = currentGrant.Status;
    } finally {
      isUpdatingStatus = false;
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

  function getCategoryBreakdown(g) {
    const categories = [];
    if (g.Cat_A_Percent > 0) categories.push({ name: 'A', pct: g.Cat_A_Percent, color: 'bg-blue-100 text-blue-800' });
    if (g.Cat_B_Percent > 0) categories.push({ name: 'B', pct: g.Cat_B_Percent, color: 'bg-green-100 text-green-800' });
    if (g.Cat_C_Percent > 0) categories.push({ name: 'C', pct: g.Cat_C_Percent, color: 'bg-orange-100 text-orange-800' });
    if (g.Cat_D_Percent > 0) categories.push({ name: 'D', pct: g.Cat_D_Percent, color: 'bg-purple-100 text-purple-800' });
    return categories;
  }

  function parseTags(tagsStr) {
    if (!tagsStr) return [];
    return tagsStr.split(',').map(t => t.trim()).filter(t => t);
  }

  function copyPermalink() {
    const url = `${window.location.origin}${window.location.pathname}#/grant/${encodeURIComponent(grant().ID)}`;
    navigator.clipboard.writeText(url);
  }

  // Check if grant has folder structure
  let hasFolder = $derived(() => {
    const g = grant();
    return g && g.Folder_URL;
  });

  // Extract folder ID from URL
  function getFolderIdFromUrl(url) {
    if (!url) return null;
    const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  // Load attachments when grant has folder
  $effect(() => {
    const currentGrant = grant();
    if (currentGrant?.Folder_URL && userStore.accessToken) {
      loadAttachments(currentGrant);
    }
  });

  async function loadAttachments(currentGrant) {
    const folderId = getFolderIdFromUrl(currentGrant.Folder_URL);
    if (!folderId) return;

    isLoadingAttachments = true;
    attachmentsError = null;

    try {
      const files = await listFiles(userStore.accessToken, folderId);

      // Find the Reports folder and store its ID
      const reportsFolder = files.find(
        file => file.mimeType === 'application/vnd.google-apps.folder' && file.name === 'Reports'
      );
      if (reportsFolder) {
        reportsFolderId = reportsFolder.id;
        loadReports(reportsFolder.id);
      }

      // Filter out known files (Tracker, Proposal, Reports folder)
      const knownPatterns = [
        `${currentGrant.ID}-Tracker`,
        `${currentGrant.ID}-Proposal`,
        'Reports',
      ];

      attachments = files.filter(file => {
        // Exclude folders named "Reports"
        if (file.mimeType === 'application/vnd.google-apps.folder' && file.name === 'Reports') {
          return false;
        }
        // Exclude Tracker and Proposal docs
        if (knownPatterns.includes(file.name)) {
          return false;
        }
        return true;
      });
    } catch (err) {
      attachmentsError = err.message;
    } finally {
      isLoadingAttachments = false;
    }
  }

  async function loadReports(folderId) {
    isLoadingReports = true;
    reportsError = null;

    try {
      const files = await listFiles(userStore.accessToken, folderId);
      // Sort by modified time, most recent first
      reports = files.sort((a, b) => {
        if (a.modifiedTime && b.modifiedTime) {
          return b.modifiedTime.localeCompare(a.modifiedTime);
        }
        return 0;
      });
    } catch (err) {
      reportsError = err.message;
    } finally {
      isLoadingReports = false;
    }
  }

  async function handleCreateFolder() {
    const currentGrant = grant();
    if (!currentGrant || !folderStore.hasGrantsFolder) return;

    isCreatingFolder = true;
    folderError = null;

    try {
      const folderResult = await createGrantFolderStructure(
        userStore.accessToken,
        folderStore.grantsFolderId,
        currentGrant.ID
      );

      // Update the grant with folder/doc URLs
      await grantsStore.update(currentGrant.ID, {
        Folder_URL: folderResult.folderUrl,
        Proposal_URL: folderResult.proposalUrl,
        Tracker_URL: folderResult.trackerUrl,
      });
    } catch (err) {
      folderError = err.message;
    } finally {
      isCreatingFolder = false;
    }
  }

  async function handleAddAttachment() {
    const currentGrant = grant();
    if (!currentGrant?.Folder_URL) return;

    isAddingAttachment = true;
    addFileError = null;

    try {
      const folderId = getFolderIdFromUrl(currentGrant.Folder_URL);
      const files = await openFilePicker(userStore.accessToken, clientId, {
        title: 'Add Attachment',
        multiSelect: true,
        uploadParentId: folderId,
      });

      if (files && files.length > 0) {
        // For uploaded files, they're already in the folder
        // For selected existing files, move them to the folder
        for (const file of files) {
          // Check if file is already in the grant folder
          const fileDetails = await listFiles(userStore.accessToken, folderId);
          const alreadyInFolder = fileDetails.some(f => f.id === file.id);

          if (!alreadyInFolder) {
            await addFileToFolder(userStore.accessToken, file.id, folderId);
          }
        }

        // Refresh attachments list
        await loadAttachments(currentGrant);
      }
    } catch (err) {
      addFileError = err.message;
    } finally {
      isAddingAttachment = false;
    }
  }

  async function handleAddReport() {
    const currentGrant = grant();
    if (!currentGrant?.Folder_URL || !reportsFolderId) return;

    isAddingReport = true;
    addFileError = null;

    try {
      const files = await openFilePicker(userStore.accessToken, clientId, {
        title: 'Add Report',
        multiSelect: true,
        uploadParentId: reportsFolderId,
      });

      if (files && files.length > 0) {
        // For uploaded files, they're already in the folder
        // For selected existing files, move them to the Reports folder
        for (const file of files) {
          // Check if file is already in the reports folder
          const fileDetails = await listFiles(userStore.accessToken, reportsFolderId);
          const alreadyInFolder = fileDetails.some(f => f.id === file.id);

          if (!alreadyInFolder) {
            await addFileToFolder(userStore.accessToken, file.id, reportsFolderId);
          }
        }

        // Refresh reports list
        await loadReports(reportsFolderId);
      }
    } catch (err) {
      addFileError = err.message;
    } finally {
      isAddingReport = false;
    }
  }
</script>

{#if !grant()}
  <div class="max-w-3xl mx-auto text-center py-12">
    <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <h2 class="text-xl font-semibold text-gray-900 mb-2">Grant not found</h2>
    <p class="text-gray-500 mb-4">The grant "{router.params.id}" could not be found.</p>
    <a href="#/grants" class="text-indigo-600 hover:text-indigo-800 font-medium">
      ← Back to grants
    </a>
  </div>
{:else}
  <!-- Breadcrumb -->
  <nav class="mb-4">
    <ol class="flex items-center space-x-2 text-sm">
      <li><a href="#/grants" class="text-gray-500 hover:text-gray-700">Grants</a></li>
      <li class="text-gray-400">/</li>
      <li class="text-gray-900 font-medium">{grant().ID}</li>
    </ol>
  </nav>

  <!-- Header -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
    <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
      <div class="flex-1">
        <div class="flex items-center gap-3 mb-2">
          <h1 class="text-2xl font-bold text-gray-900">{grant().Title || grant().ID}</h1>
        </div>
        <div class="flex items-center gap-4 text-sm text-gray-500">
          <span class="font-mono text-gray-600">{grant().ID}</span>
          {#if grant().Organization}
            <span>·</span>
            <span>{grant().Organization}</span>
          {/if}
          {#if getCategoryBreakdown(grant()).length > 0}
            <span>·</span>
            <span>Category {getCategoryBreakdown(grant()).map(c => c.name).join(', ')}</span>
          {/if}
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="text-right">
          <label for="status-select" class="text-sm text-gray-500 block">Status</label>
          <select
            id="status-select"
            value={grant().Status}
            onchange={handleStatusChange}
            disabled={isUpdatingStatus}
            class="mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-wait"
          >
            {#each grantsStore.statusValues as status}
              <option value={status}>{status}</option>
            {/each}
          </select>
          {#if statusError}
            <p class="text-xs text-red-600 mt-1">{statusError}</p>
          {/if}
        </div>
        <button
          onclick={() => showEditModal = true}
          class="p-2 text-gray-400 hover:text-indigo-600"
          title="Edit grant"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </button>
        <button
          onclick={copyPermalink}
          class="p-2 text-gray-400 hover:text-gray-600"
          title="Copy permalink"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
          </svg>
        </button>
      </div>
    </div>
  </div>

  <div class="grid lg:grid-cols-3 gap-6">
    <!-- Main Content -->
    <div class="lg:col-span-2 space-y-6">
      <!-- Tags -->
      {#if parseTags(grant().Tags).length > 0}
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Tags</h2>
          <div class="flex flex-wrap gap-2">
            {#each parseTags(grant().Tags) as tag}
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                {tag}
              </span>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Attachments -->
      {#if hasFolder()}
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-900">Attachments</h2>
            <button
              onclick={handleAddAttachment}
              disabled={isAddingAttachment}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md disabled:opacity-50"
            >
              {#if isAddingAttachment}
                <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              {:else}
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              {/if}
              Add File
            </button>
          </div>
          {#if addFileError}
            <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {addFileError}
              <button onclick={() => addFileError = null} class="ml-2 text-red-500 hover:text-red-700">Dismiss</button>
            </div>
          {/if}
          {#if isLoadingAttachments}
            <div class="flex items-center gap-2 text-gray-500">
              <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              <span class="text-sm">Loading...</span>
            </div>
          {:else if attachmentsError}
            <p class="text-sm text-red-600">{attachmentsError}</p>
          {:else if attachments.length === 0}
            <p class="text-sm text-gray-500">No additional files in this grant folder.</p>
            <a
              href={grant().Folder_URL}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 mt-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Add files in Drive
            </a>
          {:else}
            <ul class="divide-y divide-gray-100">
              {#each attachments as file (file.id)}
                <li class="py-3 first:pt-0 last:pb-0">
                  <a
                    href={file.webViewLink || `https://drive.google.com/file/d/${file.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex items-center gap-3 group"
                  >
                    <div class="flex-shrink-0">
                      {#if file.mimeType === 'application/vnd.google-apps.document'}
                        <svg class="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                        </svg>
                      {:else if file.mimeType === 'application/vnd.google-apps.spreadsheet'}
                        <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                        </svg>
                      {:else if file.mimeType === 'application/pdf'}
                        <svg class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                        </svg>
                      {:else if file.mimeType?.startsWith('image/')}
                        <svg class="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      {:else if file.mimeType === 'application/vnd.google-apps.folder'}
                        <svg class="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                        </svg>
                      {:else}
                        <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      {/if}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900 group-hover:text-indigo-600 truncate">
                        {file.name}
                      </p>
                      {#if file.modifiedTime}
                        <p class="text-xs text-gray-500">
                          Modified {new Date(file.modifiedTime).toLocaleDateString()}
                        </p>
                      {/if}
                    </div>
                    <svg class="w-4 h-4 text-gray-400 group-hover:text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </li>
              {/each}
            </ul>
            <a
              href={grant().Folder_URL}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 mt-4"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Manage in Drive
            </a>
          {/if}
        </div>
      {/if}

      <!-- Reports -->
      {#if hasFolder() && reportsFolderId}
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-900">Reports</h2>
            <button
              onclick={handleAddReport}
              disabled={isAddingReport}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md disabled:opacity-50"
            >
              {#if isAddingReport}
                <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              {:else}
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              {/if}
              Add Report
            </button>
          </div>
          {#if isLoadingReports}
            <div class="flex items-center gap-2 text-gray-500">
              <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              <span class="text-sm">Loading...</span>
            </div>
          {:else if reportsError}
            <p class="text-sm text-red-600">{reportsError}</p>
          {:else if reports.length === 0}
            <p class="text-sm text-gray-500">No reports submitted yet.</p>
            <a
              href={`https://drive.google.com/drive/folders/${reportsFolderId}`}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 mt-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Add reports in Drive
            </a>
          {:else}
            <ul class="divide-y divide-gray-100">
              {#each reports as file (file.id)}
                <li class="py-3 first:pt-0 last:pb-0">
                  <a
                    href={file.webViewLink || `https://drive.google.com/file/d/${file.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex items-center gap-3 group"
                  >
                    <div class="flex-shrink-0">
                      {#if file.mimeType === 'application/pdf'}
                        <svg class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                        </svg>
                      {:else if file.mimeType === 'application/vnd.google-apps.document'}
                        <svg class="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                        </svg>
                      {:else}
                        <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      {/if}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900 group-hover:text-indigo-600 truncate">
                        {file.name}
                      </p>
                      {#if file.modifiedTime}
                        <p class="text-xs text-gray-500">
                          {new Date(file.modifiedTime).toLocaleDateString()}
                        </p>
                      {/if}
                    </div>
                    <svg class="w-4 h-4 text-gray-400 group-hover:text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </li>
              {/each}
            </ul>
            <a
              href={`https://drive.google.com/drive/folders/${reportsFolderId}`}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 mt-4"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Manage in Drive
            </a>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Sidebar -->
    <div class="space-y-6">
      <!-- Details -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">Details</h3>
        <dl class="space-y-4">
          <div>
            <dt class="text-xs text-gray-500">Amount</dt>
            <dd class="text-sm font-medium text-gray-900 mt-1">{formatAmount(grant().Amount)}</dd>
          </div>
          {#if grant().Year}
            <div>
              <dt class="text-xs text-gray-500">Year</dt>
              <dd class="text-sm text-gray-900 mt-1">{grant().Year}</dd>
            </div>
          {/if}
          {#if getCategoryBreakdown(grant()).length > 0}
            <div>
              <dt class="text-xs text-gray-500">Category</dt>
              <dd class="mt-1 flex flex-wrap gap-1">
                {#each getCategoryBreakdown(grant()) as cat}
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {cat.color}">
                    {cat.name}: {cat.pct}%
                  </span>
                {/each}
              </dd>
            </div>
          {/if}
          {#if grant().Beneficiary}
            <div>
              <dt class="text-xs text-gray-500">Beneficiary</dt>
              <dd class="text-sm text-gray-900 mt-1">{grant().Beneficiary}</dd>
            </div>
          {/if}
        </dl>
      </div>

      <!-- Contact -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">Contact</h3>
        <dl class="space-y-4">
          {#if grant().Organization}
            <div>
              <dt class="text-xs text-gray-500">Organization</dt>
              <dd class="text-sm text-gray-900 mt-1">{grant().Organization}</dd>
            </div>
          {/if}
          {#if grant().Primary_Contact}
            <div>
              <dt class="text-xs text-gray-500">Primary Contact</dt>
              <dd class="text-sm text-gray-900 mt-1">{grant().Primary_Contact}</dd>
            </div>
          {/if}
          {#if grant().Other_Contacts}
            <div>
              <dt class="text-xs text-gray-500">Other Contacts</dt>
              <dd class="text-sm text-gray-900 mt-1">{grant().Other_Contacts}</dd>
            </div>
          {/if}
        </dl>
      </div>

      <!-- Documents -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">Documents</h3>
        {#if hasFolder()}
          <div class="space-y-3">
            {#if grant().Folder_URL}
              <a
                href={grant().Folder_URL}
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Open Folder
              </a>
            {/if}
            {#if grant().Tracker_URL}
              <a
                href={grant().Tracker_URL}
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Tracker Doc
              </a>
            {/if}
            {#if grant().Proposal_URL}
              <a
                href={grant().Proposal_URL}
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Proposal Doc
              </a>
            {/if}
          </div>
        {:else}
          <div class="text-center">
            <p class="text-sm text-gray-500 mb-3">No Drive folder set up yet.</p>
            {#if folderStore.hasGrantsFolder}
              <button
                onclick={handleCreateFolder}
                disabled={isCreatingFolder}
                class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-wait"
              >
                {#if isCreatingFolder}
                  <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Creating...
                {:else}
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Create Folder
                {/if}
              </button>
              {#if folderError}
                <p class="text-xs text-red-600 mt-2">{folderError}</p>
              {/if}
            {:else}
              <p class="text-xs text-gray-400">Set up a root folder first from the menu.</p>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Edit Grant Modal -->
  {#if showEditModal}
    <GrantFormModal
      grant={grant()}
      onClose={() => showEditModal = false}
      onSaved={() => showEditModal = false}
    />
  {/if}
{/if}
