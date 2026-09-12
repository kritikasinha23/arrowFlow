import {
  CAMPAIGN_START_ID,
  campaignIndex,
  isCampaignLevelId,
  nextCampaignLevelId,
} from './catalog.ts'

export { CAMPAIGN_START_ID }

export const PROGRESS_VERSION = 1 as const

export type PlayMode = 'campaign' | 'daily' | 'league'

export type LevelBest = {
  stars: number
  score: number
  heartsLeft: number
  moves: number
}

export type PendingScore = {
  boardId: string
  mode: PlayMode
  date?: string
  seasonId?: string
  hints: number
  elapsedMs: number
  moveLog: Array<{ arrowId: string; tMs: number; result: 'free' | 'blocked' }>
}

export type ProgressV1 = {
  version: 1
  lastCampaignLevelId: string
  completedIds: string[]
  campaign: Record<string, LevelBest>
  daily: Record<string, LevelBest>
  league: Record<string, LevelBest>
  pendingScores: PendingScore[]
}

export function emptyProgress(): ProgressV1 {
  return {
    version: PROGRESS_VERSION,
    lastCampaignLevelId: CAMPAIGN_START_ID,
    completedIds: [],
    campaign: {},
    daily: {},
    league: {},
    pendingScores: [],
  }
}

export function starsFromHearts(heartsLeft: number): number {
  return Math.max(0, Math.min(3, Math.floor(heartsLeft)))
}

export function isCampaignUnlocked(progress: ProgressV1, levelId: string): boolean {
  if (!isCampaignLevelId(levelId)) return false
  const idx = campaignIndex(levelId)
  const last = campaignIndex(progress.lastCampaignLevelId)
  if (last < 0) return levelId === CAMPAIGN_START_ID
  return idx <= last
}

export function pickBetterBest(current: LevelBest | undefined, incoming: LevelBest): LevelBest {
  if (!current) return incoming
  if (incoming.score !== current.score) return incoming.score > current.score ? incoming : current
  if (incoming.stars !== current.stars) return incoming.stars > current.stars ? incoming : current
  if (incoming.heartsLeft !== current.heartsLeft) {
    return incoming.heartsLeft > current.heartsLeft ? incoming : current
  }
  return incoming.moves < current.moves ? incoming : current
}

export function applyCampaignWin(progress: ProgressV1, levelId: string, result: LevelBest): ProgressV1 {
  if (result.heartsLeft <= 0) return progress
  if (!isCampaignLevelId(levelId)) return progress

  const completedIds = progress.completedIds.includes(levelId)
    ? progress.completedIds.slice()
    : [...progress.completedIds, levelId]

  const next: ProgressV1 = {
    ...progress,
    completedIds,
    campaign: {
      ...progress.campaign,
      [levelId]: pickBetterBest(progress.campaign[levelId], result),
    },
  }

  if (levelId === progress.lastCampaignLevelId) {
    const nxt = nextCampaignLevelId(levelId)
    if (nxt) next.lastCampaignLevelId = nxt
  }

  return next
}

export function applyModeBest(
  progress: ProgressV1,
  mode: PlayMode,
  key: string,
  result: LevelBest,
): ProgressV1 {
  if (!key) return progress
  if (mode === 'campaign') {
    return {
      ...progress,
      campaign: { ...progress.campaign, [key]: pickBetterBest(progress.campaign[key], result) },
    }
  }
  if (mode === 'daily') {
    return {
      ...progress,
      daily: { ...progress.daily, [key]: pickBetterBest(progress.daily[key], result) },
    }
  }
  return {
    ...progress,
    league: { ...progress.league, [key]: pickBetterBest(progress.league[key], result) },
  }
}

export function applyOutOfHearts(progress: ProgressV1): ProgressV1 {
  return progress
}

export function applyUndoAfterWin(progress: ProgressV1): ProgressV1 {
  return progress
}

export function enqueuePendingScore(progress: ProgressV1, pending: PendingScore): ProgressV1 {
  const exists = progress.pendingScores.some((row) => pendingKey(row) === pendingKey(pending))
  if (exists) return progress
  return { ...progress, pendingScores: [...progress.pendingScores, pending] }
}

export function dequeuePendingScore(progress: ProgressV1, pending: PendingScore): ProgressV1 {
  const key = pendingKey(pending)
  return {
    ...progress,
    pendingScores: progress.pendingScores.filter((row) => pendingKey(row) !== key),
  }
}

export function pendingKey(pending: PendingScore): string {
  return [pending.mode, pending.boardId, pending.date ?? '', pending.seasonId ?? '', pending.elapsedMs, pending.hints].join(
    ':',
  )
}

export function mergeBests(
  a: Record<string, LevelBest>,
  b: Record<string, LevelBest>,
): Record<string, LevelBest> {
  const out: Record<string, LevelBest> = { ...a }
  for (const [key, value] of Object.entries(b)) {
    out[key] = pickBetterBest(out[key], value)
  }
  return out
}

export function mergeProgress(a: ProgressV1, b: ProgressV1): ProgressV1 {
  const aIdx = campaignIndex(a.lastCampaignLevelId)
  const bIdx = campaignIndex(b.lastCampaignLevelId)
  const lastCampaignLevelId = bIdx > aIdx ? b.lastCampaignLevelId : a.lastCampaignLevelId
  const pending = new Map<string, PendingScore>()
  for (const row of [...a.pendingScores, ...b.pendingScores]) {
    pending.set(pendingKey(row), row)
  }
  return {
    version: PROGRESS_VERSION,
    lastCampaignLevelId,
    completedIds: [...new Set([...a.completedIds, ...b.completedIds])],
    campaign: mergeBests(a.campaign, b.campaign),
    daily: mergeBests(a.daily, b.daily),
    league: mergeBests(a.league, b.league),
    pendingScores: [...pending.values()],
  }
}

function isLevelBest(value: unknown): value is LevelBest {
  if (!value || typeof value !== 'object') return false
  const row = value as LevelBest
  return (
    Number.isFinite(row.stars) &&
    Number.isFinite(row.score) &&
    Number.isFinite(row.heartsLeft) &&
    Number.isFinite(row.moves)
  )
}

function isBestMap(value: unknown): value is Record<string, LevelBest> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value).every(isLevelBest)
}

function isPendingScore(value: unknown): value is PendingScore {
  if (!value || typeof value !== 'object') return false
  const row = value as PendingScore
  return (
    typeof row.boardId === 'string' &&
    (row.mode === 'campaign' || row.mode === 'daily' || row.mode === 'league') &&
    Number.isFinite(row.hints) &&
    Number.isFinite(row.elapsedMs) &&
    Array.isArray(row.moveLog)
  )
}

export function parseProgress(value: unknown): ProgressV1 | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<ProgressV1>
  if (raw.version !== PROGRESS_VERSION) return null
  if (typeof raw.lastCampaignLevelId !== 'string' || raw.lastCampaignLevelId.length === 0) return null
  if (!Array.isArray(raw.completedIds) || raw.completedIds.some((id) => typeof id !== 'string')) return null
  if (!isBestMap(raw.campaign) || !isBestMap(raw.daily) || !isBestMap(raw.league)) return null
  if (!Array.isArray(raw.pendingScores) || raw.pendingScores.some((row) => !isPendingScore(row))) return null
  return {
    version: PROGRESS_VERSION,
    lastCampaignLevelId: raw.lastCampaignLevelId,
    completedIds: raw.completedIds.slice(),
    campaign: raw.campaign,
    daily: raw.daily,
    league: raw.league,
    pendingScores: raw.pendingScores.slice(),
  }
}

export function listCampaignBests(progress: ProgressV1): Array<LevelBest & { boardId: string }> {
  return Object.entries(progress.campaign)
    .map(([boardId, best]) => ({ boardId, ...best }))
    .sort((a, b) => campaignIndex(a.boardId) - campaignIndex(b.boardId))
}
