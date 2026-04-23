<script lang="ts">
  import { theme } from '$lib/theme/store'
  import type { Snippet } from 'svelte'

  type Props = {
    variant?: 'solid' | 'outline' | 'ghost' | 'utility'
    intent?: 'primary' | 'success' | 'danger' | 'neutral'
    size?: 'sm' | 'md' | 'lg'
    onclick?: () => void
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    class?: string
    children?: Snippet
  }

  let { variant, intent, size, onclick, disabled, type, class: className, children }: Props = $props()

  // Apply defaults using $derived
  const finalVariant = $derived(variant ?? 'solid')
  const finalIntent = $derived(intent ?? 'primary')
  const finalSize = $derived(size ?? 'md')
  const finalDisabled = $derived(disabled ?? false)
  const finalType = $derived(type ?? 'button')
  const finalClassName = $derived(className ?? '')
  
  const isLight = $derived($theme === 'light')

  // Base classes
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium transition-colors cursor-pointer'

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

  // Variant + Intent combinations with light mode support
  const variantClasses = $derived(() => {
    // Utility variant (same for light/dark with specific overrides)
    if (finalVariant === 'utility') {
      return isLight
        ? 'border border-gray-200 text-gray-900 hover:bg-gray-100 active:bg-gray-200 rounded-lg disabled:opacity-50'
        : 'border border-white/15 text-white hover:bg-white/10 active:bg-white/15 rounded-lg disabled:opacity-50'
    }

    if (finalVariant === 'solid') {
      switch (finalIntent) {
        case 'primary':
          return 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-600/50'
        case 'success':
          return 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-600/50'
        case 'danger':
          return 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/50'
        case 'neutral':
          return isLight
            ? 'bg-gray-100 text-gray-900 hover:bg-gray-200 disabled:bg-gray-100/50'
            : 'bg-white text-gray-900 hover:bg-gray-100 disabled:bg-white/50'
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
          return isLight
            ? 'border-2 border-gray-300 text-gray-900 hover:bg-gray-50 disabled:border-gray-200 disabled:text-gray-400'
            : 'border-2 border-white/20 text-white hover:bg-white/5 disabled:border-white/10 disabled:text-white/50'
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
          return isLight
            ? 'text-gray-600 hover:underline disabled:text-gray-400'
            : 'text-slate-200 hover:underline disabled:text-slate-200/50'
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
  {@render children?.()}
</button>

