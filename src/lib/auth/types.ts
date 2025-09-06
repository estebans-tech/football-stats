export type Role = 'anon' | 'editor' | 'admin'
export type Profile = { user_id: string, display_name?: string|null, role: Role, club_id?: string|null } | null

export const isRole = (val: unknown): val is Role =>
  val === 'anon' || val === 'editor' || val === 'admin'

