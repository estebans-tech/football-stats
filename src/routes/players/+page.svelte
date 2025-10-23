<script lang="ts">
  import { t } from 'svelte-i18n'
  import PlayerRow from '$lib/components/players/PlayerRow.svelte'
  import AddPlayerForm from '$lib/components/players/AddPlayerForm.svelte'
  import { observeLocalPlayersMap } from '$lib/data/players'
  import type { PlayerLocal } from '$lib/types/domain'
  import Heading from '$lib/components/Heading.svelte'

  // store with all players
  const players$ = observeLocalPlayersMap()

  // default: show ALL; user can hide archived
  let hideArchived = $state(true)
  let hideActive = $state(false)

  const isArchived = (p: PlayerLocal) => Boolean(p.deletedAtLocal) || Boolean(p.deletedAt)

  const playersArr = $derived.by(() =>
    Object.values($players$ ?? {}).sort((a, b) => a.name.localeCompare(b.name))
  )

  const visible = $derived.by(() =>
  hideActive ? playersArr.filter((p) => p.active) : hideArchived ? playersArr.filter((p) => !isArchived(p)) : playersArr
  )

  const counts = $derived.by(() => {
    let active = 0, archived = 0, inactive = 0
    for (const p of playersArr) {
      if (isArchived(p)) { archived++; continue; }
      (p.active === true) ? active++ : inactive++
    }
    return { active, archived, inactive, total: playersArr.length }
  })

  // optional: flash the newly created row briefly
  let flashId = $state<string | null>(null)
  function handleCreated({ id }: { id: string }) {
    flashId = id
    setTimeout(() => { if (flashId === id) flashId = null }, 1200)
  }
</script>

<div class="mx-auto max-w-3xl space-y-4">
  <header class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <Heading level={1} underline>
      {$t('players.title')}
    </Heading>
    </header>

  <!-- Add form as separate component -->
  <AddPlayerForm onCreated={handleCreated} />

  <div class="flex gap-2 justify-end">
    <label class="inline-flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={hideArchived}
        onchange={(e) => (hideArchived = (e.target as HTMLInputElement).checked)}
      />
      <span>{$t('players.hide_archived')}</span>
    </label>
    <label class="inline-flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={hideActive}
        onchange={(e) => (hideActive = (e.target as HTMLInputElement).checked)}
      />
      <span>{$t('players.hide_inactive')}</span>
    </label>
  </div>

  <!-- List (PlayerRow renders its own <ul><li>, so don't wrap with <ul> here) -->
  <div class="space-y-0 mt-6">
    {#each visible as p (p.id)}
      <div class={p.id === flashId ? 'ring-2 ring-blue-500 rounded-xl' : ''}>
        <PlayerRow player={p as PlayerLocal} />
      </div>
    {/each}
    {#if visible.length === 0}
      <div class="text-sm text-gray-500 border rounded-xl p-4">{$t('players.list.empty')}</div>
    {/if}
  </div>

  <!-- Footer counts -->
  <div class="pt-2 text-sm text-right text-gray-700">
    <span class="mr-4">{$t('players.counts.active')}: {counts.active}</span>
    <span class="mr-4">{$t('players.actions.inactive')}: {counts.inactive}</span>
    <span class="mr-4">{$t('players.counts.archived')}: {counts.archived}</span>
    <span class="opacity-70">{$t('players.counts.total')}: {counts.total}</span>
  </div>
</div>
