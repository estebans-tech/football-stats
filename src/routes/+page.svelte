<script lang="ts">
  import { onMount } from 'svelte'
  import SessionCreate from '$lib/components/SessionCreate.svelte'
  import SessionList from '$lib/components/session/SessionList.svelte'
  import { isAdmin, canEdit, signOut } from '$lib/auth/auth'

  let message = ''

  const load = async () => {
    message = 'Loaded'
  }

  $: canAddMatch = $isAdmin || $canEdit


  onMount(load)
</script>


<!-- <h1 class="text-2xl font-semibold mb-3">{$t('home.title')}</h1> -->
<section class="max-w-3xl mx-auto px-4 py-6">
  {#if canAddMatch}
    <SessionCreate />
  {/if}

  <SessionList />

  Page {{ message }}
</section>