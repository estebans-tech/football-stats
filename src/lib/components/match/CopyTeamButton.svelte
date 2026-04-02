<script lang="ts">
  import { t } from 'svelte-i18n'
  import { Copy } from 'lucide-svelte'
  import Button from '$lib/components/Button.svelte'
  import { copyLineupsFromPreviousMatch } from '$lib/data/lineups'
  import type { MatchLocal, LineupLocal } from '$lib/types/domain'

  type Props = {
    match: MatchLocal | undefined
    lineups: LineupLocal[]
  }

  let { match, lineups }: Props = $props()

  // Only show button for match 2 and onwards
  const shouldShow = $derived(match && match.orderNo >= 2)

  // Check if current match already has lineups
  const hasLineups = $derived(
    lineups.filter(l => !l.deletedAtLocal && l.op !== 'delete').length > 0
  )
  // Button state
  let copying = $state(false)
  let copied = $state(false)

  async function handleCopy() {
    if (!match || copying || hasLineups) return

    copying = true
    copied = false

    try {
      const count = await copyLineupsFromPreviousMatch(match.id)
      
      if (count > 0) {
        copied = true
        // Reset success state after 2 seconds
        setTimeout(() => {
          copied = false
        }, 2000)
      }
    } catch (error) {
      console.error('Failed to copy team:', error)
    } finally {
      copying = false
    }
  }
</script>

{#if shouldShow}
  <Button
    variant="outline"
    intent="neutral"
    onclick={handleCopy}
    disabled={copying || copied || hasLineups}
  >
    {#if copying}
      {$t('match_day.match.events.copying')}
    {:else if copied}
      {$t('match_day.match.events.copied')}
    {:else}
      {$t('match_day.match.actions.copy_prev_match')}
    {/if}
  </Button>
{/if}

<!-- Light mode preparation -->
<style>
  :global(.light-mode) {
    /* TODO: Light mode styles */
  }
</style>

