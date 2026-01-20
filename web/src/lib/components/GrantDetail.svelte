<script>
  import { grantsStore } from '../stores/grants.svelte.js';
  import { folderStore } from '../stores/folder.svelte.js';
  import { userStore } from '../stores/user.svelte.js';
  import { spreadsheetStore } from '../stores/spreadsheet.svelte.js';
  import { actionItemsStore } from '../stores/actionItems.svelte.js';
  import { router, navigate } from '../router.svelte.js';
  import StatusBadge from './StatusBadge.svelte';
  import GrantFormModal from './GrantFormModal.svelte';
  import { createGrantFolderStructure, listFiles, addFileToFolder, findFolder, copyFile, createShortcut } from '../api/drive.js';
  import { openFilePicker, openFolderPicker } from '../api/picker.js';
  import { syncGrantToTrackerDoc } from '../api/docs.js';
  import { readApprovers } from '../api/sheets.js';
  import { ActionItemStatus } from '../models.js';

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Edit modal state
  let showEditModal = $state(false);

  let isUpdatingStatus = $state(false);
  let statusError = $state(null);
  let isCreatingFolder = $state(false);
  let folderError = $state(null);
  let isSearchingFolder = $state(false);
  let folderSearchComplete = $state(false);
  let isLinkingFolder = $state(false);
  let isSyncingTracker = $state(false);
  let syncError = $state(null);

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

  // File conflict prompt state (when add-parent fails due to org policy)
  let showFileConflictPrompt = $state(false);
  let conflictFile = $state(null); // { id, name }
  let conflictTargetFolderId = $state(null);
  let conflictContext = $state(null); // 'attachment' | 'report'
  let isResolvingConflict = $state(false);

  // Action items state
  let syncMessage = $state(null);
  let syncSuccess = $state(false);

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

  // Auto-find folder when grant has no Folder_URL
  $effect(() => {
    const currentGrant = grant();
    if (
      currentGrant &&
      !currentGrant.Folder_URL &&
      !folderSearchComplete &&
      !isSearchingFolder &&
      folderStore.hasGrantsFolder &&
      userStore.accessToken
    ) {
      autoFindFolder(currentGrant);
    }
  });

  // Reset search state when navigating to a different grant
  $effect(() => {
    const grantId = router.params.id;
    // Reset when grant ID changes
    folderSearchComplete = false;
    isSearchingFolder = false;
    folderError = null;
  });

  async function autoFindFolder(currentGrant) {
    isSearchingFolder = true;
    folderError = null;

    try {
      const found = await findFolder(
        userStore.accessToken,
        folderStore.grantsFolderId,
        currentGrant.ID
      );

      if (found) {
        // Found the folder - update the grant
        const folderUrl = `https://drive.google.com/drive/folders/${found.id}`;
        await grantsStore.update(currentGrant.ID, { Folder_URL: folderUrl });
      }
    } catch (err) {
      console.warn('Failed to auto-find folder:', err);
      // Don't show error to user - this is a best-effort search
    } finally {
      isSearchingFolder = false;
      folderSearchComplete = true;
    }
  }

  async function handleLinkFolder() {
    const currentGrant = grant();
    if (!currentGrant) return;

    isLinkingFolder = true;
    folderError = null;

    try {
      const folder = await openFolderPicker(userStore.accessToken, clientId);

      if (folder) {
        // Update the grant with the selected folder URL
        await grantsStore.update(currentGrant.ID, { Folder_URL: folder.url });
      }
    } catch (err) {
      folderError = err.message;
    } finally {
      isLinkingFolder = false;
    }
  }

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
        currentGrant.ID,
        currentGrant,
        spreadsheetStore.spreadsheetId
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

  async function handleSyncTracker() {
    const currentGrant = grant();
    if (!currentGrant?.Tracker_URL) return;

    isSyncingTracker = true;
    syncError = null;

    try {
      // Read approvers to pass to sync (for recreating deleted Approvals section)
      let approvers = [];
      if (spreadsheetStore.spreadsheetId) {
        try {
          approvers = await readApprovers(userStore.accessToken, spreadsheetStore.spreadsheetId);
        } catch (err) {
          console.warn('Failed to read approvers for sync:', err);
        }
      }

      await syncGrantToTrackerDoc(userStore.accessToken, currentGrant.Tracker_URL, currentGrant, approvers);
    } catch (err) {
      syncError = err.message;
    } finally {
      isSyncingTracker = false;
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
        // For selected existing files, try to add them to the folder
        for (const file of files) {
          // Check if file is already in the grant folder
          const fileDetails = await listFiles(userStore.accessToken, folderId);
          const alreadyInFolder = fileDetails.some(f => f.id === file.id);

          if (!alreadyInFolder) {
            try {
              await addFileToFolder(userStore.accessToken, file.id, folderId);
            } catch (err) {
              // Check if this is a "multiple parents not allowed" error
              if (isMultipleParentsError(err)) {
                // Show prompt to let user choose copy or link
                conflictFile = { id: file.id, name: file.name };
                conflictTargetFolderId = folderId;
                conflictContext = 'attachment';
                showFileConflictPrompt = true;
                return; // Exit early, user will resolve via prompt
              }
              throw err; // Re-throw other errors
            }
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

  function isMultipleParentsError(err) {
    const msg = err.message?.toLowerCase() || '';
    return msg.includes('parent') || msg.includes('multiple') || msg.includes('shared drive');
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
        // For selected existing files, try to add them to the Reports folder
        for (const file of files) {
          // Check if file is already in the reports folder
          const fileDetails = await listFiles(userStore.accessToken, reportsFolderId);
          const alreadyInFolder = fileDetails.some(f => f.id === file.id);

          if (!alreadyInFolder) {
            try {
              await addFileToFolder(userStore.accessToken, file.id, reportsFolderId);
            } catch (err) {
              // Check if this is a "multiple parents not allowed" error
              if (isMultipleParentsError(err)) {
                // Show prompt to let user choose copy or link
                conflictFile = { id: file.id, name: file.name };
                conflictTargetFolderId = reportsFolderId;
                conflictContext = 'report';
                showFileConflictPrompt = true;
                return; // Exit early, user will resolve via prompt
              }
              throw err; // Re-throw other errors
            }
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

  async function handleConflictChoice(choice) {
    if (!conflictFile || !conflictTargetFolderId) return;

    isResolvingConflict = true;
    addFileError = null;

    try {
      if (choice === 'copy') {
        await copyFile(userStore.accessToken, conflictFile.id, conflictTargetFolderId);
      } else if (choice === 'link') {
        await createShortcut(userStore.accessToken, conflictFile.id, conflictTargetFolderId);
      }

      // Refresh the appropriate list
      const currentGrant = grant();
      if (conflictContext === 'attachment') {
        await loadAttachments(currentGrant);
      } else if (conflictContext === 'report' && reportsFolderId) {
        await loadReports(reportsFolderId);
      }
    } catch (err) {
      addFileError = err.message;
    } finally {
      isResolvingConflict = false;
      showFileConflictPrompt = false;
      conflictFile = null;
      conflictTargetFolderId = null;
      conflictContext = null;
    }
  }

  function cancelConflictPrompt() {
    showFileConflictPrompt = false;
    conflictFile = null;
    conflictTargetFolderId = null;
    conflictContext = null;
  }

  // Get action items for this grant
  let grantActionItems = $derived(() => {
    const currentGrant = grant();
    if (!currentGrant) return [];
    return actionItemsStore.getByGrantId(currentGrant.ID);
  });

  // Check if grant has docs to sync from
  let hasDocsToSync = $derived(() => {
    const g = grant();
    return g && (g.Tracker_URL || g.Proposal_URL);
  });

  async function handleSyncActionItems() {
    const currentGrant = grant();
    if (!currentGrant) return;

    syncMessage = null;
    syncSuccess = false;

    try {
      const result = await actionItemsStore.syncFromComments(currentGrant.ID, currentGrant);

      if (result.errors.length > 0) {
        syncMessage = `Synced with errors: ${result.created} created, ${result.updated || 0} updated, ${result.skipped} unchanged. Errors: ${result.errors.join(', ')}`;
        syncSuccess = false;
      } else if (result.created === 0 && result.skipped === 0 && !result.updated) {
        syncMessage = 'No assigned comments found in documents';
        syncSuccess = true;
      } else {
        const parts = [];
        if (result.created > 0) parts.push(`${result.created} new`);
        if (result.updated > 0) parts.push(`${result.updated} marked done`);
        if (result.skipped > 0) parts.push(`${result.skipped} unchanged`);
        syncMessage = `Synced: ${parts.join(', ')}`;
        syncSuccess = true;
      }
    } catch (err) {
      syncMessage = err.message;
      syncSuccess = false;
    }
  }

  async function handleToggleActionItem(item) {
    try {
      if (item.status === ActionItemStatus.DONE) {
        await actionItemsStore.reopen(item.item_id);
      } else {
        await actionItemsStore.markDone(item.item_id);
      }
    } catch (err) {
      console.error('Failed to toggle action item:', err);
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
      <!-- Documents -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Documents</h2>
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
                Open Grant Folder
              </a>
            {/if}
            {#if grant().SOW_URL}
              <a
                href={grant().SOW_URL}
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800"
              >
                <svg class="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                </svg>
                Statement of Work
              </a>
            {/if}
            {#if grant().Tracker_URL}
              <div class="flex items-center justify-between">
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
                <button
                  onclick={handleSyncTracker}
                  disabled={isSyncingTracker}
                  class="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-50"
                  title="Sync grant data to Tracker doc"
                >
                  {#if isSyncingTracker}
                    <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                  {:else}
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  {/if}
                </button>
              </div>
              {#if syncError}
                <p class="text-xs text-red-600 mt-1">{syncError}</p>
              {/if}
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
            {#if isSearchingFolder}
              <div class="flex items-center justify-center gap-2 text-gray-500">
                <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <span class="text-sm">Searching for existing folder...</span>
              </div>
            {:else if folderStore.hasGrantsFolder}
              <p class="text-sm text-gray-500 mb-3">No Drive folder linked.</p>
              <div class="flex flex-col sm:flex-row items-center justify-center gap-2">
                <button
                  onclick={handleLinkFolder}
                  disabled={isLinkingFolder}
                  class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-wait"
                >
                  {#if isLinkingFolder}
                    <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Linking...
                  {:else}
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Link Existing
                  {/if}
                </button>
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
                    Create New
                  {/if}
                </button>
              </div>
              {#if folderError}
                <p class="text-xs text-red-600 mt-2">{folderError}</p>
              {/if}
            {:else}
              <p class="text-sm text-gray-500 mb-1">No Drive folder linked.</p>
              <p class="text-xs text-gray-400">Set up a root folder first from the menu.</p>
            {/if}
          </div>
        {/if}
      </div>

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

      <!-- Action Items -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-900">Action Items</h2>
          {#if hasDocsToSync()}
            <button
              onclick={handleSyncActionItems}
              disabled={actionItemsStore.isSyncing}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md disabled:opacity-50"
            >
              {#if actionItemsStore.isSyncing}
                <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Syncing...
              {:else}
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync from Docs
              {/if}
            </button>
          {/if}
        </div>

        {#if syncMessage}
          <div class="mb-4 p-3 rounded-lg text-sm {syncSuccess ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}">
            {syncMessage}
            <button onclick={() => syncMessage = null} class="ml-2 {syncSuccess ? 'text-green-500 hover:text-green-700' : 'text-red-500 hover:text-red-700'}">Dismiss</button>
          </div>
        {/if}

        {#if grantActionItems().length === 0}
          <p class="text-sm text-gray-500">No action items for this grant.</p>
          {#if hasDocsToSync()}
            <p class="text-xs text-gray-400 mt-2">
              Use "Sync from Docs" to import assigned comments from Tracker or Proposal documents.
            </p>
          {/if}
        {:else}
          <ul class="divide-y divide-gray-100">
            {#each grantActionItems() as item (item.item_id)}
              <li class="py-3 first:pt-0 last:pb-0">
                <div class="flex items-start gap-3">
                  {#if actionItemsStore.isSyncedItem(item)}
                    <!-- Synced items show status indicator instead of checkbox -->
                    <div class="mt-1 h-4 w-4 flex items-center justify-center" title="Resolve in Google Docs to mark done">
                      {#if item.status === ActionItemStatus.DONE}
                        <svg class="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                      {:else}
                        <div class="w-3 h-3 rounded-full border-2 border-blue-400"></div>
                      {/if}
                    </div>
                  {:else}
                    <!-- Manual items have checkbox -->
                    <input
                      type="checkbox"
                      checked={item.status === ActionItemStatus.DONE}
                      onchange={() => handleToggleActionItem(item)}
                      class="mt-1 h-4 w-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                    />
                  {/if}
                  <div class="flex-1 min-w-0">
                    <p class="text-sm {item.status === ActionItemStatus.DONE ? 'text-gray-500 line-through' : 'text-gray-900'}">
                      {item.description}
                    </p>
                    <div class="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                      {#if item.assignee}
                        <span class="inline-flex items-center gap-1">
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {item.assignee}
                        </span>
                      {/if}
                      {#if item.due_date}
                        <span class="inline-flex items-center gap-1">
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(item.due_date).toLocaleDateString()}
                        </span>
                      {/if}
                      {#if actionItemsStore.isSyncedItem(item)}
                        <!-- Link directly to comment if available, otherwise to doc -->
                        {@const commentLink = item.comment_link || actionItemsStore.getSyncedDocUrl(item, grant())}
                        <a
                          href={commentLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                          title={item.status === ActionItemStatus.DONE ? 'Comment resolved' : 'Resolve comment to mark done'}
                        >
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                          </svg>
                          {item.status === ActionItemStatus.DONE ? 'resolved' : 'open in docs'}
                        </a>
                      {/if}
                    </div>
                  </div>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
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

  <!-- File Conflict Prompt Modal -->
  {#if showFileConflictPrompt && conflictFile}
    <div class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex min-h-full items-center justify-center p-4">
        <!-- Backdrop -->
        <button
          type="button"
          class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity cursor-default"
          onclick={cancelConflictPrompt}
          aria-label="Close dialog"
        ></button>

        <!-- Modal -->
        <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div class="mb-4">
            <div class="flex items-center gap-3 mb-2">
              <div class="flex-shrink-0 w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-gray-900">Can't Add File Directly</h3>
            </div>
            <p class="text-sm text-gray-600 mt-2">
              Your organization's Drive settings don't allow files to appear in multiple folders.
              How would you like to add <strong class="font-medium">{conflictFile.name}</strong>?
            </p>
          </div>

          <div class="space-y-3">
            <button
              onclick={() => handleConflictChoice('link')}
              disabled={isResolvingConflict}
              class="w-full flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left disabled:opacity-50"
            >
              <svg class="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <div>
                <p class="font-medium text-gray-900">Create a shortcut</p>
                <p class="text-xs text-gray-500 mt-0.5">Links to the original file. Changes to the original will be reflected here.</p>
              </div>
            </button>

            <button
              onclick={() => handleConflictChoice('copy')}
              disabled={isResolvingConflict}
              class="w-full flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left disabled:opacity-50"
            >
              <svg class="w-5 h-5 text-green-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <div>
                <p class="font-medium text-gray-900">Make a copy</p>
                <p class="text-xs text-gray-500 mt-0.5">Creates an independent copy. Changes to the original won't affect this copy.</p>
              </div>
            </button>
          </div>

          {#if isResolvingConflict}
            <div class="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
              <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Adding file...
            </div>
          {/if}

          <button
            onclick={cancelConflictPrompt}
            disabled={isResolvingConflict}
            class="mt-4 w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}
