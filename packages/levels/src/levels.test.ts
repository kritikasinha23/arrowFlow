import { describe, expect, it } from 'vitest'
import { PuzzleEngine } from '@arrowflow/engine'
import { CAMPAIGN_LEVEL_IDS, CAMPAIGN_START_ID, getDailyLevelId, LEAGUE_LEVEL_ID, PACKED_LEVEL_IDS } from './catalog.ts'
import { getLevel, hasLevel, listLevelIds, listLevels } from './index.ts'

describe('level catalog', () => {
  it('includes at least 10 flow_ levels', () => {
    expect(listLevelIds().length).toBeGreaterThanOrEqual(10)
    expect(listLevelIds().every((id) => /^flow_\d{4}$/.test(id))).toBe(true)
  })

  it('ships 20 packed originals from 5x5 to 10x12', () => {
    expect(PACKED_LEVEL_IDS).toHaveLength(20)
    const packed = listLevels().filter((level) => PACKED_LEVEL_IDS.includes(level.levelId as (typeof PACKED_LEVEL_IDS)[number]))
    expect(packed).toHaveLength(20)
    expect(packed.every((level) => level.width >= 5 && level.height >= 5)).toBe(true)
    expect(packed.some((level) => level.width >= 10 && level.height >= 12)).toBe(true)
    for (const level of packed) {
      const occupied = level.arrows.reduce((n, arrow) => n + arrow.cells.length, 0)
      expect(occupied).toBe(level.width * level.height)
      expect(level.arrows.length).toBeGreaterThan(1)
      expect(level.arrows.every((arrow) => arrow.cells.length >= 2)).toBe(true)
      const engine = new PuzzleEngine(level)
      let guard = 0
      while (!engine.isWon && guard++ < 80) {
        const next = engine.availableArrows()[0]
        expect(next).toBeTruthy()
        engine.commitFree(next)
      }
      expect(engine.isWon).toBe(true)
      const iPieces = level.arrows.filter((arrow) => {
        let turns = 0
        for (let i = 2; i < arrow.cells.length; i++) {
          const a = arrow.cells[i - 1]
          const b = arrow.cells[i - 2]
          const c = arrow.cells[i]
          const d1r = a.row - b.row
          const d1c = a.col - b.col
          const d2r = c.row - a.row
          const d2c = c.col - a.col
          if (d1r !== d2r || d1c !== d2c) turns += 1
        }
        return turns === 0
      }).length
      expect(iPieces / level.arrows.length).toBeLessThan(0.35)
    }
  })

  it('daily pick is date-seeded and stays in the packed catalog', () => {
    const a = getDailyLevelId(new Date('2026-09-12T00:00:00Z'))
    const b = getDailyLevelId(new Date('2026-09-12T23:00:00Z'))
    const c = getDailyLevelId(new Date('2026-09-13T00:00:00Z'))
    expect(a).toBe(b)
    expect(PACKED_LEVEL_IDS).toContain(a)
    expect(PACKED_LEVEL_IDS).toContain(c)
    expect(listLevelIds()).toContain(LEAGUE_LEVEL_ID)
    expect(CAMPAIGN_LEVEL_IDS[0]).toBe(CAMPAIGN_START_ID)
    expect(CAMPAIGN_START_ID).toBe('flow_0001')
  })

  it('starts at flow_0001 as the real campaign start, not a packed fallback', () => {
    expect(listLevelIds()[0]).toBe('flow_0001')
    expect(CAMPAIGN_START_ID).not.toBe('flow_0015')
    expect(CAMPAIGN_START_ID).not.toBe('flow_0025')
  })

  it('does not remap a missing id to flow_0015', () => {
    expect(hasLevel('flow_9999')).toBe(false)
    expect(() => getLevel('flow_9999')).toThrow(/unknown/)
    expect(() => getLevel('flow_9999')).not.toThrow(/flow_0015/)
  })

  it('returns a clone from getLevel', () => {
    const level = getLevel('flow_0001')
    level.arrows.pop()
    expect(getLevel('flow_0001').arrows).toHaveLength(1)
  })

  it('throws on an unknown id', () => {
    expect(() => getLevel('flow_9999')).toThrow(/unknown/)
  })

  it('listLevels matches getLevel', () => {
    for (const level of listLevels()) {
      expect(getLevel(level.levelId).levelId).toBe(level.levelId)
    }
  })
})

describe('every catalog level loads in the engine', () => {
  for (const id of listLevelIds()) {
    it(`constructs ${id}`, () => {
      const e = new PuzzleEngine(getLevel(id))
      expect(e.board.levelId).toBe(id)
      expect(e.hearts).toBe(3)
    })
  }
})

describe('scripted levels', () => {
  it('flow_0001 is a trivial free I', () => {
    const e = new PuzzleEngine(getLevel('flow_0001'))
    expect(e.tryWeave('A')).toMatchObject({ kind: 'free' })
    e.commitFree('A')
    expect(e.isWon).toBe(true)
  })

  it('flow_0002 blocks A on B body then frees after B leaves', () => {
    const e = new PuzzleEngine(getLevel('flow_0002'))
    expect(e.tryWeave('A')).toMatchObject({ kind: 'blocked', blockerId: 'B' })
    expect(e.tryWeave('B').kind).toBe('free')
    e.commitFree('B')
    expect(e.tryWeave('A').kind).toBe('free')
  })

  it('flow_0003 requires C then B then A', () => {
    const e = new PuzzleEngine(getLevel('flow_0003'))
    expect(e.availableArrows()).toEqual(['C'])
    e.commitFree('C')
    expect(e.availableArrows()).toEqual(['B'])
    e.commitFree('B')
    expect(e.availableArrows()).toEqual(['A'])
    e.commitFree('A')
    expect(e.isWon).toBe(true)
  })

  it('flow_0004 has two independent frees', () => {
    const e = new PuzzleEngine(getLevel('flow_0004'))
    expect(e.availableArrows()).toEqual(['A', 'B'])
  })

  it('flow_0005 L weaves free', () => {
    const e = new PuzzleEngine(getLevel('flow_0005'))
    expect(e.tryWeave('L').kind).toBe('free')
    e.commitFree('L')
    expect(e.isWon).toBe(true)
  })

  it('flow_0006 is a packed 6x6', () => {
    const level = getLevel('flow_0006')
    expect(level.width).toBe(6)
    expect(level.height).toBe(6)
    const occupied = level.arrows.reduce((n, a) => n + a.cells.length, 0)
    expect(occupied).toBe(36)
    const e = new PuzzleEngine(level)
    expect(e.availableArrows()).toEqual(['B', 'D', 'F', 'H', 'J', 'L'])
  })

  it('flow_0006 solves by clearing right-hand columns first', () => {
    const e = new PuzzleEngine(getLevel('flow_0006'))
    for (const id of ['B', 'D', 'F', 'H', 'J', 'L', 'A', 'C', 'E', 'G', 'I', 'K']) {
      expect(e.tryWeave(id).kind).toBe('free')
      e.commitFree(id)
    }
    expect(e.isWon).toBe(true)
  })

  it('flow_0007 is a vertical body block', () => {
    const e = new PuzzleEngine(getLevel('flow_0007'))
    expect(e.tryWeave('A')).toMatchObject({ kind: 'blocked', blockerId: 'B' })
    e.commitFree('B')
    expect(e.tryWeave('A').kind).toBe('free')
  })

  it('flow_0008 U weaves straight off the top', () => {
    const e = new PuzzleEngine(getLevel('flow_0008'))
    expect(e.tryWeave('U').kind).toBe('free')
  })

  it('flow_0009 covers all four headings and is immediately free', () => {
    const e = new PuzzleEngine(getLevel('flow_0009'))
    expect(new Set(e.board.arrows.map((a) => a.direction))).toEqual(new Set(['up', 'down', 'left', 'right']))
    expect(e.availableArrows().sort()).toEqual(['E', 'N', 'S', 'W'])
  })

  it('flow_0010 gate blocks three waiters', () => {
    const e = new PuzzleEngine(getLevel('flow_0010'))
    expect(e.availableArrows()).toEqual(['GATE'])
    e.commitFree('GATE')
    expect(e.availableArrows()).toEqual(['A', 'B', 'C'])
  })

  it('flow_0011 long snake is free', () => {
    const e = new PuzzleEngine(getLevel('flow_0011'))
    expect(e.board.arrows[0].cells.length).toBeGreaterThanOrEqual(8)
    expect(e.tryWeave('SNAKE').kind).toBe('free')
  })

  it('flow_0012 both arrows are free in opposite headings', () => {
    const e = new PuzzleEngine(getLevel('flow_0012'))
    expect(e.tryWeave('A').kind).toBe('free')
    expect(e.tryWeave('B').kind).toBe('free')
  })

  it('flow_0015 packed 6x6 clears by availableArrows', () => {
    const e = new PuzzleEngine(getLevel('flow_0015'))
    expect(e.board.width).toBe(6)
    expect(e.board.arrows.length).toBeGreaterThan(1)
    let guard = 0
    while (!e.isWon && guard++ < 40) {
      const next = e.availableArrows()[0]
      expect(next).toBeTruthy()
      e.commitFree(next)
    }
    expect(e.isWon).toBe(true)
  })
})
