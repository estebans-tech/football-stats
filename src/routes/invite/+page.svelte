<script lang="ts">
  import InviteForm from '$lib/components/InviteForm.svelte'
  export let form: { code?: string } | undefined; // <-- receive form here
  export let next: string | undefined;
</script>
  
  <div class="px-4 py-6">
    <InviteForm {next} {form} />
  </div>