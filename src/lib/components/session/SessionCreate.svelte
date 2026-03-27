<script lang="ts">
  import { t } from 'svelte-i18n'
  import type { SessionStatus } from '$lib/types/domain'
  import { createLocalSession } from '$lib/data/sessions'
  import { isoDate } from '$lib/utils/utils'
  import Card from '$lib/components/Card.svelte'

  let date = $state(isoDate())
  let status: SessionStatus = $state('open')
  let busy = $state(false)
  let errorMessage = $state('')
  let successMessage = $state('')

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
      date = isoDate()
      status = 'open'
    } catch (e) {
      const m = String(e ?? '')
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
</script>
<Card class="my-8">
  <div class="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
      <div>
        <label for="session-date" class="mb-1 block text-xs font-medium uppercase tracking-wider text-white/50">
          {$t('session.create.label_date')}
        </label>

        <input
          id="session-date"
          name="date"
          type="date"
          bind:value={date}
          required
          aria-invalid={!!errorMessage}
          class="w-full rounded-xl border border-white/15 bg-white/5 px-3 h-11 text-white
                 focus:outline-none focus:ring-2 focus:ring-red-700/50"
        />
      </div>

      <button
        type="button"
        class="btn btn-success md:w-auto w-full"
        disabled={busy}
        aria-busy={busy}
        onclick={submit}
      >
        {#if busy}
          <span class="spinner mr-2"></span>{$t('session.create.submitting')}
        {:else}
          {$t('session.create.submit')}
        {/if}
      </button>
    </div>

    <!-- Feedback utanför gridet -->
    {#if errorMessage}
      <p class="mt-2 text-sm text-red-400" role="alert" aria-live="assertive">{errorMessage}</p>
    {:else if successMessage}
      <p class="mt-2 text-sm text-emerald-400" role="status" aria-live="polite">{successMessage}</p>
    {/if}
</Card>

