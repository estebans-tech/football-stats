<script lang="ts">
    import { page } from '$app/stores'
    import { t } from 'svelte-i18n'
  
    export let href = '/'
    export let labelKey!: string // e.g. 'nav.home'
  
    $: active =
      $page.url.pathname === href ||
      $page.url.pathname.startsWith(href + '/')
  </script>
  
  <a
  href={href}
  data-sveltekit-preload-code="hover"
  data-sveltekit-preload-data="hover"
  class="px-3 py-2 rounded-xl text-sm transition hover:bg-black/5 {active ? 'font-semibold bg-black/5' : ''}"
  aria-current={active ? 'page' : undefined}
>
  {$t(labelKey)}
</a>
  