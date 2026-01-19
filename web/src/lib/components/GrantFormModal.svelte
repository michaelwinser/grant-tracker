<script>
  import { grantsStore } from '../stores/grants.svelte.js';
  import { GrantStatus, GrantType, GRANT_STATUS_ORDER } from '../models.js';

  // Props
  let {
    grant = null,  // null for create, grant object for edit
    onClose,
    onSaved,
  } = $props();

  let isEditing = $derived(grant !== null);
  let modalTitle = $derived(isEditing ? 'Edit Grant' : 'New Grant');

  // Form state
  let grantId = $state(grant?.grant_id || '');
  let title = $state(grant?.title || '');
  let organization = $state(grant?.organization || '');
  let contactName = $state(grant?.contact_name || '');
  let contactEmail = $state(grant?.contact_email || '');
  let type = $state(grant?.type || GrantType.GRANT);
  let status = $state(grant?.status || GrantStatus.INITIAL_CONTACT);
  let amount = $state(grant?.amount || '');
  let grantYear = $state(grant?.grant_year || new Date().getFullYear());
  let ecosystem = $state(grant?.ecosystem || '');
  let categoryAPct = $state(grant?.category_a_pct || 0);
  let categoryBPct = $state(grant?.category_b_pct || 0);
  let categoryCPct = $state(grant?.category_c_pct || 0);
  let categoryDPct = $state(grant?.category_d_pct || 0);
  let notes = $state(grant?.notes || '');

  // URL fields (usually set later, but allow editing)
  let proposalDocUrl = $state(grant?.proposal_doc_url || '');
  let internalNotesUrl = $state(grant?.internal_notes_url || '');
  let driveFolderUrl = $state(grant?.drive_folder_url || '');
  let githubRepo = $state(grant?.github_repo || '');

  let isSubmitting = $state(false);
  let error = $state('');

  // Validation
  let categoryTotal = $derived(
    (parseFloat(categoryAPct) || 0) +
    (parseFloat(categoryBPct) || 0) +
    (parseFloat(categoryCPct) || 0) +
    (parseFloat(categoryDPct) || 0)
  );

  let isCategoryValid = $derived(categoryTotal === 0 || categoryTotal === 100);

  let isGrantIdUnique = $derived(() => {
    if (isEditing) return true; // Don't check uniqueness when editing
    if (!grantId.trim()) return true; // Empty is handled by required validation
    return !grantsStore.grants.some(g => g.grant_id === grantId.trim());
  });

  let canSubmit = $derived(
    grantId.trim() &&
    title.trim() &&
    isCategoryValid &&
    isGrantIdUnique() &&
    !isSubmitting
  );

  // Generate grant ID suggestion
  function generateGrantId() {
    const code = organization
      ? organization.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '')
      : 'XXXX';
    const year = grantYear || new Date().getFullYear();
    const codename = title
      ? title.split(' ')[0].replace(/[^a-zA-Z]/g, '')
      : 'Project';
    return `${code}-${year}-${codename}`;
  }

  function handleGenerateId() {
    grantId = generateGrantId();
  }

  async function handleSubmit() {
    if (!canSubmit) return;

    isSubmitting = true;
    error = '';

    const grantData = {
      grant_id: grantId.trim(),
      title: title.trim(),
      organization: organization.trim() || null,
      contact_name: contactName.trim() || null,
      contact_email: contactEmail.trim() || null,
      type,
      status,
      amount: amount ? parseFloat(amount) : null,
      grant_year: grantYear ? parseInt(grantYear) : null,
      ecosystem: ecosystem.trim() || null,
      category_a_pct: parseFloat(categoryAPct) || 0,
      category_b_pct: parseFloat(categoryBPct) || 0,
      category_c_pct: parseFloat(categoryCPct) || 0,
      category_d_pct: parseFloat(categoryDPct) || 0,
      notes: notes.trim() || null,
      proposal_doc_url: proposalDocUrl.trim() || null,
      internal_notes_url: internalNotesUrl.trim() || null,
      drive_folder_url: driveFolderUrl.trim() || null,
      github_repo: githubRepo.trim() || null,
    };

    try {
      let savedGrant;
      if (isEditing) {
        savedGrant = await grantsStore.update(grant.grant_id, grantData);
      } else {
        savedGrant = await grantsStore.create(grantData);
      }
      onSaved?.(savedGrant);
      onClose?.();
    } catch (err) {
      error = err.message;
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="fixed inset-0 z-50 overflow-y-auto">
  <div class="flex items-start justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
    <!-- Backdrop -->
    <button
      type="button"
      class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity cursor-default"
      onclick={onClose}
      aria-label="Close modal"
    ></button>

    <!-- Modal -->
    <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <div class="bg-white px-6 pt-6 pb-4">
          <h3 class="text-lg font-semibold text-gray-900 mb-6">{modalTitle}</h3>

          {#if error}
            <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          {/if}

          <div class="space-y-6">
            <!-- Basic Info Section -->
            <div>
              <h4 class="text-sm font-medium text-gray-700 mb-3">Basic Information</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="sm:col-span-2">
                  <label for="grant-id" class="block text-sm font-medium text-gray-700 mb-1">
                    Grant ID <span class="text-red-500">*</span>
                  </label>
                  <div class="flex gap-2">
                    <input
                      id="grant-id"
                      type="text"
                      bind:value={grantId}
                      disabled={isEditing}
                      placeholder="e.g., PYPI-2026-Packaging"
                      class="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                    {#if !isEditing}
                      <button
                        type="button"
                        onclick={handleGenerateId}
                        class="px-3 py-2 text-sm text-indigo-600 border border-indigo-300 rounded-md hover:bg-indigo-50"
                      >
                        Generate
                      </button>
                    {/if}
                  </div>
                  {#if !isGrantIdUnique()}
                    <p class="mt-1 text-xs text-red-600">This Grant ID already exists</p>
                  {/if}
                </div>

                <div class="sm:col-span-2">
                  <label for="title" class="block text-sm font-medium text-gray-700 mb-1">
                    Title <span class="text-red-500">*</span>
                  </label>
                  <input
                    id="title"
                    type="text"
                    bind:value={title}
                    placeholder="Grant title"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label for="organization" class="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                  <input
                    id="organization"
                    type="text"
                    bind:value={organization}
                    placeholder="Grantee organization"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label for="ecosystem" class="block text-sm font-medium text-gray-700 mb-1">Ecosystem</label>
                  <input
                    id="ecosystem"
                    type="text"
                    bind:value={ecosystem}
                    placeholder="e.g., Python, JavaScript"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label for="type" class="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    id="type"
                    bind:value={type}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {#each Object.values(GrantType) as t}
                      <option value={t}>{t}</option>
                    {/each}
                  </select>
                </div>

                <div>
                  <label for="status" class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    id="status"
                    bind:value={status}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {#each GRANT_STATUS_ORDER as s}
                      <option value={s}>{s}</option>
                    {/each}
                  </select>
                </div>

                <div>
                  <label for="amount" class="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
                  <input
                    id="amount"
                    type="number"
                    bind:value={amount}
                    min="0"
                    step="1"
                    placeholder="0"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label for="grant-year" class="block text-sm font-medium text-gray-700 mb-1">Grant Year</label>
                  <input
                    id="grant-year"
                    type="number"
                    bind:value={grantYear}
                    min="2000"
                    max="2100"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <!-- Category Allocation Section -->
            <div>
              <h4 class="text-sm font-medium text-gray-700 mb-3">
                Category Allocation
                <span class="font-normal text-gray-500">
                  ({categoryTotal}% of 100%)
                </span>
                {#if !isCategoryValid}
                  <span class="text-red-500 text-xs ml-2">Must equal 0% or 100%</span>
                {/if}
              </h4>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label for="cat-a" class="block text-xs font-medium text-blue-700 mb-1">Category A (%)</label>
                  <input
                    id="cat-a"
                    type="number"
                    bind:value={categoryAPct}
                    min="0"
                    max="100"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label for="cat-b" class="block text-xs font-medium text-green-700 mb-1">Category B (%)</label>
                  <input
                    id="cat-b"
                    type="number"
                    bind:value={categoryBPct}
                    min="0"
                    max="100"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label for="cat-c" class="block text-xs font-medium text-orange-700 mb-1">Category C (%)</label>
                  <input
                    id="cat-c"
                    type="number"
                    bind:value={categoryCPct}
                    min="0"
                    max="100"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label for="cat-d" class="block text-xs font-medium text-purple-700 mb-1">Category D (%)</label>
                  <input
                    id="cat-d"
                    type="number"
                    bind:value={categoryDPct}
                    min="0"
                    max="100"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            <!-- Contact Section -->
            <div>
              <h4 class="text-sm font-medium text-gray-700 mb-3">Contact Information</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="contact-name" class="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                  <input
                    id="contact-name"
                    type="text"
                    bind:value={contactName}
                    placeholder="Primary contact"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label for="contact-email" class="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                  <input
                    id="contact-email"
                    type="email"
                    bind:value={contactEmail}
                    placeholder="email@example.com"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <!-- Links Section (collapsed by default for new grants) -->
            <details class="group" open={isEditing && (proposalDocUrl || internalNotesUrl || driveFolderUrl || githubRepo)}>
              <summary class="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                Document Links
                <span class="text-gray-400 text-xs ml-1">(click to expand)</span>
              </summary>
              <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="proposal-url" class="block text-sm font-medium text-gray-700 mb-1">Proposal Doc URL</label>
                  <input
                    id="proposal-url"
                    type="url"
                    bind:value={proposalDocUrl}
                    placeholder="https://docs.google.com/..."
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label for="notes-url" class="block text-sm font-medium text-gray-700 mb-1">Internal Notes URL</label>
                  <input
                    id="notes-url"
                    type="url"
                    bind:value={internalNotesUrl}
                    placeholder="https://docs.google.com/..."
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label for="folder-url" class="block text-sm font-medium text-gray-700 mb-1">Drive Folder URL</label>
                  <input
                    id="folder-url"
                    type="url"
                    bind:value={driveFolderUrl}
                    placeholder="https://drive.google.com/..."
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label for="github-url" class="block text-sm font-medium text-gray-700 mb-1">GitHub Repo URL</label>
                  <input
                    id="github-url"
                    type="url"
                    bind:value={githubRepo}
                    placeholder="https://github.com/..."
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </details>

            <!-- Notes Section -->
            <div>
              <label for="notes" class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                id="notes"
                bind:value={notes}
                rows="3"
                placeholder="Additional notes..."
                class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              ></textarea>
            </div>
          </div>
        </div>

        <div class="bg-gray-50 px-6 py-4 flex justify-end gap-3">
          <button
            type="button"
            onclick={onClose}
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Grant')}
          </button>
        </div>
      </form>
    </div>
  </div>
</div>
