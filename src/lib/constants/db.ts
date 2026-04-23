export const DB_TABLES = [
  'sessions_local',
  'matches_local',
  'lineups_local',
  'goals_local',
  'players_local'
] as const

export type DbTableName = typeof DB_TABLES[number]
