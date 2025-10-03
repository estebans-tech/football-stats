<script lang="ts">
  import { t, locale } from 'svelte-i18n'
  import { SUPPORTED_LOCALES, type LocaleCode } from '$lib/i18n/types'

  let open = false

  $: current = (/** @type {LocaleCode} */ ($locale as any)) ?? 'de'
</script>

<div class="relative">
  <button
    class="px-3 py-2 rounded-xl text-sm border rounded-sm border-gray-300 hover:bg-black/5 transition"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={$t('header.a11y.language_button')}
    on:click={() => (open = !open)}
  >
    {$t('header.nav.language')}
  </button>

  {#if open}
    <ul
      class="absolute right-0 mt-1 w-40 rounded-sm border border-gray-300 bg-black"
      role="listbox"
      aria-label={$t('header.nav.language')}
    >
      {#each SUPPORTED_LOCALES as code}
        <li>
          <a
            class="w-full block text-left px-3 py-2 hover:bg-black/5 text-sm"
            href={`/lang/${code}`}
            aria-selected={current === code}
            role="option"
            aria-current={current === code ? 'true' : 'false'}
          >
            {$t(`lang.${code}`)}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>
