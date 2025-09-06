<script lang="ts">
  import { t, locale } from 'svelte-i18n'
  import { SUPPORTED_LOCALES, type LocaleCode } from '$lib/i18n/types'

  const LANG_LABEL_KEY: Record<LocaleCode, string> = {
    en: 'lang.en',
    de: 'lang.de',
    sv: 'lang.sv'
  }

  let open = false

  function setLang(code: LocaleCode) {
    locale.set(code)
    open = false
  }

  $: current = (/** @type {LocaleCode} */ ($locale as any)) ?? 'de'
</script>

<div class="relative">
  <button
    class="px-3 py-2 rounded-xl text-sm border hover:bg-black/5 transition"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={$t('header.a11y.language_button')}
    on:click={() => (open = !open)}
  >
    {$t('header.nav.language')}
  </button>

  {#if open}
    <ul
      class="absolute right-0 mt-2 w-40 rounded-xl border bg-white shadow"
      role="listbox"
      aria-label={$t('header.nav.language')}
    >
      {#each SUPPORTED_LOCALES as code}
        <li>
          <button
            class="w-full text-left px-3 py-2 hover:bg-black/5 text-sm"
            role="option"
            aria-selected={current === code}
            on:click={() => setLang(code)}
          >
            {$t(LANG_LABEL_KEY[code])}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
