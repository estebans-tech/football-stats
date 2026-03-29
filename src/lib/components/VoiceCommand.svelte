<script lang="ts">
  // Component: Push-to-talk voice capture + "what I understood" preview
  // - Uses Web Speech API wrapper and the parser utils
  // - Emits no side effects, only displays parsed result

  import { onMount } from 'svelte'
  import type { LanguageCode, ParseResult } from '$lib/types/voice'
  import type { TeamAB, TeamColor } from '$lib/types/domain'
  import { createSpeechRecognizer, getSpeechSupport } from '$lib/utils/speech'
  import { parseCommand } from '$lib/utils/commands'

  type CommandDetail = {
    intent: ParseResult['intent']
    payload: ParseResult['payload']
    text: string
    confidence: number
    candidates?: ParseResult['candidates']
  }

  // ---------- props (Svelte 5 runes mode) ----------
  type Props = {
    lang?: LanguageCode | 'en-US'
    teamMap: Record<TeamColor, TeamAB>            // required: e.g. { red: 'A', black: 'B' }
    playerDirectory?: Record<TeamAB, Array<{ id: string, name: string, nickname?: string | null }>>
    preferNickname?: boolean
    interim?: boolean
    pushToTalk?: boolean
    debug?: boolean
    onCommand?: (d: CommandDetail) => void
  }

  let {
    lang = 'sv-SE',
    teamMap,
    playerDirectory,
    preferNickname = true,
    interim = true,
    pushToTalk = true,
    debug = false,
    onCommand
  }: Props = $props()

  // ---------- local state ----------
  let listening = $state(false)
  let stateLabel = $state<'idle' | 'listening' | 'processing' | 'unsupported'>('idle')

  let partialText = $state('')
  let finalText = $state('')
  let parsed: ParseResult | null = $state(null)
  let errorMsg = $state<string | null>(null)

  let controller: ReturnType<typeof createSpeechRecognizer> | null = null
  const support = getSpeechSupport()

  // ---------- lifecycle ----------
  onMount(() => {
    if (!support.available) {
      stateLabel = 'unsupported'
      return
    }

    controller = createSpeechRecognizer({
      lang,
      interim
    })

    controller.on('state', e => {
      stateLabel = e.to
      listening = e.to === 'listening'
    })

    controller.on('partial', e => {
      partialText = e.text
    })

    controller.on('final', e => {
      finalText = e.text

      parsed = parseCommand(e.text, {
        lang,
        teamMap,
        playerDirectory,
        preferNickname
      })

      if (!parsed) {
        errorMsg = 'No command recognized'
      } else {
        errorMsg = null

        // ⬇️ NYTT: ring upp förälderns callback
        if (typeof onCommand === 'function') {
          const { intent, payload, confidence, candidates } = parsed
          onCommand({ intent, payload, text: e.text, confidence, candidates })
        }
      }
    })

    controller.on('error', e => {
      errorMsg = e.message ?? 'Speech error'
    })

    return () => {
      controller?.destroy()
      controller = null
    }
  })

  // ---------- actions ----------
  function start() {
    if (!controller) return
    errorMsg = null
    parsed = null
    finalText = ''
    partialText = ''
    controller.start()
  }

  function stop() {
    if (!controller) return
    controller.stop()
  }

  function abort() {
    if (!controller) return
    controller.abort()
  }

  // Expose minimal imperative API if parent binds this
  // (Optional: parent can call these for accessibility shortcuts)
  export { start, stop, abort }
</script>

<!-- ---------- UI ---------- -->
<section class="w-full space-y-4">
  <!-- Mic / Push-to-talk control -->
  <div class="flex items-center gap-3">
    <button
      class="btn btn-primary active:scale-95 disabled:opacity-50"
      disabled={stateLabel === 'unsupported'}
      aria-pressed={listening}
      onmousedown={() => { if (pushToTalk) start() }}
      onmouseup={() => { if (pushToTalk) stop() }}
      ontouchstart={() => { if (pushToTalk) start() }}
      ontouchend={() => { if (pushToTalk) stop() }}
      onclick={() => { if (!pushToTalk) listening ? stop() : start() }}
    >
      {#if stateLabel === 'unsupported'}
        🎤 Not supported
      {:else if listening}
        🎙️ Listening…
      {:else if stateLabel === 'processing'}
        ⏳ Processing…
      {:else}
        🎤 {pushToTalk ? 'Hold to talk' : 'Tap to toggle'}
      {/if}
    </button>

    <div class="text-sm text-muted-foreground">
      {#if stateLabel === 'unsupported'}
        Web Speech API unavailable
      {:else if listening}
        Release to stop
      {:else if stateLabel === 'processing'}
        Parsing transcript…
      {:else}
        Ready
      {/if}
    </div>
  </div>

  <!-- Transcript panel -->
  <div class="rounded-xl border p-3 bg-background">
    <div class="text-xs uppercase tracking-wide text-muted-foreground mb-2">Transcript</div>
    {#if partialText}
      <p class="text-sm"><span class="opacity-60">{partialText}</span></p>
    {/if}
    {#if finalText}
      <p class="text-base font-medium">{finalText}</p>
    {:else if !partialText}
      <p class="text-sm opacity-60">Say: “lag röd Anna” / “mål svart Johansson” or “team rot Anna” / “tor schwarz Johansson”</p>
    {/if}
  </div>

  <!-- Parsed understanding -->
  <div class="rounded-xl border p-3 bg-background">
    <div class="text-xs uppercase tracking-wide text-muted-foreground mb-2">Understood</div>

    {#if parsed}
      <div class="space-y-2">
        <div class="flex flex-wrap gap-2 text-sm">
          <span class="px-2 py-1 rounded-full bg-secondary">intent: <strong class="ml-1">{parsed.intent}</strong></span>
          <span class="px-2 py-1 rounded-full bg-secondary">color: <strong class="ml-1">{parsed.payload.color}</strong></span>
          <span class="px-2 py-1 rounded-full bg-secondary">team: <strong class="ml-1">{parsed.payload.team}</strong></span>
          <span class="px-2 py-1 rounded-full bg-secondary">confidence: <strong class="ml-1">{Math.round(parsed.confidence * 100)}%</strong></span>
        </div>

        <div class="text-sm">
          <div>player:</div>
          <div class="pl-3">
            <div class="font-medium">{parsed.payload.player.nickname ?? parsed.payload.player.name}</div>
            {#if parsed.payload.player.nickname && parsed.payload.player.nickname !== parsed.payload.player.name}
              <div class="text-xs text-muted-foreground">name: {parsed.payload.player.name}</div>
            {/if}
          </div>
        </div>

        {#if parsed.candidates && parsed.candidates.length > 1}
          <div class="pt-2">
            <div class="text-sm mb-1">candidates:</div>
            <ul class="pl-5 list-disc space-y-1">
              {#each parsed.candidates as c, i}
                <li class="text-sm">
                  <span class="font-medium">{c.nickname ?? c.name}</span>
                  {#if c.nickname && c.nickname !== c.name}
                    <span class="opacity-60"> — {c.name}</span>
                  {/if}
                  {#if c.score != null}
                    <span class="ml-2 text-xs opacity-70">({Math.round(c.score * 100)}%)</span>
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    {:else}
      <p class="text-sm opacity-60">{errorMsg ?? 'No command yet'}</p>
    {/if}
  </div>

  {#if debug}
    <div class="rounded-xl border p-3 bg-background">
      <div class="text-xs uppercase tracking-wide text-muted-foreground mb-2">Debug</div>
      <pre class="text-xs overflow-x-auto">{JSON.stringify({ stateLabel, listening, finalText, parsed, errorMsg }, null, 2)}</pre>
    </div>
  {/if}
</section>
