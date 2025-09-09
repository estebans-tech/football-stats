<script lang="ts">
  import { t } from 'svelte-i18n'
  import PlayerRow from '$lib/components/players/PlayerRow.svelte'
  import AddPlayerForm from '$lib/components/players/AddPlayerForm.svelte'
  import { observeLocalPlayersMap } from '$lib/data/players'
  import type { PlayerLocal } from '$lib/types/domain'

  // store with all players
  const players$ = observeLocalPlayersMap()

  // default: show ALL; user can hide archived
  let hideArchived = $state(false)

  const isArchived = (p: PlayerLocal) => Boolean(p.deletedAtLocal)

  const playersArr = $derived.by(() =>
    Object.values($players$ ?? {}).sort((a, b) => a.name.localeCompare(b.name))
  )

  const visible = $derived.by(() =>
    hideArchived ? playersArr.filter((p) => !isArchived(p)) : playersArr
  )

  const counts = $derived.by(() => {
    let active = 0, archived = 0
    for (const p of playersArr) (isArchived(p) ? archived++ : active++)
    return { active, archived, total: playersArr.length }
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
    <h1 class="text-xl font-semibold">{$t('players.title')}</h1>

    <label class="inline-flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={hideArchived}
        onchange={(e) => (hideArchived = (e.target as HTMLInputElement).checked)}
      />
      <span>{$t('players.hide_archived')}</span>
    </label>
  </header>

  <!-- Add form as separate component -->
  <AddPlayerForm onCreated={handleCreated} />

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
    <span class="mr-4">{$t('players.counts.archived')}: {counts.archived}</span>
    <span class="opacity-70">{$t('players.counts.total')}: {counts.total}</span>
  </div>
</div>
