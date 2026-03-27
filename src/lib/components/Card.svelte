<script lang="ts">
  import type { Snippet } from 'svelte'

  const {
    children,
    class: className = ''
  } = $props<{
    children: Snippet
    class?: string
  }>()
</script>

<div class="rounded-xl border border-white/10 bg-white/5 p-4 {className}">
  {@render children()}
</div>
