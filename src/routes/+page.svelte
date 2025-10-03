<script lang="ts">
  import { onMount } from 'svelte'
  import { t } from 'svelte-i18n'
  import SessionCreate from '$lib/components/session/SessionCreate.svelte'
  import SessionList from '$lib/components/session/SessionList.svelte'
  import SessionListAdmin from '$lib/components/session/SessionListAdmin.svelte'
  import Heading from '$lib/components/Heading.svelte'
  import { canEdit, isAdmin, isAuthenticated } from '$lib/auth/client'
  import { ensureAnonData } from '$lib/sync/public'

  $: canAddMatch = isAdmin() || canEdit()

  onMount(async () => {
    if (!isAuthenticated()) {
      await ensureAnonData() // default metaKey & TTL 15 min
    }
  })
</script>

<Heading level={1} underline>
  {$t('session.list.title')}
</Heading>

{#if canAddMatch}
  <SessionCreate />
{/if}

{#if canAddMatch}
  <SessionListAdmin />
{:else}
  <SessionList />
{/if}
