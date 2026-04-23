import { writable } from 'svelte/store'
import { browser } from '$app/environment'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'kk-theme'

// Get initial theme from localStorage or default to dark
function getInitialTheme(): Theme {
  if (!browser) return 'dark'
  
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  
  // Default to dark mode
  return 'dark'
}

function createThemeStore() {
  const { subscribe, set, update } = writable<Theme>(getInitialTheme())

  return {
    subscribe,
    toggle: () => {
      update(current => {
        const next = current === 'dark' ? 'light' : 'dark'
        
        if (browser) {
          localStorage.setItem(STORAGE_KEY, next)
          
          // Update document class
          if (next === 'light') {
            document.documentElement.classList.add('light-mode')
          } else {
            document.documentElement.classList.remove('light-mode')
          }
        }
        
        return next
      })
    },
    set: (theme: Theme) => {
      set(theme)
      
      if (browser) {
        localStorage.setItem(STORAGE_KEY, theme)
        
        // Update document class
        if (theme === 'light') {
          document.documentElement.classList.add('light-mode')
        } else {
          document.documentElement.classList.remove('light-mode')
        }
      }
    },
    // Initialize theme on mount
    init: () => {
      if (!browser) return
      
      const theme = getInitialTheme()
      
      if (theme === 'light') {
        document.documentElement.classList.add('light-mode')
      } else {
        document.documentElement.classList.remove('light-mode')
      }
    }
  }
}

export const theme = createThemeStore()

