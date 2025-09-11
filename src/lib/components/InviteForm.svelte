<script lang="ts">
import { t } from 'svelte-i18n'

export let form: { code?: string } | undefined;
export let next: string | undefined;

  // let code = ''
  let code = '';
  let busy = false

  function handleSubmit() {
    // do NOT preventDefault — allow normal POST + redirect/fail
    setTimeout(() => {
    }, 800);
    busy = true
  }
</script>

<section class="mx-auto max-w-md w-full rounded-sm border border-gray-300 p-6 bg-white shadow-md">

  <form class="space-y-3" method="POST"  on:submit={handleSubmit}>
    {#if next}<input type="hidden" name="next" value={next} />{/if}
    <div class="space-y-2">
      <label for="invite-code" class="block text-sm font-medium">
        {$t('invite.label_code')}
        </label>
      <input
        id="invite-code"
        name="code"
        class="w-full rounded-md border border-gray-300 px-3 py-2"
        type="text"
        placeholder={$t('invite.placeholder')}
        bind:value={code}
        autocomplete="one-time-code"
        spellcheck="false"
        required
        aria-invalid={form?.code ? 'true' : 'false'}
        aria-describedby={form?.code ? 'invite-error' : undefined}
        readonly={busy} 
      />

    </div>
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

  {#if form?.code}
    <div id="invite-error" class="mt-3 text-sm text-red-600" role="alert" aria-live="assertive">
      {$t(`invite.errors.${form.code}`) || $t('invite.errors.GENERIC')}
    </div>
  {/if}
</section>