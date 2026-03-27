<script lang="ts">
  type Props = {
    label: string
    value: string
    variant?: 'default' | 'red' | 'muted'
  }

  let { label, value, variant = 'default' }: Props = $props()

  const valueColor =
    variant === 'red'   ? 'text-red-400' :
    variant === 'muted' ? 'text-white/45' :
                          'text-white'
</script>

<div class="rounded-xl bg-white/5 border border-white/8 px-3 py-3 text-center">
  <p class="text-[22px] font-bold leading-none tabular-nums {valueColor}">{value}</p>
  <p class="mt-1.5 text-[10px] uppercase tracking-wider text-white/40">{label}</p>
</div>

