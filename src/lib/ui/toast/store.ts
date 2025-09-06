import { writable } from 'svelte/store'
import type { Toast, ToastInput, ToastVariant } from './types'

function id() {
  return Math.random().toString(36).slice(2, 9)
}

const _store = writable<Toast[]>([])

function push(input: ToastInput): string {
  const t: Toast = {
    id: id(),
    message: input.message,
    variant: input.variant ?? 'info',
    timeout: input.timeout ?? 2500
  }
  _store.update((arr) => [...arr, t])
  return t.id
}

function dismiss(id: string) {
  _store.update((arr) => arr.filter((t) => t.id !== id))
}

function clear() {
  _store.set([])
}

function of(variant: ToastVariant) {
  return (message: string, timeout?: number) => push({ message, variant, timeout })
}

export const toasts = {
  subscribe: _store.subscribe,
  push,
  dismiss,
  clear,
  info: of('info'),
  success: of('success'),
  warning: of('warning'),
  danger: of('danger')
}

export type { Toast, ToastInput }
