<script lang="ts">
  import Header from '$lib/components/Header.svelte'
  import '../app.css'
</script>


<Header />

<!-- <nav class="w-full sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
    Här är nav
</nav> -->

<main class="max-w-3xl mx-auto px-4 py-6">
  <slot />
</main>
