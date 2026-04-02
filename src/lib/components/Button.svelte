<script lang="ts">
  type Props = {
    variant?: 'solid' | 'outline' | 'ghost'
    intent?: 'primary' | 'success' | 'danger' | 'neutral'
    size?: 'sm' | 'md' | 'lg'
    onclick?: () => void
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    class?: string
  }

  let { variant, intent, size, onclick, disabled, type, class: className }: Props = $props()

  // Apply defaults using $derived
  const finalVariant = $derived(variant ?? 'solid')
  const finalIntent = $derived(intent ?? 'primary')
  const finalSize = $derived(size ?? 'md')
  const finalDisabled = $derived(disabled ?? false)
  const finalType = $derived(type ?? 'button')
  const finalClassName = $derived(className ?? '')

  // Base classes
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-colors cursor-pointer'

  // Size variants
  const sizeClasses = $derived(() => {
    switch (finalSize) {
      case 'sm':
        return 'px-3 py-1.5 text-sm'
      case 'lg':
        return 'px-6 py-3 text-base'
      case 'md':
      default:
        return 'px-4 py-2 text-sm'
    }
  })

  // Variant + Intent combinations
  const variantClasses = $derived(() => {
    if (finalVariant === 'solid') {
      switch (finalIntent) {
        case 'primary':
          return 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-600/50'
        case 'success':
          return 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-600/50'
        case 'danger':
          return 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/50'
        case 'neutral':
          return 'bg-white text-gray-900 hover:bg-gray-100 disabled:bg-white/50'
        default:
          return 'bg-blue-600 text-white hover:bg-blue-700'
      }
    }

    if (finalVariant === 'outline') {
      switch (finalIntent) {
        case 'primary':
          return 'border-2 border-blue-600 text-blue-600 hover:bg-blue-600/10 disabled:border-blue-600/50 disabled:text-blue-600/50'
        case 'success':
          return 'border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-600/10 disabled:border-emerald-600/50 disabled:text-emerald-600/50'
        case 'danger':
          return 'border-2 border-red-600 text-red-600 hover:bg-red-600/10 disabled:border-red-600/50 disabled:text-red-600/50'
        case 'neutral':
          return 'border-2 border-white/20 text-white hover:bg-white/5 disabled:border-white/10 disabled:text-white/50'
        default:
          return 'border-2 border-blue-600 text-blue-600 hover:bg-blue-600/10'
      }
    }

    if (finalVariant === 'ghost') {
      switch (finalIntent) {
        case 'primary':
          return 'text-blue-600 hover:underline disabled:text-blue-600/50'
        case 'success':
          return 'text-emerald-600 hover:underline disabled:text-emerald-600/50'
        case 'danger':
          return 'text-red-700 hover:underline disabled:text-red-700/50'
        case 'neutral':
          return 'text-slate-200 hover:underline disabled:text-slate-200/50'
        default:
          return 'text-blue-600 hover:underline'
      }
    }

    return ''
  })

  const combinedClasses = $derived(`${baseClasses} ${sizeClasses()} ${variantClasses()} ${finalClassName}`)
</script>

<button
  type={finalType}
  disabled={finalDisabled}
  onclick={onclick}
  class={combinedClasses}
>
  <slot />
</button>

<!-- Light mode preparation -->
<style>
  :global(.light-mode) button {
    /* TODO: Light mode styles */
  }
</style>

