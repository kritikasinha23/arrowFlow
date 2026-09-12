/** Curated nature / fiber / motion words. Not unique; userId is the key. */
export const NAME_ADJECTIVES = [
  'Silver',
  'Quiet',
  'Soft',
  'Bright',
  'Amber',
  'Velvet',
  'Hidden',
  'Swift',
  'Calm',
  'Coral',
  'Ivory',
  'Lunar',
  'Misty',
  'Noble',
  'Pale',
  'Rapid',
  'Steady',
  'Warm',
  'Azure',
  'Bold',
  'Crisp',
  'Deep',
  'Fair',
  'Keen',
  'Light',
  'Maple',
  'Night',
  'Olive',
  'Pearl',
  'Sage',
  'Vivid',
  'Cedar',
  'Frost',
  'Honey',
  'Jade',
  'Moss',
  'Ocean',
  'Pine',
  'River',
  'Storm',
] as const

export const NAME_NOUNS = [
  'Thread',
  'Needle',
  'Current',
  'Loom',
  'Grove',
  'Ember',
  'Spindle',
  'Shuttle',
  'Fiber',
  'Strand',
  'Ribbon',
  'Knot',
  'Weave',
  'Yarn',
  'Bobbin',
  'Latch',
  'Cord',
  'Loop',
  'Stitch',
  'Warp',
  'Weft',
  'Quill',
  'Tassel',
  'Braid',
  'Silk',
  'Linen',
  'Fleece',
  'Arrow',
  'Lattice',
  'Harbor',
  'Meadow',
  'Glacier',
  'Brook',
  'Reed',
  'Vale',
  'Drift',
  'Spark',
  'Bloom',
  'Fern',
  'Crest',
] as const

export const DISPLAY_NAME_MIN = 2
export const DISPLAY_NAME_MAX = 20

/** Title Case adjective, Title Case noun, space, 1–4 digit number. */
export const POLISHED_NAME_RE = /^[A-Z][a-z]+ [A-Z][a-z]+ \d{1,4}$/

const BANNED_STEMS = [
  'ass',
  'sex',
  'damn',
  'hell',
  'crap',
  'shit',
  'fuck',
  'dick',
  'cock',
  'piss',
  'slut',
  'porn',
  'rape',
  'nigg',
  'fag',
  'cunt',
  'kike',
  'spic',
  'whore',
  'retard',
  'anal',
  'tit',
  'boob',
  'bastard',
  'bitch',
]

function hash32(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** True when a banned stem spans the adjective/noun join (not inside one curated word). */
export function isBannedCombo(adjective: string, noun: string): boolean {
  if (adjective.toLowerCase() === noun.toLowerCase()) return true
  const a = adjective.toLowerCase()
  const n = noun.toLowerCase()
  const joined = `${a}${n}`
  for (const bad of BANNED_STEMS) {
    let from = 0
    while (from <= joined.length - bad.length) {
      const idx = joined.indexOf(bad, from)
      if (idx === -1) break
      const end = idx + bad.length
      const insideAdj = end <= a.length
      const insideNoun = idx >= a.length
      if (!insideAdj && !insideNoun) return true
      from = idx + 1
    }
  }
  return false
}

function nameFromHash(h: number): { adj: string; noun: string; num: number; name: string } {
  const adj = NAME_ADJECTIVES[h % NAME_ADJECTIVES.length]
  const noun = NAME_NOUNS[Math.floor(h / NAME_ADJECTIVES.length) % NAME_NOUNS.length]
  const num = (Math.floor(h / 10_000) % 9999) + 1
  return { adj, noun, num, name: `${adj} ${noun} ${num}` }
}

/** Deterministic Adjective + Noun + 1–9999 from installId, e.g. "Quiet Needle 17". */
export function displayNameFromInstallId(installId: string): string {
  const seed = installId || 'arrowflow'
  let h = hash32(seed)
  for (let i = 0; i < 64; i++) {
    const next = nameFromHash(h)
    if (!isBannedCombo(next.adj, next.noun) && POLISHED_NAME_RE.test(next.name)) {
      return next.name
    }
    h = hash32(`${seed}:${i}`)
  }
  return 'Quiet Needle 17'
}

/**
 * Old generator junk: Threadabc, Guest, User1, Player_, or any name with no space.
 * Customized names are protected separately via nameCustomized.
 */
export function isUglyGeneratedName(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return true
  if (/^Thread[A-Za-z]+$/.test(trimmed)) return true
  if (/^(Guest|User\d+|Player[_])/i.test(trimmed)) return true
  if (!trimmed.includes(' ')) return true
  return false
}

export function normalizeDisplayName(raw: string): string | null {
  const trimmed = raw.replace(/\s+/g, ' ').trim()
  if (trimmed.length < DISPLAY_NAME_MIN || trimmed.length > DISPLAY_NAME_MAX) return null
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '\-]*$/u.test(trimmed)) return null
  return trimmed
}
