import { describe, expect, it } from 'vitest'
import { PuzzleEngine } from '../../packages/engine/src/index.ts'
import {
  generateHamiltonianLevel,
  generatePackedLevel,
  hamiltonianPath,
  isBoardSolvable,
  isPacked,
  occupiedCells,
  randomHamiltonianPath,
  SeededRng,
} from './hamiltonian.ts'

function assertPackedSolvable(board: ReturnType<typeof generatePackedLevel>) {
  expect(board.arrows.length).toBeGreaterThan(1)
  expect(board.arrows.every((arrow) => arrow.cells.length >= 2)).toBe(true)
  expect(isPacked(board)).toBe(true)
  expect(isBoardSolvable(board)).toBe(true)
  const engine = new PuzzleEngine(board)
  expect(engine.board.arrows.length).toBe(board.arrows.length)
}

describe('hamiltonian generator', () => {
  it('covers every 4x4 cell once', () => {
    const path = hamiltonianPath(4, 4)
    expect(path).toHaveLength(16)
    expect(new Set(path.map((p) => `${p.row},${p.col}`)).size).toBe(16)
  })

  it('covers every 6x6 cell once', () => {
    const path = hamiltonianPath(6, 6)
    expect(path).toHaveLength(36)
    expect(new Set(path.map((p) => `${p.row},${p.col}`)).size).toBe(36)
  })

  it('is 4-connected on 4x4', () => {
    const path = hamiltonianPath(4, 4)
    for (let i = 1; i < path.length; i++) {
      const dist = Math.abs(path[i].row - path[i - 1].row) + Math.abs(path[i].col - path[i - 1].col)
      expect(dist).toBe(1)
    }
  })

  it('builds a valid 4x4 engine board', () => {
    const board = generateHamiltonianLevel(4, 4, 'gen_4x4')
    const engine = new PuzzleEngine(board)
    expect(engine.board.arrows.length).toBeGreaterThan(0)
    expect(engine.isWon).toBe(false)
  })

  it('builds a valid 6x6 engine board', () => {
    const board = generateHamiltonianLevel(6, 6, 'gen_6x6')
    const engine = new PuzzleEngine(board)
    expect(engine.board.width).toBe(6)
    expect(engine.board.arrows.every((a) => a.cells.length >= 2)).toBe(true)
  })

  it('random path is Hamiltonian and 4-connected', () => {
    const rng = new SeededRng(99)
    const path = randomHamiltonianPath(8, 6, rng)
    expect(path).toHaveLength(48)
    expect(new Set(path.map((p) => `${p.row},${p.col}`)).size).toBe(48)
    for (let i = 1; i < path.length; i++) {
      expect(Math.abs(path[i].row - path[i - 1].row) + Math.abs(path[i].col - path[i - 1].col)).toBe(1)
    }
  })

  it('same seed yields the same 6x6 board', () => {
    const a = generatePackedLevel(6, 6, 'gen_6x6', 1503, 3)
    const b = generatePackedLevel(6, 6, 'gen_6x6', 1503, 3)
    expect(a).toEqual(b)
  })

  it('generated 6x6 is packed, min length 2, solvable', () => {
    const board = generatePackedLevel(6, 6, 'gen_6x6_packed', 1503, 3)
    expect(board.width).toBe(6)
    expect(board.height).toBe(6)
    expect(occupiedCells(board)).toBe(36)
    assertPackedSolvable(board)
  })

  it('generated 8x8 is packed, min length 2, solvable', () => {
    const board = generatePackedLevel(8, 8, 'gen_8x8_packed', 2210, 4)
    expect(board.width).toBe(8)
    expect(board.height).toBe(8)
    expect(occupiedCells(board)).toBe(64)
    assertPackedSolvable(board)
  })

  it('covers only playable cells when a mask carves a shape', () => {
    const mask = [
      [true, true, false],
      [true, true, false],
      [true, true, true],
    ]
    const board = generatePackedLevel(3, 3, 'gen_mask', 42, 2, mask)
    expect(isPacked(board, mask)).toBe(true)
    expect(occupiedCells(board)).toBe(7)
    expect(board.arrows.every((arrow) => arrow.cells.length >= 2)).toBe(true)
    expect(isBoardSolvable(board)).toBe(true)
  })
})
