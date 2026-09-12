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
]

export const CAMPAIGN_LEVEL_IDS = [
  ...TUTORIAL_LEVEL_IDS,
  ...WORKSHOP_LEVEL_IDS,
  ...PACKED_LEVEL_IDS,
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
