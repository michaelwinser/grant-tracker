<script>
  let { status } = $props();

  function getStatusColor(status) {
    switch (status) {
      case 'Initial Contact':
        return 'bg-gray-100 text-gray-800';
      case 'Evaluation Meeting':
        return 'bg-blue-100 text-blue-800';
      case 'Proposal Development':
        return 'bg-yellow-100 text-yellow-800';
      case 'Stakeholder Review':
        return 'bg-purple-100 text-purple-800';
      case 'Approved':
        return 'bg-green-100 text-green-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      case 'Deferred':
        return 'bg-gray-100 text-gray-600';
      case 'Notification':
        return 'bg-indigo-100 text-indigo-800';
      case 'Signing':
        return 'bg-orange-100 text-orange-800';
      case 'Disbursement':
        return 'bg-teal-100 text-teal-800';
      case 'Active':
        return 'bg-green-100 text-green-800';
      case 'Finished':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }
</script>

{#if status}
  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(status)}">
    {status}
  </span>
{:else}
  <span class="text-gray-400">—</span>
{/if}
