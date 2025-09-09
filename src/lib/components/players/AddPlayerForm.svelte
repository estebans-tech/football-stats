<script lang="ts">
    import { t } from 'svelte-i18n'
    import { addPlayer } from '$lib/data/players'
  
    type Props = { onCreated?: (e: { id: string }) => void }

    let { onCreated }: Props = $props()
    let name = $state('')
    let nickname = $state('')
    let busy = $state(false)
    let err = $state<string | null>(null)

    async function submit() {
        if (busy) return
        const n = name.trim()
        const nn = nickname.trim()
        if (!n) { err = $t('players.form.validation.name_required'); return }
        err = null
        busy = true
        try {
        // default active + not archived so it shows up immediately
        const id = await addPlayer({ name: n, nickname: nn || null, active: true })
        onCreated?.({ id })               // <- fire callback (Svelte 5-friendly)
        name = ''; nickname = ''
        } finally {
        busy = false
        }
    }
  </script>
  
  <form class="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-start"
        onsubmit={(e) => { e.preventDefault(); submit(); }}>
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
    <button type="submit" class="btn btn-primary" disabled={busy}>
      {$t('players.form.add_button')}
    </button>
  
    {#if err}
      <div class="sm:col-span-3 text-sm text-red-600">{err}</div>
    {/if}
  </form>
  