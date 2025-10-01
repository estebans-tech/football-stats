<script lang="ts">
  import SessionCreate from '$lib/components/session/SessionCreate.svelte'
  import SessionList from '$lib/components/session/SessionList.svelte'
  import { canEdit, isAdmin } from '$lib/auth/client'

  $: canAddMatch = isAdmin() || canEdit()
</script>

<section class="max-w-3xl mx-auto px-4 py-6">
  {#if canAddMatch}
    <SessionCreate />
  {/if}

  <SessionList />
</section>