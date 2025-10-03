<script lang="ts">
type Props = {
  label: string
  value: string
  tag?: keyof HTMLElementTagNameMap
}

let { label = '', value = '', tag = 'div' }: Props = $props()
</script>

<svelte:element this={tag}
  class="rounded-2xl bg-white ring-1 ring-black/5 shadow-sm px-4 py-3 relative overflow-hidden">
    
  <span class="absolute left-0 top-2 bottom-2 w-1.5 rounded-full
  bg-gradient-to-b from-red-900 to-red-800"></span>
  <p class="text-[11px] uppercase tracking-wide text-black/55">{label}</p>
  <p class="mt-0.5 text-[1.65rem] leading-none font-semibold tabular-nums">{value}</p>
</svelte:element>