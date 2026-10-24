export type Chapter = {
  id: string
  title: string
  levelIds: string[]
}

export const TUTORIAL_LEVEL_IDS = [
  'flow_0001',
  'flow_0002',
  'flow_0003',
  'flow_0004',
  'flow_0005',
] as const

export const WORKSHOP_LEVEL_IDS = [
  'flow_0006',
  'flow_0007',
  'flow_0008',
  'flow_0009',
  'flow_0010',
  'flow_0011',
  'flow_0012',
] as const

export const PACKED_LEVEL_IDS = [
  'flow_0013',
  'flow_0014',
  'flow_0015',
  'flow_0016',
  'flow_0017',
  'flow_0018',
  'flow_0019',
  'flow_0020',
  'flow_0021',
  'flow_0022',
  'flow_0023',
  'flow_0024',
  'flow_0025',
  'flow_0026',
  'flow_0027',
  'flow_0028',
  'flow_0029',
  'flow_0030',
  'flow_0031',
  'flow_0032',
] as const

/** Shaped + long-mix boards (generator SILHOUETTE_SPECS). */
export const SILHOUETTE_LEVEL_IDS = [
  'flow_0033',
  'flow_0034',
  'flow_0035',
  'flow_0036',
  'flow_0037',
  'flow_0038',
  'flow_0039',
  'flow_0040',
  'flow_0041',
  'flow_0042',
  'flow_0043',
  'flow_0044',
] as const

export type Tier = 'easy' | 'medium' | 'hard' | 'extraHard' | 'nightmare'

/** Display tier for Levels UI — tutorial/workshop stay easy/medium by chapter. */
export const LEVEL_TIER: Record<string, Tier> = {
  flow_0013: 'easy',
  flow_0014: 'easy',
  flow_0015: 'medium',
  flow_0016: 'medium',
  flow_0017: 'medium',
  flow_0018: 'medium',
  flow_0019: 'hard',
  flow_0020: 'hard',
  flow_0021: 'hard',
  flow_0022: 'hard',
  flow_0023: 'hard',
  flow_0024: 'hard',
  flow_0025: 'extraHard',
  flow_0026: 'extraHard',
  flow_0027: 'extraHard',
  flow_0028: 'extraHard',
  flow_0029: 'extraHard',
  flow_0030: 'nightmare',
  flow_0031: 'nightmare',
  flow_0032: 'nightmare',
  flow_0033: 'medium',
  flow_0034: 'medium',
  flow_0035: 'hard',
  flow_0036: 'hard',
  flow_0037: 'hard',
  flow_0038: 'hard',
  flow_0039: 'extraHard',
  flow_0040: 'extraHard',
  flow_0041: 'extraHard',
  flow_0042: 'nightmare',
  flow_0043: 'nightmare',
  flow_0044: 'nightmare',
}

export const TIER_LABEL: Record<Tier, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  extraHard: 'Extra Hard',
  nightmare: 'Nightmare',
}

export function tierForLevel(id: string): Tier | null {
  if ((TUTORIAL_LEVEL_IDS as readonly string[]).includes(id)) return 'easy'
  if ((WORKSHOP_LEVEL_IDS as readonly string[]).includes(id)) return 'medium'
  return LEVEL_TIER[id] ?? null
}

export const CHAPTERS: Chapter[] = [
  { id: 'first-steps', title: 'First Steps', levelIds: [...TUTORIAL_LEVEL_IDS] },
  { id: 'workshop', title: 'Workshop', levelIds: [...WORKSHOP_LEVEL_IDS] },
  {
    id: 'packed-house',
    title: 'Packed House',
    levelIds: PACKED_LEVEL_IDS.slice(0, 10),
  },
  {
    id: 'deep-grid',
    title: 'Deep Grid',
    levelIds: PACKED_LEVEL_IDS.slice(10),
  },
  {
    id: 'silhouettes',
    title: 'Silhouettes',
    levelIds: [...SILHOUETTE_LEVEL_IDS],
  },
]

export const CAMPAIGN_LEVEL_IDS = [
  ...TUTORIAL_LEVEL_IDS,
  ...WORKSHOP_LEVEL_IDS,
  ...PACKED_LEVEL_IDS,
  ...SILHOUETTE_LEVEL_IDS,
] as const

/** Tutorial board. First-run start — not a missing-id fallback. */
export const CAMPAIGN_START_ID = 'flow_0001'

export const LEAGUE_LEVEL_ID = 'flow_0031'

export function campaignIndex(id: string): number {
  return (CAMPAIGN_LEVEL_IDS as readonly string[]).indexOf(id)
}

export function isCampaignLevelId(id: string): boolean {
  return campaignIndex(id) >= 0
}

export function nextCampaignLevelId(id: string): string | null {
  const index = campaignIndex(id)
  if (index < 0) return null
  return CAMPAIGN_LEVEL_IDS[index + 1] ?? null
}

export function utcDayNumber(date = new Date()): number {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000)
}

export function getDailyLevelId(date = new Date(), packedIds: readonly string[] = PACKED_LEVEL_IDS): string {
  if (packedIds.length === 0) {
    throw new Error('packed catalog is empty')
  }
  const day = utcDayNumber(date)
  return packedIds[((day % packedIds.length) + packedIds.length) % packedIds.length]
}

export function levelNumber(id: string): string {
  const match = /flow_(\d+)/.exec(id)
  return match ? String(Number(match[1])) : id
}
