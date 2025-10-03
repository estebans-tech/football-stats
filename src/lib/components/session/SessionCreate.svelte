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
  
    const handleSubmit = (e: SubmitEvent) => {
      e.preventDefault()
      submit()
    }

    onMount(() => {
      // Pre-fill with today's local date
      date = isoDate()
    })
  </script>
  
  <section class="mx-auto mt-4">
    <div class="relative overflow-hidden rounded-2xl bg-white ring-1 ring-black/10">
      <form
        class="grid gap-3 md:gap-4 p-4 md:p-5 md:grid-cols-[1fr_auto] md:items-end"
        on:submit|preventDefault={handleSubmit}
      >
        <!-- Date -->
        <div class="md:col-span-1">
          <label for="session-date" class="mb-1 block text-sm font-medium text-black/70">
            {$t('session.create.label_date')}
          </label>
  
          <input
            id="session-date"
            name="date"
            type="date"
            bind:value={date}
            required
            aria-invalid={!!errorMessage}
            aria-describedby="session-date-help session-date-feedback"
            class="w-full h-11 rounded-xl bg-white px-3 ring-1 ring-black/15
                   focus:outline-none focus:ring-2 focus:ring-red-900/40"
          />
          <!-- TODO: liten format-hjälp (alltid) -->
          <!-- <p id="session-date-help" class="mt-1 text-xs text-black/45">
            {$t('common.format')}: YYYY-MM-DD
          </p> -->
  
          <!-- feedback (visas direkt under fältet och tar inte extra kolumn) -->
          {#if errorMessage}
            <p id="session-date-feedback" class="mt-1 text-sm text-red-600" role="alert" aria-live="assertive">
              {errorMessage}
            </p>
          {:else if successMessage}
            <p id="session-date-feedback" class="mt-1 text-sm text-emerald-700" role="status" aria-live="polite">
              {successMessage}
            </p>
          {/if}
        </div>
  
        <!-- Submit -->
        <button
          type="submit"
          class="btn btn-primary-rosso md:w-auto w-full"
          disabled={busy}
          aria-busy={busy}
        >
          {#if busy}
            <span class="spinner mr-2"></span>{$t('session.create.submitting')}
          {:else}
            {$t('session.create.submit')}
          {/if}
        </button>
      </form>
    </div>
  </section>
  