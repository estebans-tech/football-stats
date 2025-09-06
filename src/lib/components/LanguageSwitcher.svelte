<script lang="ts">
  import { locale } from 'svelte-i18n'
  import { get } from 'svelte/store'

  // Supported locales; adjust if you add/remove languages
  const supported = ['en', 'de', 'sv'] as const
  let open = false

  // Change language and close the popover
  function setLang(code: (typeof supported)[number]) {
    locale.set(code)
    open = false
  }

  // Expose current locale value
  $: current = get(locale) || 'en'
</script>

<div class="relative">
  <button
    class="px-3 py-2 rounded-xl text-sm border hover:bg-black/5 transition"
    aria-haspopup="listbox"
    aria-expanded={open}
    on:click={() => (open = !open)}
  >
    <!-- {$t?.('nav.language') ?? 'Language'}: {current.toUpperCase()} -->
  </button>

  {#if open}
    <ul
      class="absolute right-0 mt-2 w-36 rounded-xl border bg-white shadow"
      role="listbox"
    >
      {#each supported as code}
        <li>
          <button
            class="w-full text-left px-3 py-2 hover:bg-black/5 text-sm"
            role="option"
            aria-selected={current === code}
            on:click={() => setLang(code)}
          >
            {code.toUpperCase()}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
