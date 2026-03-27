export type SeasonSummaryData = {
  totalGoals: number
  matchCount: number
  playerCount: number
  topScorer: string | null
  year: number
}

export type MatchResult = {
  matchId: string
  orderNo: number
  red: number   // team A goals
  black: number // team B goals
}

export type SessionListItem = {
  id: string
  date: string
  matchCount: number
  totalGoals: number
  results: MatchResult[]
}

