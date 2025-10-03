<script lang="ts">
  import { ChevronRight } from "lucide-svelte"
  type Props = {
    title: string
    caption: string
    url: string
  }

  let { title = '', url = '', caption = '' }: Props = $props()
</script>
<a
  href={url}
  class="block mx-auto max-w-screen-sm mt-6 px-5 py-5
       rounded-2xl bg-white ring-1 ring-black/10
       relative overflow-hidden
       transition duration-150 active:scale-[.99]">
  <span class="absolute left-0 top-0 h-full w-1.5 bg-red-900"></span>
  <div class="flex items-center justify-between gap-4">
    <div class="min-w-0">
      <p class="text-xl font-semibold">{title}</p>
      <p class="text-sm text-black/60 mt-0.5">{caption}</p>
    </div>
    <span class="ml-auto">
      <ChevronRight size={22}
      class="shrink-0 text-black/50 transition-transform duration-150
             group-hover:translate-x-0.5 group-active:translate-x-0.5" />
    </span>
  </div>
</a>