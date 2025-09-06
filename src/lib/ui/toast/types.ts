export type ToastVariant = 'info' | 'success' | 'warning' | 'danger'

export type ToastInput = {
  message: string
  variant?: ToastVariant
  timeout?: number   // ms; 0 = require manual close
}

export type Toast = Required<ToastInput> & {
  id: string
}