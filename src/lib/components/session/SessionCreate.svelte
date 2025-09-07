<script lang="ts">
    import { onMount } from 'svelte'
    import { t } from 'svelte-i18n'
    import type { SessionStatus } from '$lib/types/domain'
    import { createLocalSession } from '$lib/data/sessions' // helper i sessions.ts
    import { isoDate } from '$lib/utils/utils'

    let date = ''                // yyyy-mm-dd
    let status: SessionStatus = 'open'
    let busy = false
    let errorMessage = ''
    let successMessage = ''
  
    function validate(): string | null {
      if (!date) return $t('session.create.errors.date_required')
      return null
    }
  
    async function submit() {
      errorMessage = ''
      successMessage = ''
      const err = validate()
      if (err) { errorMessage = err; return }
      busy = true
      try {
        await createLocalSession({ date, status })
        successMessage = $t('session.create.success')
        // reset fields
        date = isoDate()
        status = 'open'
      } catch (e) {
          const m = String(e ?? '')
        // Show “already created” if we hit our duplicate guard or a unique constraint
        if (m.includes('DUPLICATE_DATE') || /unique|constraint/i.test(m)) {
          errorMessage = $t('session.create.errors.duplicate_date')
        } else if (m.includes('INVALID_DATE')) {
          errorMessage = $t('session.create.errors.date_required')
        } else {
          errorMessage = $t('session.create.errors.db')
        }

      } finally {
        busy = false
      }
    }
  
    const onSubmit = (e: SubmitEvent) => {
      e.preventDefault()
      submit()
    }

    onMount(() => {
      // Pre-fill with today's local date
      date = isoDate()
    })
  </script>
  
  <section class="mx-auto max-w-md w-full rounded-2xl border p-6 bg-white shadow-sm mb-6">
    <h1 class="text-xl font-semibold mb-2">{$t('session.create.title')}</h1>
    <p class="text-sm text-gray-600 mb-6">{$t('session.create.intro')}</p>
  
    <form class="space-y-4" on:submit={onSubmit} novalidate>
      <div>
        <label class="block text-sm font-medium mb-1" for="session-date">
          {$t('session.create.label_date')}
        </label>
        <input
          id="session-date"
          name="date"
          class="w-full rounded-lg border px-3 py-2"
          type="date"
          bind:value={date}
          required
          aria-invalid={errorMessage ? 'true' : 'false'}
        />
      </div>
  
      {#if errorMessage}
        <div class="text-sm text-red-600" role="alert" aria-live="assertive">{errorMessage}</div>
      {/if}
      {#if successMessage}
        <div class="text-sm text-green-700" role="status" aria-live="polite">{successMessage}</div>
      {/if}
  
      <button
        type="submit"
        class="btn btn-primary w-full"
        disabled={busy}
        aria-busy={busy ? 'true' : 'false'}
      >
        {#if busy}
          <span class="inline-block h-4 w-4 mr-2 animate-spin rounded-full border-2 border-gray-200 border-t-transparent"></span>
          {$t('session.create.submitting')}
        {:else}
          {$t('session.create.submit')}
        {/if}
      </button>
    </form>
  </section>
  