import { exitRay, headingOf } from '../../packages/engine/src/geometry.ts'
import type { BoardModel, Direction, GridPoint } from '../../packages/engine/src/types.ts'
import { generateLevel } from './generate.ts'
import { SeededRng, type CellMask } from './util.ts'

export { generateLevel } from './generate.ts'
export { isBoardSolvable } from './peel.ts'
export { SeededRng, type CellMask } from './util.ts'

export type CatalogSpec = {
  id: string
  width: number
  height: number
  seed: number
  difficulty: number
}

/** 20 packed originals, 5×5 through 10×12. Seeds are frozen for deterministic JSON. */
export const GENERATED_SPECS: CatalogSpec[] = [
  { id: 'flow_0013', width: 5, height: 5, seed: 1301, difficulty: 2 },
  { id: 'flow_0014', width: 5, height: 6, seed: 1402, difficulty: 2 },
  { id: 'flow_0015', width: 6, height: 6, seed: 1503, difficulty: 3 },
  { id: 'flow_0016', width: 6, height: 7, seed: 1604, difficulty: 3 },
  { id: 'flow_0017', width: 6, height: 8, seed: 1705, difficulty: 3 },
  { id: 'flow_0018', width: 7, height: 7, seed: 1806, difficulty: 3 },
  { id: 'flow_0019', width: 7, height: 8, seed: 1907, difficulty: 4 },
  { id: 'flow_0020', width: 7, height: 9, seed: 2008, difficulty: 4 },
  { id: 'flow_0021', width: 7, height: 10, seed: 2109, difficulty: 4 },
  { id: 'flow_0022', width: 8, height: 8, seed: 2210, difficulty: 4 },
  { id: 'flow_0023', width: 8, height: 9, seed: 2311, difficulty: 4 },
  { id: 'flow_0024', width: 8, height: 10, seed: 2412, difficulty: 4 },
  { id: 'flow_0025', width: 8, height: 12, seed: 2513, difficulty: 5 },
  { id: 'flow_0026', width: 9, height: 9, seed: 2614, difficulty: 5 },
  { id: 'flow_0027', width: 9, height: 10, seed: 2715, difficulty: 5 },
  { id: 'flow_0028', width: 9, height: 11, seed: 2816, difficulty: 5 },
  { id: 'flow_0029', width: 10, height: 10, seed: 2917, difficulty: 5 },
  { id: 'flow_0030', width: 10, height: 11, seed: 3018, difficulty: 5 },
  { id: 'flow_0031', width: 10, height: 12, seed: 3119, difficulty: 5 },
  { id: 'flow_0032', width: 10, height: 12, seed: 3220, difficulty: 5 },
]

export const LEAGUE_LEVEL_ID = 'flow_0031'

export function hamiltonianPath(width: number, height: number): GridPoint[] {
  return rowSerpentine(width, height)
}

function rowSerpentine(width: number, height: number): GridPoint[] {
  if (width < 1 || height < 1) throw new Error('grid too small')
  const cells: GridPoint[] = []
  for (let row = 0; row < height; row++) {
    if (row % 2 === 0) {
      for (let col = 0; col < width; col++) cells.push({ row, col })
    } else {
      for (let col = width - 1; col >= 0; col--) cells.push({ row, col })
    }
  }
  return cells
}

function colSerpentine(width: number, height: number): GridPoint[] {
  const cells: GridPoint[] = []
  for (let col = 0; col < width; col++) {
    if (col % 2 === 0) {
      for (let row = 0; row < height; row++) cells.push({ row, col })
    } else {
      for (let row = height - 1; row >= 0; row--) cells.push({ row, col })
    }
  }
  return cells
}

function neighbors(cell: GridPoint, width: number, height: number): GridPoint[] {
  const out: GridPoint[] = []
  if (cell.row > 0) out.push({ row: cell.row - 1, col: cell.col })
  if (cell.row + 1 < height) out.push({ row: cell.row + 1, col: cell.col })
  if (cell.col > 0) out.push({ row: cell.row, col: cell.col - 1 })
  if (cell.col + 1 < width) out.push({ row: cell.row, col: cell.col + 1 })
  return out
}

function keyOf(cell: GridPoint): string {
  return `${cell.row},${cell.col}`
}

/**
 * Backbite: flip a suffix/prefix so the cover stays Hamiltonian but the
 * corridor stops looking like a zipper.
 */
function applyBackbite(path: GridPoint[], width: number, height: number, fromEnd: boolean, rng: SeededRng): GridPoint[] {
  const pts = fromEnd ? path.slice() : path.slice().reverse()
  const n = pts.length
  const end = pts[n - 1]
  const index = new Map(pts.map((cell, i) => [keyOf(cell), i]))
  const candidates: number[] = []
  for (const nb of neighbors(end, width, height)) {
    const i = index.get(keyOf(nb))
    if (i === undefined || i === n - 1 || i === n - 2) continue
    candidates.push(i)
  }
  if (candidates.length === 0) return path
  const k = candidates[rng.int(candidates.length)]
  const next = pts.slice(0, k + 1).concat(pts.slice(k + 1).reverse())
  return fromEnd ? next : next.reverse()
}

export function randomHamiltonianPath(width: number, height: number, rng: SeededRng, mutations?: number): GridPoint[] {
  if (width < 2 || height < 1) throw new Error('grid too small')
  let path = rng.next() < 0.5 ? rowSerpentine(width, height) : colSerpentine(width, height)
  if (rng.next() < 0.5) path = path.slice().reverse()
  const flips = mutations ?? Math.max(24, width * height)
  for (let i = 0; i < flips; i++) {
    path = applyBackbite(path, width, height, rng.next() < 0.55, rng)
  }
  return path
}

export function hamiltonianPathOnMask(width: number, height: number, mask: CellMask, rng: SeededRng): GridPoint[] {
  const cells = playableCells(width, height, mask)
  if (cells.length < 2) throw new Error('mask too small')
  const allowed = new Set(cells.map(keyOf))
  const starts = rng.shuffle(cells.slice())
  for (const start of starts) {
    const path: GridPoint[] = []
    const seen = new Set<string>()
    const walk = (cell: GridPoint): boolean => {
      path.push(cell)
      seen.add(keyOf(cell))
      if (seen.size === allowed.size) return true
      const next = rng.shuffle(
        neighbors(cell, width, height).filter((nb) => allowed.has(keyOf(nb)) && !seen.has(keyOf(nb))),
      )
      for (const nb of next) {
        if (walk(nb)) return true
      }
      path.pop()
      seen.delete(keyOf(cell))
      return false
    }
    if (walk(start)) return path
  }
  throw new Error('no Hamiltonian path on mask')
}

function maxPieceLen(width: number, height: number): number {
  const n = width * height
  if (n <= 25) return 5
  if (n <= 49) return 7
  if (n <= 80) return 9
  return 12
}

function canExitAfterPrefixRemains(piece: GridPoint[], prefix: GridPoint[], width: number, height: number): boolean {
  if (piece.length < 2) return false
  const head = piece[piece.length - 1]
  const prev = piece[piece.length - 2]
  const dir = headingOf(prev, head)
  if (!dir) return false
  const own = new Set(piece.map(keyOf))
  const blockers = new Set(prefix.map(keyOf))
  for (const cell of exitRay(head, dir, width, height)) {
    const key = keyOf(cell)
    if (own.has(key)) continue
    if (blockers.has(key)) return false
  }
  return true
}

/**
 * Cut a Hamiltonian path into polylines (min 2 cells) so reverse-path order
 * is a legal extraction: each piece can exit while earlier pieces remain.
 */
export function cutSolvablePath(
  path: GridPoint[],
  width: number,
  height: number,
  rng: SeededRng,
  minLen = 2,
  maxLen?: number,
): GridPoint[][] {
  const cap = maxLen ?? maxPieceLen(width, height)
  const pieces: GridPoint[][] = []
  let end = path.length

  while (end >= minLen) {
    const remaining = end
    const preferred: number[] = []
    const limit = Math.min(cap, remaining)
    for (let len = minLen; len <= limit; len++) {
      const left = remaining - len
      if (left === 1) continue
      if (left === 0 || left >= minLen) preferred.push(len)
    }
    const weighted: number[] = preferred.slice()
    for (const len of preferred) {
      if (len >= 3 && len <= 7) weighted.push(len, len)
    }
    const tryOrder = rng.shuffle(weighted)
    if (!tryOrder.includes(remaining)) tryOrder.push(remaining)

    let placed: GridPoint[] | null = null
    for (const len of tryOrder) {
      const start = end - len
      const piece = path.slice(start, end)
      const prefix = path.slice(0, start)
      if (canExitAfterPrefixRemains(piece, prefix, width, height)) {
        placed = piece
        end = start
        break
      }
    }
    if (!placed) {
      const piece = path.slice(0, end)
      if (piece.length >= minLen && canExitAfterPrefixRemains(piece, [], width, height)) {
        pieces.unshift(piece)
        end = 0
        break
      }
      break
    }
    pieces.unshift(placed)
  }

  return pieces
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

export function occupiedCells(board: BoardModel): number {
  return board.arrows.reduce((sum, arrow) => sum + arrow.cells.length, 0)
}

export function playableCells(width: number, height: number, mask?: CellMask): GridPoint[] {
  const cells: GridPoint[] = []
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (!mask || mask[row]?.[col]) cells.push({ row, col })
    }
  }
  return cells
}

export function isPacked(board: BoardModel, mask?: CellMask): boolean {
  const playable = playableCells(board.width, board.height, mask)
  if (playable.length === 0) return false
  const allowed = new Set(playable.map((cell) => keyOf(cell)))
  const seen = new Set<string>()
  for (const arrow of board.arrows) {
    if (arrow.cells.length < 2) return false
    for (const cell of arrow.cells) {
      const key = keyOf(cell)
      if (!allowed.has(key) || seen.has(key)) return false
      seen.add(key)
    }
  }
  return seen.size === allowed.size
}

/** Aesthetic cut: mixed 2–max cells, leftover singletons merge into the previous piece. */
export function cutPath(path: GridPoint[], rng: SeededRng, minLen = 2, maxLen = 8): GridPoint[][] {
  const pieces: GridPoint[][] = []
  let index = 0
  while (index < path.length) {
    const remaining = path.length - index
    if (remaining === 1 && pieces.length > 0) {
      pieces[pieces.length - 1].push({ ...path[index] })
      break
    }
    const options: number[] = []
    const limit = Math.min(maxLen, remaining)
    for (let len = minLen; len <= limit; len++) {
      const left = remaining - len
      if (left === 1) continue
      if (left === 0 || left >= minLen) {
        options.push(len)
        if (len >= 3 && len <= 6) options.push(len)
      }
    }
    if (options.length === 0) options.push(remaining)
    const take = options[rng.int(options.length)]
    pieces.push(path.slice(index, index + take).map((cell) => ({ ...cell })))
    index += take
  }
  return pieces
}

export function splitPathToBoard(
  path: GridPoint[],
  width: number,
  height: number,
  levelId: string,
  segment = 3,
): BoardModel {
  const rng = new SeededRng(1)
  const pieces = cutSolvablePath(path, width, height, rng, 2, segment)
  if (pieces.length > 0) return piecesToBoard(pieces, width, height, levelId)
  return piecesToBoard(fixedSegments(path, segment), width, height, levelId)
}

function fixedSegments(path: GridPoint[], segment: number): GridPoint[][] {
  const pieces: GridPoint[][] = []
  let index = 0
  while (index < path.length) {
    const remaining = path.length - index
    if (remaining === 1 && pieces.length > 0) {
      pieces[pieces.length - 1].push(path[index])
      break
    }
    const take = remaining === 2 ? 2 : Math.min(segment, remaining)
    pieces.push(path.slice(index, index + take).map((cell) => ({ ...cell })))
    index += take
  }
  return pieces
}

export function generatePackedLevel(
  width: number,
  height: number,
  levelId: string,
  seed: number,
  difficulty = 2,
  mask?: CellMask,
): BoardModel {
  return generateLevel({ width, height, mask, seed, levelId, difficulty })
}

export function generateHamiltonianLevel(
  width: number,
  height: number,
  levelId: string,
  seed = 1,
  difficulty = 2,
): BoardModel {
  return generatePackedLevel(width, height, levelId, seed, difficulty)
}

export function generateCatalogLevel(spec: CatalogSpec): BoardModel {
  return generatePackedLevel(spec.width, spec.height, spec.id, spec.seed, spec.difficulty)
}
