<script lang="ts">
  import type { Snippet } from 'svelte'

  const { children, class: className = '' } = $props<{ children: Snippetm, class?: string }>()
</script>

<div class="mx-auto w-full max-w-screen-sm px-4 md:max-w-2xl md:px-6 lg:max-w-3xl {className}">
  {@render children()}
</div>
