<script lang="ts">
  import Button from '$lib/components/Button.svelte'
  import { exportDb, importDb } from '$lib/utils/db-export'
  import type { ImportResult } from '$lib/types/sync'

  // --- State ---
  let exporting = $state(false)
  let importing = $state(false)
  let importResult = $state<ImportResult | null>(null)
  let importError = $state<string | null>(null)
  let fileInput = $state<HTMLInputElement | null>(null)

  // --- Handlers ---
  async function handleExport() {
    exporting = true
    try {
      await exportDb()
    } finally {
      exporting = false
    }
  }

  async function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    importing = true
    importResult = null
    importError = null

    try {
      importResult = await importDb(file)
    } catch (err) {
      importError = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      importing = false
      input.value = ''
    }
  }

  function triggerImport() {
    fileInput?.click()
  }
</script>

<div class="mx-auto max-w-2xl px-4 py-8 space-y-10">
  <h1 class="text-2xl font-bold text-white">Settings</h1>

  <section class="space-y-4">
    <h2 class="text-sm font-semibold uppercase tracking-widest text-white/40">Database</h2>

    <div class="rounded-xl bg-white/5 divide-y divide-white/10">

      <!-- Export -->
      <div class="flex items-center justify-between px-4 py-4">
        <div>
          <p class="text-sm font-medium text-white">Export local DB</p>
          <p class="text-xs text-white/40 mt-0.5">Download all local data as JSON</p>
        </div>
        <Button variant="utility" onclick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export'}
        </Button>
      </div>

      <!-- Import -->
      <div class="flex items-center justify-between px-4 py-4">
        <div>
          <p class="text-sm font-medium text-white">Import local DB</p>
          <p class="text-xs text-white/40 mt-0.5">Restore from a previously exported JSON file</p>
        </div>
        <Button variant="utility" onclick={triggerImport} disabled={importing}>
          {importing ? 'Importing…' : 'Import'}
        </Button>
        <input
          bind:this={fileInput}
          type="file"
          accept="application/json"
          onchange={handleFileChange}
          class="hidden"
        />
      </div>

    </div>

    <!-- Feedback -->
    {#if importResult}
      <div class="rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-400">
        ✓ Imported {importResult.imported} rows successfully.
        {#if importResult.errors.length}
          <ul class="mt-1 text-yellow-400 text-xs">
            {#each importResult.errors as err}
              <li>⚠ {err}</li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}

    {#if importError}
      <div class="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
        ✗ {importError}
      </div>
    {/if}
  </section>
</div>
