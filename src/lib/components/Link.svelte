<script lang="ts">
  import { theme } from '$lib/theme/store'

  type Props = {
    variant?: 'solid' | 'outline' | 'ghost' | 'utility'
    intent?: 'primary' | 'success' | 'danger' | 'neutral'
    size?: 'sm' | 'md' | 'lg'
    href: string
    class?: string
  }

  let { variant, intent, size, href, class: className }: Props = $props()

  // Apply defaults using $derived
  const finalVariant = $derived(variant ?? 'solid')
  const finalIntent = $derived(intent ?? 'primary')
  const finalSize = $derived(size ?? 'md')
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
        ? 'border border-gray-200 text-gray-900 hover:bg-gray-100 active:bg-gray-200 rounded-lg'
        : 'border border-white/15 text-white hover:bg-white/10 active:bg-white/15 rounded-lg'
    }

    if (finalVariant === 'solid') {
      switch (finalIntent) {
        case 'primary':
          return 'bg-blue-600 text-white hover:bg-blue-700'
        case 'success':
          return 'bg-emerald-600 text-white hover:bg-emerald-700'
        case 'danger':
          return 'bg-red-600 text-white hover:bg-red-700'
        case 'neutral':
          return isLight
            ? 'bg-gray-100 text-gray-900 hover:bg-gray-200'
            : 'bg-white text-gray-900 hover:bg-gray-100'
        default:
          return 'bg-blue-600 text-white hover:bg-blue-700'
      }
    }

    if (finalVariant === 'outline') {
      switch (finalIntent) {
        case 'primary':
          return 'border-2 border-blue-600 text-blue-600 hover:bg-blue-600/10'
        case 'success':
          return 'border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-600/10'
        case 'danger':
          return 'border-2 border-red-600 text-red-600 hover:bg-red-600/10'
        case 'neutral':
          return isLight
            ? 'border-2 border-gray-300 text-gray-900 hover:bg-gray-50'
            : 'border-2 border-white/20 text-white hover:bg-white/5'
        default:
          return 'border-2 border-blue-600 text-blue-600 hover:bg-blue-600/10'
      }
    }

    if (finalVariant === 'ghost') {
      switch (finalIntent) {
        case 'primary':
          return 'text-blue-600 hover:underline'
        case 'success':
          return 'text-emerald-600 hover:underline'
        case 'danger':
          return 'text-red-700 hover:underline'
        case 'neutral':
          return isLight
            ? 'text-gray-600 hover:underline'
            : 'text-slate-200 hover:underline'
        default:
          return 'text-blue-600 hover:underline'
      }
    }

    return ''
  })

  const combinedClasses = $derived(`${baseClasses} ${sizeClasses()} ${variantClasses()} ${finalClassName}`)
</script>

<a
  {href}
  class={combinedClasses}
  data-sveltekit-preload-data
>
  <slot />
</a>

