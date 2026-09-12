import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PuzzleEngine } from '../../packages/engine/src/engine.ts'
import type { BoardModel, Direction, GridPoint } from '../../packages/engine/src/types.ts'
import { generateLevel } from './generate.ts'
import { generatePackedLevel, isBoardSolvable, isPacked, occupiedCells } from './hamiltonian.ts'
import { CAR_MASK, DONUT_MASK, HEART_MASK, playableCount, SHAPE_MASKS } from './masks.ts'
import { peelBoard } from './peel.ts'
import {
  MAX_I_RATIO,
  iPieceRatio,
  occupancyStats,
  playableCells,
  rigidSweepHitsSelf,
  turnCount,
} from './util.ts'

const here = dirname(fileURLToPath(import.meta.url))

function loadJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(here, rel), 'utf8')) as T
}

function assertPackedPeelable(board: BoardModel, mask?: boolean[][]) {
  expect(board.arrows.every((arrow) => arrow.cells.length >= 2)).toBe(true)
  expect(isPacked(board, mask)).toBe(true)
  expect(peelBoard(board).ok).toBe(true)
  expect(isBoardSolvable(board)).toBe(true)
  const engine = new PuzzleEngine(board)
  expect(engine.board.arrows.length).toBe(board.arrows.length)
}

describe('generateLevel', () => {
  it('fills every cell of a 12×12 full mask', () => {
    const board = generateLevel({ width: 12, height: 12, seed: 1200 })
    expect(occupiedCells(board)).toBe(144)
    expect(playableCells(12, 12).length).toBe(144)
    assertPackedPeelable(board)
    expect(iPieceRatio(board)).toBeLessThan(MAX_I_RATIO)
  })

  it('is deterministic for the same seed', () => {
    const a = generateLevel({ width: 6, height: 6, seed: 1503, levelId: 'gen_6x6' })
    const b = generateLevel({ width: 6, height: 6, seed: 1503, levelId: 'gen_6x6' })
    expect(a).toEqual(b)
  })

  it('keeps I-pieces under 35% on a packed 8×8', () => {
    const board = generateLevel({ width: 8, height: 8, seed: 2210, minTurns: 2 })
    expect(occupiedCells(board)).toBe(64)
    assertPackedPeelable(board)
    expect(iPieceRatio(board)).toBeLessThan(MAX_I_RATIO)
    expect(board.arrows.some((arrow) => turnCount(arrow.cells) >= 2)).toBe(true)
  })

  it('fills only the true cells of a carved mask', () => {
    const mask = [
      [true, true, false],
      [true, true, false],
      [true, true, true],
    ]
    const board = generateLevel({ width: 3, height: 3, mask, seed: 42 })
    expect(occupiedCells(board)).toBe(7)
    assertPackedPeelable(board, mask)
  })

  it('fills heart, donut, and car masks exactly', () => {
    for (const shape of [HEART_MASK, DONUT_MASK, CAR_MASK]) {
      const board = generateLevel({
        width: shape.width,
        height: shape.height,
        mask: shape.cells,
        seed: 9000 + shape.width,
        levelId: `shape_${shape.id}`,
      })
      const playable = playableCount(shape)
      expect(occupiedCells(board)).toBe(playable)
      assertPackedPeelable(board, shape.cells)
      expect(iPieceRatio(board)).toBeLessThan(MAX_I_RATIO)
    }
  })
})

describe('shape mask JSON + fixtures', () => {
  it('ships heart, donut, and car masks', () => {
    expect(Object.keys(SHAPE_MASKS).sort()).toEqual(['car', 'donut', 'heart'])
    for (const id of ['heart', 'donut', 'car'] as const) {
      const file = loadJson<{ id: string; width: number; height: number; cells: boolean[][] }>(`masks/${id}.json`)
      expect(file.id).toBe(id)
      expect(file.cells.length).toBe(file.height)
      expect(file.cells[0].length).toBe(file.width)
      expect(file.cells).toEqual(SHAPE_MASKS[id].cells)
    }
  })

  it('ships packed solvable fills for each shape', () => {
    for (const id of ['heart', 'donut', 'car'] as const) {
      const shape = SHAPE_MASKS[id]
      const board = loadJson<BoardModel>(`fixtures/${id}.json`)
      expect(board.levelId).toContain(id)
      expect(occupiedCells(board)).toBe(playableCount(shape))
      assertPackedPeelable(board, shape.cells)
    }
  })
})

describe('self-block vs peel', () => {
  it('accepts an L that rigid-sweeps through itself but peels free', () => {
    const cells: GridPoint[] = [
      { row: 2, col: 1 },
      { row: 1, col: 1 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
    ]
    const direction: Direction = 'right'
    expect(rigidSweepHitsSelf(cells, direction)).toBe(true)
    const board: BoardModel = {
      width: 5,
      height: 4,
      levelId: 'self_block_L',
      arrows: [
        {
          id: 'L',
          cells,
          direction,
          headCell: cells[cells.length - 1],
          isRed: false,
        },
      ],
    }
    expect(peelBoard(board).ok).toBe(true)
    expect(new PuzzleEngine(board).tryWeave('L').kind).toBe('free')
  })

  it('rejects only peel-stuck boards', () => {
    const stuck: BoardModel = {
      width: 4,
      height: 2,
      levelId: 'stuck',
      arrows: [
        {
          id: 'A',
          cells: [
            { row: 0, col: 0 },
            { row: 0, col: 1 },
          ],
          direction: 'right',
          headCell: { row: 0, col: 1 },
          isRed: false,
        },
        {
          id: 'B',
          cells: [
            { row: 0, col: 3 },
            { row: 0, col: 2 },
          ],
          direction: 'left',
          headCell: { row: 0, col: 2 },
          isRed: false,
        },
      ],
    }
    expect(peelBoard(stuck).ok).toBe(false)
    expect(isBoardSolvable(stuck)).toBe(false)
  })
})

describe('occupancy stats', () => {
  it('reports 100% occupancy on generatePackedLevel 6×6', () => {
    const board = generatePackedLevel(6, 6, 'gen_6x6_packed', 1503, 3)
    const stats = occupancyStats(board)
    expect(stats.occupied).toBe(36)
    expect(stats.playable).toBe(36)
    expect(stats.occupancy).toBe(1)
    expect(stats.iRatio).toBeLessThan(MAX_I_RATIO)
    assertPackedPeelable(board)
  })
})
