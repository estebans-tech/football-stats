<script lang="ts">
  import { onMount } from 'svelte'
  import { t } from 'svelte-i18n'
  import SessionCreate from '$lib/components/session/SessionCreate.svelte'
  import SessionList from '$lib/components/session/SessionList.svelte'
  import SessionListAdmin from '$lib/components/session/SessionListAdmin.svelte'
  import Heading from '$lib/components/Heading.svelte'
  import SeasonSummary from '$lib/components/SeasonSummary.svelte'
  import PageContainer from '$lib/components/PageContainer.svelte'
  import { canEdit, isAdmin, isAuthenticated } from '$lib/auth/client'
  import { ensureAnonData } from '$lib/sync/public'
  import { getSeasonSummary } from '$lib/db/queries'

  import type { SeasonSummaryData } from '$lib/types/views'

  const canAddMatch = $derived(isAdmin() || canEdit())
  let summary = $state<SeasonSummaryData | null>(null)

  onMount(async () => {
    if (!isAuthenticated()) {
      await ensureAnonData() // default metaKey & TTL 15 min
      summary = await getSeasonSummary()
    }
  })
</script>

{#if !canAddMatch && summary}
  <SeasonSummary data={summary} />
{/if}

<PageContainer>
  <Heading level={1} underline>
    {$t('session.list.title')}
  </Heading>

  {#if canAddMatch}
    <SessionCreate />

    <SessionListAdmin />
  {:else}
    <SessionList />
  {/if}
</PageContainer>

