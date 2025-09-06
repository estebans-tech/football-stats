<script lang="ts">
  import Header from '$lib/components/Header.svelte'
  import '../app.css'
</script>


<Header />

<main class="max-w-3xl mx-auto px-4 py-6">
  <slot />
</main>
