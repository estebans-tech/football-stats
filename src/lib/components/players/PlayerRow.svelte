<script lang="ts">
  import { t } from 'svelte-i18n'
  import type { PlayerLocal } from '$lib/types/domain'
  import { setPlayerActive, setPlayerArchived, updatePlayer } from '$lib/data/players'

  type Props = { player: PlayerLocal }
  let { player }: Props = $props()

  // edit state
  let editing = $state(false)
  let name = $state(player.name ?? '')
  let nickname = $state(player.nickname ?? '')

  $effect(() => {
    if (!editing) {
      name = player.name ?? ''
      nickname = player.nickname ?? ''
    }
  })

  const isArchived = () => !!(player.deletedAtLocal)

  async function saveEdits() {
    editing = false
    await updatePlayer(player.id, { name: name.trim(), nickname: nickname.trim() || null })
  }
  async function toggleActive()   { await setPlayerActive(player.id, !player.active) }
  async function toggleArchived() { await setPlayerArchived(player.id, !isArchived()) }
</script>

<ul class="space-y-2">
  <!-- Mobile-first: stack; on >=sm align into two columns -->
  <li class="grid grid-cols-1 sm:grid-cols-[1fr_auto] items-center gap-3 py-3 pl-3 border-b border-gray-300">
    <!-- Left: name/nickname or inputs -->
    <div class="min-w-0">
      {#if !editing}
        {#if player.nickname}
          <div class="font-medium truncate">{player.nickname}</div>
        {/if}
        <div class="text-sm truncate text-gray-600 ">{player.name}</div>
      {:else}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            class="w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder={$t('players.form.name')}
            bind:value={name}
          />
          <input
            class="w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder={$t('players.form.nickname')}
            bind:value={nickname}
          />
        </div>
        <div class="mt-2 flex flex-wrap justify-end gap-2">
          <button type="button" class="btn btn-primary" onclick={saveEdits}>
            {$t('common.save')}
          </button>
          <button type="button" class="btn btn-outline" onclick={() => (editing = false)}>
            {$t('common.cancel')}
          </button>
        </div>
      {/if}
    </div>

    <!-- Right: actions -->
    <div class="flex flex-wrap justify-end gap-2">
      {#if !editing}
      <button
        type="button"
        class={`btn ${player.active ? 'btn-success' : 'btn-soft'}`}
        aria-label={player.active ? $t('players.actions.active') : $t('players.actions.inactive')}
        onclick={toggleActive}
      >
        {player.active ? $t('players.actions.active') : $t('players.actions.inactive')}
      </button>

      <button
        type="button"
        class={`btn ${isArchived() ? 'btn-warning' : 'btn-outline'}`}
        aria-label={isArchived() ? $t('players.actions.unarchive') : $t('players.actions.archive')}
        onclick={toggleArchived}
      >
        {isArchived() ? $t('players.actions.unarchive') : $t('players.actions.archive')}
      </button>

        <button
          type="button"
          class="btn btn-outline"
          aria-label={$t('common.edit')}
          onclick={() => (editing = true)}
        >
          {$t('common.edit')}
        </button>
      {/if}
    </div>
  </li>
</ul>
