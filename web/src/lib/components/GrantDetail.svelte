<script>
  import { grantsStore } from '../stores/grants.svelte.js';
  import { actionItemsStore } from '../stores/actionItems.svelte.js';
  import { router, navigate } from '../router.svelte.js';
  import StatusBadge from './StatusBadge.svelte';
  import { GrantStatus } from '../models.js';

  let grant = $derived(() => {
    const grantId = router.params.id;
    return grantsStore.grants.find(g => g.grant_id === grantId);
  });

  let grantActionItems = $derived(() => {
    if (!grant()) return [];
    return actionItemsStore.itemsByGrant(grant().grant_id);
  });

  let openActionItems = $derived(() => {
    return grantActionItems().filter(item => item.status === 'Open');
  });

  function formatAmount(amount) {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatRelativeDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) return 'Just now';
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return formatDate(dateStr);
  }

  function getCategoryBreakdown(g) {
    const categories = [];
    if (g.category_a_pct > 0) categories.push({ name: 'A', pct: g.category_a_pct, color: 'bg-blue-100 text-blue-800' });
    if (g.category_b_pct > 0) categories.push({ name: 'B', pct: g.category_b_pct, color: 'bg-green-100 text-green-800' });
    if (g.category_c_pct > 0) categories.push({ name: 'C', pct: g.category_c_pct, color: 'bg-orange-100 text-orange-800' });
    if (g.category_d_pct > 0) categories.push({ name: 'D', pct: g.category_d_pct, color: 'bg-purple-100 text-purple-800' });
    return categories;
  }

  function copyPermalink() {
    const url = `${window.location.origin}${window.location.pathname}#/grant/${encodeURIComponent(grant().grant_id)}`;
    navigator.clipboard.writeText(url);
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
      <li class="text-gray-900 font-medium">{grant().grant_id}</li>
    </ol>
  </nav>

  <!-- Header -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
    <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
      <div class="flex-1">
        <div class="flex items-center gap-3 mb-2">
          <h1 class="text-2xl font-bold text-gray-900">{grant().title || grant().grant_id}</h1>
          {#if grant().type}
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {grant().type}
            </span>
          {/if}
        </div>
        <div class="flex items-center gap-4 text-sm text-gray-500">
          <span class="font-mono text-gray-600">{grant().grant_id}</span>
          {#if grant().organization}
            <span>·</span>
            <span>{grant().organization}</span>
          {/if}
          {#if getCategoryBreakdown(grant()).length > 0}
            <span>·</span>
            <span>Category {getCategoryBreakdown(grant()).map(c => c.name).join(', ')}</span>
          {/if}
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="text-right">
          <div class="text-sm text-gray-500">Status</div>
          <div class="mt-1">
            <StatusBadge status={grant().status} />
          </div>
        </div>
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
        <div class="grid sm:grid-cols-2 gap-4">
          {#if grant().proposal_doc_url}
            <a href={grant().proposal_doc_url} target="_blank" rel="noopener noreferrer" class="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors group">
              <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <div>
                <div class="text-sm font-medium text-gray-900">Proposal Document</div>
                <div class="text-xs text-gray-500">Shared with grantee</div>
              </div>
              <svg class="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
            </a>
          {:else}
            <div class="flex items-center gap-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <div>
                <div class="text-sm font-medium text-gray-400">Proposal Document</div>
                <div class="text-xs text-gray-400">Not linked</div>
              </div>
            </div>
          {/if}

          {#if grant().internal_notes_url}
            <a href={grant().internal_notes_url} target="_blank" rel="noopener noreferrer" class="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors group">
              <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
              </div>
              <div>
                <div class="text-sm font-medium text-gray-900">Internal Notes</div>
                <div class="text-xs text-gray-500">Team only</div>
              </div>
              <svg class="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
            </a>
          {:else}
            <div class="flex items-center gap-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
              </div>
              <div>
                <div class="text-sm font-medium text-gray-400">Internal Notes</div>
                <div class="text-xs text-gray-400">Not linked</div>
              </div>
            </div>
          {/if}

          {#if grant().drive_folder_url}
            <a href={grant().drive_folder_url} target="_blank" rel="noopener noreferrer" class="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors group">
              <div class="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center group-hover:bg-yellow-200 transition-colors">
                <svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                </svg>
              </div>
              <div>
                <div class="text-sm font-medium text-gray-900">Drive Folder</div>
                <div class="text-xs text-gray-500">All grant files</div>
              </div>
              <svg class="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
            </a>
          {:else}
            <div class="flex items-center gap-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                </svg>
              </div>
              <div>
                <div class="text-sm font-medium text-gray-400">Drive Folder</div>
                <div class="text-xs text-gray-400">Not linked</div>
              </div>
            </div>
          {/if}

          {#if grant().github_repo}
            <a href={grant().github_repo} target="_blank" rel="noopener noreferrer" class="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors group">
              <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                <svg class="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </div>
              <div>
                <div class="text-sm font-medium text-gray-900">GitHub Repo</div>
                <div class="text-xs text-gray-500">Monthly reports</div>
              </div>
              <svg class="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
            </a>
          {:else}
            <div class="flex items-center gap-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </div>
              <div>
                <div class="text-sm font-medium text-gray-400">GitHub Repo</div>
                <div class="text-xs text-gray-400">Not linked</div>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <!-- Action Items -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200">
        <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 class="text-lg font-semibold text-gray-900">Action Items</h2>
          <span class="text-sm text-gray-500">{openActionItems().length} open</span>
        </div>
        {#if grantActionItems().length === 0}
          <div class="px-6 py-8 text-center text-gray-500">
            <p>No action items yet.</p>
          </div>
        {:else}
          <ul class="divide-y divide-gray-100">
            {#each grantActionItems() as item (item.item_id)}
              <li class="px-6 py-4 hover:bg-gray-50 {item.status === 'Done' ? 'bg-gray-50' : ''}">
                <div class="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={item.status === 'Done'}
                    disabled
                    class="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm {item.status === 'Done' ? 'text-gray-500 line-through' : 'text-gray-900'}">
                      {item.description}
                    </p>
                    <div class="flex items-center gap-2 mt-1">
                      {#if item.assignee}
                        <span class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs {item.status === 'Done' ? 'text-gray-500' : 'text-gray-600'}">
                          {item.assignee}
                        </span>
                      {/if}
                      {#if item.due_date}
                        <span class="text-xs {item.status === 'Done' ? 'text-gray-400' : 'text-gray-500'}">
                          {item.status === 'Done' ? 'Completed' : 'Due'} {formatDate(item.due_date)}
                        </span>
                      {/if}
                    </div>
                  </div>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
        <div class="px-6 py-3 border-t border-gray-100">
          <button class="text-sm text-gray-400 cursor-not-allowed" disabled>
            + Add action item (coming soon)
          </button>
        </div>
      </div>

      <!-- Notes -->
      {#if grant().notes}
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
          <p class="text-sm text-gray-700 whitespace-pre-wrap">{grant().notes}</p>
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
            <dd class="text-sm font-medium text-gray-900 mt-1">{formatAmount(grant().amount)}</dd>
          </div>
          {#if grant().grant_year}
            <div>
              <dt class="text-xs text-gray-500">Grant Year</dt>
              <dd class="text-sm text-gray-900 mt-1">{grant().grant_year}</dd>
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
          {#if grant().ecosystem}
            <div>
              <dt class="text-xs text-gray-500">Ecosystem</dt>
              <dd class="text-sm text-gray-900 mt-1">{grant().ecosystem}</dd>
            </div>
          {/if}
          {#if grant().program_manager}
            <div>
              <dt class="text-xs text-gray-500">Program Manager</dt>
              <dd class="text-sm text-gray-900 mt-1">{grant().program_manager}</dd>
            </div>
          {/if}
        </dl>
      </div>

      <!-- Contact -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">Contact</h3>
        <dl class="space-y-4">
          {#if grant().organization}
            <div>
              <dt class="text-xs text-gray-500">Organization</dt>
              <dd class="text-sm text-gray-900 mt-1">{grant().organization}</dd>
            </div>
          {/if}
          {#if grant().contact_name}
            <div>
              <dt class="text-xs text-gray-500">Primary Contact</dt>
              <dd class="text-sm text-gray-900 mt-1">{grant().contact_name}</dd>
            </div>
          {/if}
          {#if grant().contact_email}
            <div>
              <dt class="text-xs text-gray-500">Email</dt>
              <dd class="mt-1">
                <a href="mailto:{grant().contact_email}" class="text-sm text-indigo-600 hover:underline">
                  {grant().contact_email}
                </a>
              </dd>
            </div>
          {/if}
        </dl>
      </div>

      <!-- Dates -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">Dates</h3>
        <dl class="space-y-3 text-sm">
          <div class="flex justify-between">
            <dt class="text-gray-500">Created</dt>
            <dd class="text-gray-900">{formatDate(grant().created_at)}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-gray-500">Last updated</dt>
            <dd class="text-gray-900">{formatRelativeDate(grant().updated_at)}</dd>
          </div>
          {#if grant().status_changed_at}
            <div class="flex justify-between">
              <dt class="text-gray-500">Status changed</dt>
              <dd class="text-gray-900">{formatDate(grant().status_changed_at)}</dd>
            </div>
          {/if}
        </dl>
      </div>
    </div>
  </div>
{/if}
