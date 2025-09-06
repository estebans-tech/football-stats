<script lang="ts">
  import SessionCreate from '$lib/components/session/SessionCreate.svelte'
  import SessionList from '$lib/components/session/SessionList.svelte'
  import { isAdmin, canEdit } from '$lib/auth/auth'

  $: canAddMatch = $isAdmin || $canEdit
</script>


<!-- <h1 class="text-2xl font-semibold mb-3">{$t('home.title')}</h1> -->
<section class="max-w-3xl mx-auto px-4 py-6">
  {#if canAddMatch}
    <SessionCreate />
  {/if}

  <SessionList />
</section>