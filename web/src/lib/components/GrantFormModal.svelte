<script>
  import { grantsStore } from '../stores/grants.svelte.js';
  import { folderStore } from '../stores/folder.svelte.js';
  import { userStore } from '../stores/user.svelte.js';
  import { spreadsheetStore } from '../stores/spreadsheet.svelte.js';
  import { GrantStatus } from '../models.js';
  import { createGrantFolderStructure } from '../api/drive.js';

  // Props
  let {
    grant = null,  // null for create, grant object for edit
    onClose,
    onSaved,
  } = $props();

  let isEditing = $derived(grant !== null);
  let modalTitle = $derived(isEditing ? 'Edit Grant' : 'New Grant');

  // Form state
  let grantId = $state(grant?.ID || '');
  let title = $state(grant?.Title || '');
  let organization = $state(grant?.Organization || '');
  let primaryContact = $state(grant?.Primary_Contact || '');
  let otherContacts = $state(grant?.Other_Contacts || '');
  let status = $state(grant?.Status || GrantStatus.INITIAL_CONTACT);
  let amount = $state(grant?.Amount || '');
  let year = $state(grant?.Year || new Date().getFullYear());
  let beneficiary = $state(grant?.Beneficiary || '');
  let tags = $state(grant?.Tags || '');
  let categoryAPct = $state(grant?.Cat_A_Percent || 0);
  let categoryBPct = $state(grant?.Cat_B_Percent || 0);
  let categoryCPct = $state(grant?.Cat_C_Percent || 0);
  let categoryDPct = $state(grant?.Cat_D_Percent || 0);

  let isSubmitting = $state(false);
  let isCreatingFolder = $state(false);
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
    if (isSubmitting) return true; // Don't recheck during submission (optimistic update adds it)
    if (!grantId.trim()) return true; // Empty is handled by required validation
    return !grantsStore.grants.some(g => g.ID === grantId.trim());
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
    const currentYear = year || new Date().getFullYear();
    const codename = title
      ? title.split(' ')[0].replace(/[^a-zA-Z]/g, '')
      : 'Project';
    return `${code}-${currentYear}-${codename}`;
  }

  function handleGenerateId() {
    grantId = generateGrantId();
  }

  async function handleSubmit() {
    if (!canSubmit) return;

    isSubmitting = true;
    error = '';

    const grantData = {
      ID: grantId.trim(),
      Title: title.trim(),
      Organization: organization.trim() || null,
      Status: status,
      Amount: amount ? parseFloat(amount) : null,
      Primary_Contact: primaryContact.trim() || null,
      Other_Contacts: otherContacts.trim() || null,
      Year: year ? parseInt(year) : null,
      Beneficiary: beneficiary.trim() || null,
      Tags: tags.trim() || null,
      Cat_A_Percent: parseFloat(categoryAPct) || 0,
      Cat_B_Percent: parseFloat(categoryBPct) || 0,
      Cat_C_Percent: parseFloat(categoryCPct) || 0,
      Cat_D_Percent: parseFloat(categoryDPct) || 0,
      Folder_URL: null,
      Proposal_URL: null,
      Tracker_URL: null,
      SOW_URL: null,
    };

    try {
      let savedGrant;
      if (isEditing) {
        savedGrant = await grantsStore.update(grant.ID, grantData);
      } else {
        // Create the grant first
        savedGrant = await grantsStore.create(grantData);

        // If we have a grants folder, create the folder structure
        if (folderStore.hasGrantsFolder) {
          isCreatingFolder = true;
          try {
            const folderResult = await createGrantFolderStructure(
              userStore.accessToken,
              folderStore.grantsFolderId,
              grantData.ID,
              grantData,
              spreadsheetStore.spreadsheetId
            );

            // Update the grant with folder/doc URLs
            const updates = {
              Folder_URL: folderResult.folderUrl,
              Proposal_URL: folderResult.proposalUrl,
              Tracker_URL: folderResult.trackerUrl,
            };
            savedGrant = await grantsStore.update(grantData.ID, updates);
          } catch (folderErr) {
            // Folder creation failed, but grant was created
            console.error('Failed to create folder structure:', folderErr);
            // Don't throw - grant exists, just without folders
          } finally {
            isCreatingFolder = false;
          }
        }
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
                  <label for="beneficiary" class="block text-sm font-medium text-gray-700 mb-1">Beneficiary</label>
                  <input
                    id="beneficiary"
                    type="text"
                    bind:value={beneficiary}
                    placeholder="e.g., Python, JavaScript"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label for="status" class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    id="status"
                    bind:value={status}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {#each grantsStore.statusValues as s}
                      <option value={s}>{s}</option>
                    {/each}
                  </select>
                </div>

                <div>
                  <label for="tags" class="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                  <input
                    id="tags"
                    type="text"
                    bind:value={tags}
                    placeholder="e.g., Python, Security"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p class="mt-1 text-xs text-gray-500">Comma-separated list</p>
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
                  <label for="year" class="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <input
                    id="year"
                    type="number"
                    bind:value={year}
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
                  <label for="primary-contact" class="block text-sm font-medium text-gray-700 mb-1">Primary Contact</label>
                  <input
                    id="primary-contact"
                    type="text"
                    bind:value={primaryContact}
                    placeholder="Name or email"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label for="other-contacts" class="block text-sm font-medium text-gray-700 mb-1">Other Contacts</label>
                  <input
                    id="other-contacts"
                    type="text"
                    bind:value={otherContacts}
                    placeholder="Additional contacts"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
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
            {isCreatingFolder ? 'Creating folder...' : isSubmitting ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Grant')}
          </button>
        </div>
      </form>
    </div>
  </div>
</div>
