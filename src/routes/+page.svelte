<script lang="ts">
  import { onMount } from 'svelte'
  import SessionCreate from '$lib/components/session/SessionCreate.svelte'
  import SessionList from '$lib/components/session/SessionList.svelte'
  import { canEdit, isAdmin, isAuthenticated } from '$lib/auth/client'
  import { ensureAnonData } from '$lib/sync/public'

  $: canAddMatch = isAdmin() || canEdit()

  onMount(async () => {
    if (!isAuthenticated()) {
      await ensureAnonData() // default metaKey & TTL 15 min
    }
  })
</script>

<section class="max-w-3xl mx-auto px-4 py-6">
  {#if canAddMatch}
    <SessionCreate />
  {/if}

  <SessionList />
</section>