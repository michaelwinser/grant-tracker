<script>
  import { userStore } from '../stores/user.svelte.js';

  let isOpen = $state(false);
  let menuRef = $state(null);

  function toggleMenu() {
    isOpen = !isOpen;
  }

  function closeMenu() {
    isOpen = false;
  }

  async function handleSignOut() {
    closeMenu();
    await userStore.signOut();
  }

  function handleClickOutside(event) {
    if (menuRef && !menuRef.contains(event.target)) {
      closeMenu();
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      closeMenu();
    }
  }

  // Get user initials for avatar fallback
  function getInitials(name) {
    if (!name) return '?';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  $effect(() => {
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleKeydown);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<div class="relative" bind:this={menuRef}>
  <button
    onclick={toggleMenu}
    class="flex items-center gap-2 p-1 rounded-full hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50 transition-colors"
    aria-expanded={isOpen}
    aria-haspopup="true"
  >
    {#if userStore.user?.picture}
      <img
        src={userStore.user.picture}
        alt={userStore.user.name || 'User avatar'}
        class="w-8 h-8 rounded-full border-2 border-white/30"
        referrerpolicy="no-referrer"
      />
    {:else}
      <div class="w-8 h-8 rounded-full bg-blue-500 border-2 border-white/30 flex items-center justify-center text-white text-sm font-medium">
        {getInitials(userStore.user?.name)}
      </div>
    {/if}
    <svg
      class="w-4 h-4 text-white/80 transition-transform {isOpen ? 'rotate-180' : ''}"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  {#if isOpen}
    <div
      class="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-50"
      role="menu"
    >
      <div class="px-4 py-3 border-b border-gray-100">
        <p class="text-sm font-medium text-gray-900 truncate">
          {userStore.user?.name || 'User'}
        </p>
        <p class="text-sm text-gray-500 truncate">
          {userStore.user?.email || ''}
        </p>
      </div>
      <div class="py-1">
        <button
          onclick={handleSignOut}
          class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none transition-colors"
          role="menuitem"
        >
          Sign out
        </button>
      </div>
    </div>
  {/if}
</div>
