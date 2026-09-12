import { describe, expect, it } from 'vitest'
import {
  displayNameFromInstallId,
  isBannedCombo,
  isUglyGeneratedName,
  NAME_ADJECTIVES,
  NAME_NOUNS,
  normalizeDisplayName,
  POLISHED_NAME_RE,
} from './names.ts'

const POLISHED = /^[A-Z][a-z]+ [A-Z][a-z]+ \d{1,4}$/

describe('display names', () => {
  it('builds a two-word name plus a number from installId', () => {
    const name = displayNameFromInstallId('8f3c1a2e-4b5d-6789-abcd-ef0123456789')
    expect(name).toMatch(POLISHED)
    expect(name).toMatch(POLISHED_NAME_RE)
    expect(name.startsWith('Thread')).toBe(false)
  })

  it('never returns Threadabc-style tokens', () => {
    const ugly = /^Thread[A-Za-z]+$/
    for (let i = 0; i < 500; i++) {
      const name = displayNameFromInstallId(`install-${i}-seed-${'abcdef'[i % 6]}`)
      expect(name).not.toMatch(ugly)
      expect(name).toMatch(POLISHED)
      expect(name).not.toMatch(/^(Guest|User\d+|Player[_])/i)
      expect(name.includes(' ')).toBe(true)
    }
  })

  it('is stable for the same installId', () => {
    const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    expect(displayNameFromInstallId(id)).toBe(displayNameFromInstallId(id))
  })

  it('differs across install ids', () => {
    const a = displayNameFromInstallId('11111111-1111-4111-8111-111111111111')
    const b = displayNameFromInstallId('22222222-2222-4222-8222-222222222222')
    expect(a).not.toBe(b)
  })

  it('keeps curated lists around forty words with no banned joins', () => {
    expect(NAME_ADJECTIVES.length).toBeGreaterThanOrEqual(38)
    expect(NAME_NOUNS.length).toBeGreaterThanOrEqual(38)
    for (const adj of NAME_ADJECTIVES) {
      for (const noun of NAME_NOUNS) {
        expect(isBannedCombo(adj, noun)).toBe(false)
      }
    }
  })

  it('flags old ugly generated names', () => {
    expect(isUglyGeneratedName('Threadabc')).toBe(true)
    expect(isUglyGeneratedName('ThreadSilver')).toBe(true)
    expect(isUglyGeneratedName('Guest')).toBe(true)
    expect(isUglyGeneratedName('User1')).toBe(true)
    expect(isUglyGeneratedName('Player_12')).toBe(true)
    expect(isUglyGeneratedName('Kritika')).toBe(true)
    expect(isUglyGeneratedName('Quiet Needle 17')).toBe(false)
    expect(isUglyGeneratedName('Soft Current 321')).toBe(false)
  })

  it('accepts a 2–20 character rename', () => {
    expect(normalizeDisplayName('  Quiet Needle  ')).toBe('Quiet Needle')
    expect(normalizeDisplayName('A')).toBeNull()
    expect(normalizeDisplayName('abcdefghijklmnopqrstu')).toBeNull()
  })
})
