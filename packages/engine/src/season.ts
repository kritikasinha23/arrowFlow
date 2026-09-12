/** UTC ISO week helpers. Season resets Monday 00:00 UTC. */

export type IsoWeek = {
  seasonId: string
  year: number
  week: number
  weekLabel: string
  startsAt: Date
  closesAt: Date
}

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

/** ISO week: Monday is the first day; week 1 contains the first Thursday. */
export function isoWeek(date = new Date()): IsoWeek {
  const day = utcDay(date)
  const dow = day.getUTCDay() || 7
  const thursday = new Date(day)
  thursday.setUTCDate(day.getUTCDate() + 4 - dow)
  const year = thursday.getUTCFullYear()
  const jan1 = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil(((thursday.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7)
  const startsAt = new Date(day)
  startsAt.setUTCDate(day.getUTCDate() - (dow - 1))
  startsAt.setUTCHours(0, 0, 0, 0)
  const closesAt = new Date(startsAt)
  closesAt.setUTCDate(startsAt.getUTCDate() + 7)
  const seasonId = `${year}-W${String(week).padStart(2, '0')}`
  return {
    seasonId,
    year,
    week,
    weekLabel: `Week ${week}`,
    startsAt,
    closesAt,
  }
}

export function formatEndsIn(closesAt: Date, now = new Date()): string {
  const ms = Math.max(0, closesAt.getTime() - now.getTime())
  const hours = Math.floor(ms / 3_600_000)
  const days = Math.floor(hours / 24)
  return `Ends in ${days}d ${hours % 24}h`
}

export function utcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export function previousUtcDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d - 1))
  return utcDateKey(next)
}

export function computeScore(input: {
  heartsLeft: number
  moves: number
  hints: number
  elapsedMs: number
  pieceCount: number
}): number {
  const extraMoves = Math.max(0, input.moves - input.pieceCount)
  const timePenalty = Math.floor(Math.max(0, input.elapsedMs) / 1000)
  return Math.max(
    0,
    10_000 + input.heartsLeft * 400 - extraMoves * 50 - input.hints * 120 - timePenalty,
  )
}

export function compareStandings(
  a: { heartsLost: number; moves: number; elapsedMs: number; score: number; userId: string },
  b: { heartsLost: number; moves: number; elapsedMs: number; score: number; userId: string },
): number {
  if (a.heartsLost !== b.heartsLost) return a.heartsLost - b.heartsLost
  if (a.moves !== b.moves) return a.moves - b.moves
  if (a.elapsedMs !== b.elapsedMs) return a.elapsedMs - b.elapsedMs
  if (a.score !== b.score) return b.score - a.score
  return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0
}
