import { describe, expect, it } from 'vitest'
import { computeScore, formatEndsIn, isoWeek, utcDateKey } from './season.ts'

describe('iso week', () => {
  it('uses UTC Monday 00:00 as the season close', () => {
    const info = isoWeek(new Date('2026-09-12T12:00:00.000Z'))
    expect(info.seasonId).toBe('2026-W37')
    expect(info.week).toBe(37)
    expect(info.weekLabel).toBe('Week 37')
    expect(info.startsAt.toISOString()).toBe('2026-09-07T00:00:00.000Z')
    expect(info.closesAt.toISOString()).toBe('2026-09-14T00:00:00.000Z')
  })

  it('rolls to the next ISO week on Monday UTC', () => {
    expect(isoWeek(new Date('2026-09-14T00:00:00.000Z')).seasonId).toBe('2026-W38')
  })

  it('formats a live countdown', () => {
    const closes = new Date('2026-09-14T00:00:00.000Z')
    expect(formatEndsIn(closes, new Date('2026-09-12T13:00:00.000Z'))).toBe('Ends in 1d 11h')
  })

  it('prints a UTC date key', () => {
    expect(utcDateKey(new Date('2026-09-12T23:30:00.000Z'))).toBe('2026-09-12')
  })
})

describe('score', () => {
  it('uses the plan formula', () => {
    expect(
      computeScore({ heartsLeft: 3, moves: 8, hints: 0, elapsedMs: 12_400, pieceCount: 8 }),
    ).toBe(10_000 + 1200 - 12)
  })
})
