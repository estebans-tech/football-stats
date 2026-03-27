<script lang="ts">
  import type { Snippet } from 'svelte'

  const {
    level = 2,
    className = '',
    underline = false,
    children
  } = $props<{
    level?: 1|2|3|4|5|6
    className?: string
    underline?: boolean
    children: Snippet
  }>()

  const tags = ['h1','h2','h3','h4','h5','h6'] as const
  const Tag = tags[level - 1]

  const preset =
    level === 1 ? 'pt-5 md:pt-8 font-semibold tracking-tight leading-tight text-[clamp(28px,3.2vw,40px)]'
  : level === 2 ? 'pt-5 md:pt-6 text-2xl md:text-4xl font-semibold tracking-tight'
  :               'pt-4 text-xl md:text-md font-semibold tracking-tight'

  const accent = underline
    ? 'relative after:block after:h-0.5 after:bg-red-900 after:rounded-full after:mt-2 md:after:mt-3 after:w-12 md:after:w-16'
    : ''
</script>

<svelte:element this={Tag} class="{preset} {accent} {className}">
  {@render children()}
</svelte:element>

