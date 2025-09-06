<script lang="ts">
  import { onMount } from 'svelte'

  let message = ''

  const load = async () => {
    message = 'Loaded'
  }

  onMount(load)
</script>


<!-- <h1 class="text-2xl font-semibold mb-3">{$t('home.title')}</h1> -->
<section class="max-w-3xl mx-auto px-4 py-6">
  Page {{ message }}
</section>