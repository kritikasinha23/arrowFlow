import { DELTA, cellKey, headingOf, inBounds, manhattan } from '../../packages/engine/src/geometry.ts'
import type { BoardModel, Direction, GridPoint } from '../../packages/engine/src/types.ts'

export type CellMask = boolean[][]

export const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right']

export const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

export const MAX_I_RATIO = 0.35

export class SeededRng {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  next(): number {
    this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0
    return this.state / 4294967296
  }

  int(n: number): number {
    if (n <= 0) return 0
    return Math.floor(this.next() * n)
  }

  shuffle<T>(items: T[]): T[] {
    const copy = items.slice()
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.int(i + 1)
      const tmp = copy[i]
      copy[i] = copy[j]
      copy[j] = tmp
    }
    return copy
  }
}

export function keyOf(cell: GridPoint): string {
  return cellKey(cell)
}

export function step(cell: GridPoint, dir: Direction): GridPoint {
  const d = DELTA[dir]
  return { row: cell.row + d.row, col: cell.col + d.col }
}

export function neighbors(cell: GridPoint, width: number, height: number): GridPoint[] {
  const out: GridPoint[] = []
  for (const dir of DIRECTIONS) {
    const next = step(cell, dir)
    if (inBounds(next, width, height)) out.push(next)
  }
  return out
}

export function fullMask(width: number, height: number): CellMask {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => true))
}

export function normalizeMask(width: number, height: number, mask?: CellMask): CellMask {
  if (!mask) return fullMask(width, height)
  if (mask.length !== height) {
    throw new Error(`mask height ${mask.length} does not match board height ${height}`)
  }
  return mask.map((row, r) => {
    if (!row || row.length !== width) {
      throw new Error(`mask row ${r} width ${row?.length ?? 0} does not match board width ${width}`)
    }
    return row.map((cell) => Boolean(cell))
  })
}

export function playableCells(width: number, height: number, mask?: CellMask): GridPoint[] {
  const cells: GridPoint[] = []
  const resolved = normalizeMask(width, height, mask)
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (resolved[row][col]) cells.push({ row, col })
    }
  }
  return cells
}

export function occupiedCells(board: BoardModel): number {
  return board.arrows.reduce((sum, arrow) => sum + arrow.cells.length, 0)
}

export function isPacked(board: BoardModel, mask?: CellMask): boolean {
  const playable = playableCells(board.width, board.height, mask)
  if (playable.length === 0) return false
  const allowed = new Set(playable.map((cell) => keyOf(cell)))
  const seen = new Set<string>()
  for (const arrow of board.arrows) {
    if (arrow.cells.length < 2) return false
    for (let i = 1; i < arrow.cells.length; i++) {
      if (manhattan(arrow.cells[i - 1], arrow.cells[i]) !== 1) return false
    }
    for (const cell of arrow.cells) {
      const key = keyOf(cell)
      if (!allowed.has(key) || seen.has(key)) return false
      seen.add(key)
    }
  }
  return seen.size === allowed.size
}

export function arrowId(index: number): string {
  if (index < 26) return String.fromCharCode(65 + index)
  let n = index
  let out = ''
  while (n >= 0) {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  }
  return out
}

export function piecesToBoard(
  pieces: GridPoint[][],
  width: number,
  height: number,
  levelId: string,
  difficulty = 2,
): BoardModel {
  const arrows = pieces.map((cells, i) => {
    const cloned = cells.map((cell) => ({ ...cell }))
    const head = cloned[cloned.length - 1]
    const prev = cloned[cloned.length - 2]
    return {
      id: arrowId(i),
      cells: cloned,
      direction: headingOf(prev, head) as Direction,
      headCell: { ...head },
      isRed: false,
    }
  })
  return { width, height, levelId, difficulty, arrows }
}

export function turnCount(cells: GridPoint[]): number {
  let turns = 0
  for (let i = 2; i < cells.length; i++) {
    const a = headingOf(cells[i - 2], cells[i - 1])
    const b = headingOf(cells[i - 1], cells[i])
    if (a && b && a !== b) turns += 1
  }
  return turns
}

export function isIPiece(cells: GridPoint[]): boolean {
  return cells.length >= 2 && turnCount(cells) === 0
}

export function iPieceRatio(board: BoardModel): number {
  if (board.arrows.length === 0) return 0
  return board.arrows.filter((arrow) => isIPiece(arrow.cells)).length / board.arrows.length
}

export function avgTurns(board: BoardModel): number {
  if (board.arrows.length === 0) return 0
  return board.arrows.reduce((sum, arrow) => sum + turnCount(arrow.cells), 0) / board.arrows.length
}

export type OccupancyStats = {
  playable: number
  occupied: number
  occupancy: number
  pieces: number
  iPieces: number
  iRatio: number
  avgTurns: number
}

export function occupancyStats(board: BoardModel, mask?: CellMask): OccupancyStats {
  const playable = playableCells(board.width, board.height, mask).length
  const occupied = occupiedCells(board)
  const iPieces = board.arrows.filter((arrow) => isIPiece(arrow.cells)).length
  return {
    playable,
    occupied,
    occupancy: playable === 0 ? 0 : occupied / playable,
    pieces: board.arrows.length,
    iPieces,
    iRatio: board.arrows.length === 0 ? 0 : iPieces / board.arrows.length,
    avgTurns: avgTurns(board),
  }
}

export function defaultMaxIRatio(playable: number): number {
  if (playable < 12) return 1
  if (playable < 20) return 0.5
  return MAX_I_RATIO
}

export function weightedPick<T extends { weight: number }>(items: T[], rng: SeededRng): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let cursor = rng.next() * total
  for (const item of items) {
    cursor -= item.weight
    if (cursor <= 0) return item
  }
  return items[items.length - 1]
}

export function connectedComponents(
  keys: Set<string>,
  lookup: Map<string, GridPoint>,
  width: number,
  height: number,
): GridPoint[][] {
  const unseen = new Set(keys)
  const comps: GridPoint[][] = []
  for (const startKey of keys) {
    if (!unseen.has(startKey)) continue
    const start = lookup.get(startKey)
    if (!start) continue
    unseen.delete(startKey)
    const queue = [start]
    const comp: GridPoint[] = []
    while (queue.length > 0) {
      const cell = queue.pop()!
      comp.push(cell)
      for (const nb of neighbors(cell, width, height)) {
        const key = keyOf(nb)
        if (!unseen.has(key)) continue
        unseen.delete(key)
        queue.push(nb)
      }
    }
    comps.push(comp)
  }
  return comps
}

export function degreeIn(cell: GridPoint, keys: Set<string>, width: number, height: number): number {
  let n = 0
  for (const nb of neighbors(cell, width, height)) {
    if (keys.has(keyOf(nb))) n += 1
  }
  return n
}

export function isPathShape(cells: GridPoint[], width: number, height: number): boolean {
  if (cells.length < 2) return false
  const keys = new Set(cells.map(keyOf))
  if (keys.size !== cells.length) return false
  const comps = connectedComponents(keys, new Map(cells.map((cell) => [keyOf(cell), cell])), width, height)
  if (comps.length !== 1) return false
  let ones = 0
  let twos = 0
  for (const cell of cells) {
    const deg = degreeIn(cell, keys, width, height)
    if (deg === 1) ones += 1
    else if (deg === 2) twos += 1
    else return false
  }
  return ones === 2 && ones + twos === cells.length
}

/**
 * True iff the cells can be covered by disjoint simple 4-paths of length ≥ 2.
 * Exact search for small components; large ones are treated as coverable.
 */
export function canPathCover(
  cells: GridPoint[],
  width: number,
  height: number,
  memo = new Map<string, boolean>(),
  budget = { left: 1200 },
): boolean {
  if (cells.length === 0) return true
  if (cells.length === 1) return false
  const lookup = new Map(cells.map((cell) => [keyOf(cell), cell]))
  const keys = new Set(lookup.keys())
  const comps = connectedComponents(keys, lookup, width, height)
  if (comps.length > 1) {
    return comps.every((comp) => canPathCover(comp, width, height, memo, budget))
  }
  if (isPathShape(cells, width, height)) return true
  if (cells.length === 2) return manhattan(cells[0], cells[1]) === 1
  if (cells.length > 16) return true
  const sig = [...keys].sort().join(';')
  const cached = memo.get(sig)
  if (cached !== undefined) return cached

  const leaves = cells.filter((cell) => degreeIn(cell, keys, width, height) === 1)
  const starts = leaves.length > 0 ? leaves : cells
  let ok = false

  const search = (path: GridPoint[], used: Set<string>): boolean => {
    if (budget.left-- <= 0) return false
    if (path.length >= 2) {
      const rest: GridPoint[] = []
      for (const cell of cells) {
        if (!used.has(keyOf(cell))) rest.push(cell)
      }
      if (canPathCover(rest, width, height, memo, budget)) return true
    }
    const cur = path[path.length - 1]
    for (const nb of neighbors(cur, width, height)) {
      const key = keyOf(nb)
      if (!keys.has(key) || used.has(key)) continue
      used.add(key)
      path.push(nb)
      if (search(path, used)) return true
      path.pop()
      used.delete(key)
    }
    return false
  }

  for (const start of starts) {
    if (search([start], new Set([keyOf(start)]))) {
      ok = true
      break
    }
  }
  memo.set(sig, ok)
  return ok
}

/** Rigid one-step translate overlaps the original footprint. */
export function rigidSweepHitsSelf(cells: GridPoint[], direction: Direction): boolean {
  const d = DELTA[direction]
  const before = new Set(cells.map(keyOf))
  for (const cell of cells) {
    const moved = `${cell.row + d.row},${cell.col + d.col}`
    if (before.has(moved)) return true
  }
  return false
}
