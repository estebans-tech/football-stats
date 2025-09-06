export type Role = 'anon' | 'editor' | 'admin'

export const isRole = (val: unknown): val is Role =>
  val === 'anon' || val === 'editor' || val === 'admin'