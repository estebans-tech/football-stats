<script lang="ts">
  // Comments in English
  import { t } from 'svelte-i18n'
  import { acceptInvite } from '$lib/auth/auth'
  import { goto } from '$app/navigation'
  import { redeemInvite } from '$lib/auth/auth'

  import type { Role } from '$lib/auth/types'

  let code = ''
  let busy = false
  let errorMsg = ''
  let successRole: Role | null = null

  async function submit() {
    errorMsg = ''
    successRole = null
    const trimmed = code.trim()
    if (!trimmed) { errorMsg = $t('invite.errors.empty'); return }

    busy = true
    try {
      const res = await redeemInvite(trimmed)
      successRole = res.role as Role
      await new Promise((r) => setTimeout(r, 600))

      await goto('/')
    } catch (e: any) {
      errorMsg =
        e?.message === 'INVALID_INVITE'
          ? $t('invite.errors.invalid_code')
          : $t('invite.errors.generic')
    } finally {
      busy = false
    }
  }

  function onSubmit(e: SubmitEvent) {
    e.preventDefault()
    submit()
  }
</script>

<section class="mx-auto max-w-md w-full rounded-2xl border p-6 bg-white shadow-sm">
  <h1 class="text-xl font-semibold mb-2">{$t('invite.title')}</h1>
  <p class="text-sm text-gray-600 mb-6">{$t('invite.intro')}</p>

  <form class="space-y-3" on:submit|preventDefault={onSubmit} novalidate>
    <div>
      <label class="block text-sm font-medium mb-1" for="invite-code">
        {$t('invite.label_code')}
      </label>
      <input
        id="invite-code"
        name="code"
        class="w-full rounded-lg border px-3 py-2"
        type="text"
        placeholder={$t('invite.placeholder')}
        bind:value={code}
        autocomplete="one-time-code"
        spellcheck="false"
        required
        aria-invalid={errorMsg ? 'true' : 'false'}
        aria-describedby={errorMsg ? 'invite-error' : undefined}
      />
    </div>

    {#if successRole}
      <div class="text-sm text-green-700" role="status" aria-live="polite">
        {#if successRole === 'admin'}
          {$t('invite.success_admin')}
        {:else}
          {$t('invite.success_editor')}
        {/if}
        <span class="opacity-70"> {$t('invite.redirecting')}</span>
      </div>
    {/if}

    <button
      type="submit"
      class="btn btn-primary w-full"
      disabled={busy}
      aria-busy={busy ? 'true' : 'false'}
    >
      {#if busy}
        <span class="inline-block h-4 w-4 mr-2 animate-spin rounded-full border-2 border-gray-200 border-t-transparent"></span>
        {$t('invite.submitting')}
      {:else}
        {$t('invite.submit')}
      {/if}
    </button>
  </form>

  {#if errorMsg}
    <div id="invite-error" class="my-4 mx-auto text-sm text-red-600" role="alert" aria-live="assertive">
      {errorMsg}
    </div>
  {/if}

</section>
