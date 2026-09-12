import { exitRay, headingOf } from '../../packages/engine/src/geometry.ts'
import type { BoardModel, Direction, GridPoint } from '../../packages/engine/src/types.ts'
import { isBoardSolvable } from './peel.ts'
import {
  OPPOSITE,
  SeededRng,
  avgTurns,
  canPathCover,
  connectedComponents,
  defaultMaxIRatio,
  degreeIn,
  iPieceRatio,
  isPacked,
  keyOf,
  neighbors,
  normalizeMask,
  playableCells,
  piecesToBoard,
  step,
  turnCount,
  weightedPick,
  type CellMask,
} from './util.ts'

export type GenerateLevelInput = {
  width: number
  height: number
  mask?: CellMask
  seed: number
  minTurns?: number
  levelId?: string
  difficulty?: number
  maxIRatio?: number
  attempts?: number
}

export type ExitCandidate = {
  cell: GridPoint
  dir: Direction
  rimDegree: number
}

function maxPieceLen(playable: number): number {
  if (playable <= 16) return 6
  if (playable <= 36) return 8
  if (playable <= 64) return 10
  if (playable <= 100) return 12
  return 14
}

function pickTargetLen(remaining: number, playable: number, rng: SeededRng): number {
  const cap = Math.min(maxPieceLen(playable), remaining)
  const options: number[] = []
  for (let len = 2; len <= cap; len++) {
    const left = remaining - len
    if (left === 1) continue
    options.push(len)
    if (len >= 5 && len <= 10) options.push(len, len, len)
    if (len >= 7 && len <= 12) options.push(len)
  }
  if (options.length === 0) return remaining >= 2 ? remaining : 0
  return options[rng.int(options.length)]
}

function rayClearOf(
  head: GridPoint,
  dir: Direction,
  width: number,
  height: number,
  blocked: Set<string>,
  ignore: Set<string> = new Set(),
): boolean {
  for (const cell of exitRay(head, dir, width, height)) {
    const key = keyOf(cell)
    if (ignore.has(key)) continue
    if (blocked.has(key)) return false
  }
  return true
}

function findExits(
  remaining: Set<string>,
  lookup: Map<string, GridPoint>,
  width: number,
  height: number,
  rng: SeededRng,
): ExitCandidate[] {
  const out: ExitCandidate[] = []
  for (const key of remaining) {
    const cell = lookup.get(key)
    if (!cell) continue
    for (const dir of ['up', 'down', 'left', 'right'] as Direction[]) {
      const back = step(cell, OPPOSITE[dir])
      if (!remaining.has(keyOf(back))) continue
      if (!rayClearOf(cell, dir, width, height, remaining)) continue
      out.push({ cell, dir, rimDegree: degreeIn(cell, remaining, width, height) })
    }
  }
  rng.shuffle(out)
  out.sort((a, b) => a.rimDegree - b.rimDegree)
  return out
}

function leftoverAfter(
  remaining: Set<string>,
  used: Set<string>,
  lookup: Map<string, GridPoint>,
  width: number,
  height: number,
  tail: GridPoint,
  finished: boolean,
): boolean {
  const left = new Set<string>()
  for (const key of remaining) {
    if (!used.has(key)) left.add(key)
  }
  if (left.size === 0) return true
  const comps = connectedComponents(left, lookup, width, height)
  for (const comp of comps) {
    if (comp.length === 1) {
      const cell = comp[0]
      const touchesTail = Math.abs(cell.row - tail.row) + Math.abs(cell.col - tail.col) === 1
      if (touchesTail) continue
      return false
    }
    if (canPathCover(comp, width, height)) continue
    if (!finished) {
      const touchesTail = comp.some((cell) => Math.abs(cell.row - tail.row) + Math.abs(cell.col - tail.col) === 1)
      if (touchesTail) continue
    }
    return false
  }
  return true
}

function absorbSingletons(
  walk: GridPoint[],
  used: Set<string>,
  remaining: Set<string>,
  lookup: Map<string, GridPoint>,
  width: number,
  height: number,
): void {
  let changed = true
  while (changed) {
    changed = false
    const tail = walk[walk.length - 1]
    const left = new Set<string>()
    for (const key of remaining) {
      if (!used.has(key)) left.add(key)
    }
    const comps = connectedComponents(left, lookup, width, height)
    for (const comp of comps) {
      if (comp.length !== 1) continue
      const cell = comp[0]
      if (Math.abs(cell.row - tail.row) + Math.abs(cell.col - tail.col) !== 1) continue
      walk.push(cell)
      used.add(keyOf(cell))
      changed = true
      break
    }
  }
}

function mergeOrphanIntoPieces(cell: GridPoint, pieces: GridPoint[][]): boolean {
  for (const piece of pieces) {
    const tail = piece[0]
    if (Math.abs(cell.row - tail.row) + Math.abs(cell.col - tail.col) === 1) {
      piece.unshift({ ...cell })
      return true
    }
  }
  return false
}

function growFromExit(
  exit: ExitCandidate,
  remaining: Set<string>,
  lookup: Map<string, GridPoint>,
  width: number,
  height: number,
  rng: SeededRng,
  targetLen: number,
  minTurns: number,
): GridPoint[] | null {
  const walk: GridPoint[] = [exit.cell]
  const used = new Set<string>([keyOf(exit.cell)])
  let lastDir: Direction = OPPOSITE[exit.dir]
  const first = step(exit.cell, lastDir)
  if (!remaining.has(keyOf(first))) return null
  walk.push(first)
  used.add(keyOf(first))
  if (!leftoverAfter(remaining, used, lookup, width, height, first, false)) return null

  let turns = 0
  while (walk.length < targetLen) {
    const cur = walk[walk.length - 1]
    const scored: { nb: GridPoint; dir: Direction; weight: number; isTurn: boolean }[] = []
    for (const nb of neighbors(cur, width, height)) {
      const key = keyOf(nb)
      if (!remaining.has(key) || used.has(key)) continue
      const dir = headingOf(cur, nb)
      if (!dir) continue
      const nextUsed = new Set(used)
      nextUsed.add(key)
      if (!leftoverAfter(remaining, nextUsed, lookup, width, height, nb, false)) continue
      const isTurn = dir !== lastDir
      let weight = isTurn ? 9 : 1
      if (turns < Math.max(2, minTurns) && isTurn) weight += 8
      if (turns < 6 && isTurn) weight += 4
      if (turns >= 6 && !isTurn) weight += 2
      scored.push({ nb, dir, weight, isTurn })
    }
    if (scored.length === 0) break
    const pick = weightedPick(scored, rng)
    if (pick.isTurn) turns += 1
    walk.push(pick.nb)
    used.add(keyOf(pick.nb))
    lastDir = pick.dir
  }

  absorbSingletons(walk, used, remaining, lookup, width, height)
  if (walk.length < 2) return null
  if (!leftoverAfter(remaining, used, lookup, width, height, walk[walk.length - 1], true)) return null
  return walk
}

function tryWholeComponent(
  remaining: Set<string>,
  lookup: Map<string, GridPoint>,
  width: number,
  height: number,
  rng: SeededRng,
): GridPoint[] | null {
  if (remaining.size < 2 || remaining.size > 18) return null
  const cells = [...remaining].map((key) => lookup.get(key)!).filter(Boolean)
  const comps = connectedComponents(remaining, lookup, width, height)
  if (comps.length !== 1) return null
  const path = hamiltonianOnCells(cells, width, height, rng)
  if (!path || path.length !== remaining.size) return null
  for (const oriented of [path, path.slice().reverse()]) {
    if (oriented.length < 2) continue
    const head = oriented[oriented.length - 1]
    const prev = oriented[oriented.length - 2]
    const dir = headingOf(prev, head)
    if (!dir) continue
    if (rayClearOf(head, dir, width, height, remaining, new Set(oriented.map(keyOf)))) {
      return oriented
    }
  }
  return null
}

function hamiltonianOnCells(
  cells: GridPoint[],
  width: number,
  height: number,
  rng: SeededRng,
): GridPoint[] | null {
  const allowed = new Set(cells.map(keyOf))
  const starts = rng.shuffle(cells.slice())
  const path: GridPoint[] = []
  const seen = new Set<string>()
  let nodes = 0
  const walk = (cell: GridPoint): boolean => {
    if (++nodes > 8000) return false
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
  for (const start of starts) {
    path.length = 0
    seen.clear()
    nodes = 0
    if (walk(start)) return path.slice()
  }
  return null
}

function carvePieces(
  width: number,
  height: number,
  mask: CellMask,
  rng: SeededRng,
  minTurns: number,
): GridPoint[][] | null {
  const playable = playableCells(width, height, mask)
  if (playable.length < 2) return null
  const lookup = new Map(playable.map((cell) => [keyOf(cell), cell]))
  const remaining = new Set(lookup.keys())

  const startComps = connectedComponents(remaining, lookup, width, height)
  for (const comp of startComps) {
    if (comp.length < 2) return null
  }

  const pieces: GridPoint[][] = []
  let guard = 0
  while (remaining.size > 0 && guard++ < playable.length + 8) {
    if (remaining.size === 1) {
      const cell = lookup.get([...remaining][0])
      if (cell && mergeOrphanIntoPieces(cell, pieces)) {
        remaining.clear()
        break
      }
      return null
    }

    const whole = tryWholeComponent(remaining, lookup, width, height, rng)
    if (whole && (remaining.size <= 10 || turnCount(whole) >= minTurns || remaining.size <= 4)) {
      for (const cell of whole) remaining.delete(keyOf(cell))
      pieces.push(whole.map((cell) => ({ ...cell })))
      continue
    }

    const target = pickTargetLen(remaining.size, playable.length, rng)
    const exits = findExits(remaining, lookup, width, height, rng)
    if (exits.length === 0) return null

    let placed: GridPoint[] | null = null
    const tryCount = Math.min(exits.length, 16)
    for (let i = 0; i < tryCount; i++) {
      const walk = growFromExit(exits[i], remaining, lookup, width, height, rng, target, minTurns)
      if (!walk) continue
      const piece = walk.slice().reverse().map((cell) => ({ ...cell }))
      const used = new Set(piece.map(keyOf))
      if (!leftoverAfter(remaining, used, lookup, width, height, piece[0], true)) continue
      placed = piece
      break
    }

    if (!placed) {
      for (const exit of exits) {
        const prev = step(exit.cell, OPPOSITE[exit.dir])
        if (!remaining.has(keyOf(prev))) continue
        const piece = [{ ...prev }, { ...exit.cell }]
        const used = new Set(piece.map(keyOf))
        if (!leftoverAfter(remaining, used, lookup, width, height, piece[0], true)) continue
        placed = piece
        break
      }
    }

    if (!placed) return null
    for (const cell of placed) remaining.delete(keyOf(cell))
    pieces.push(placed)
  }

  if (remaining.size > 0) return null
  if (pieces.some((piece) => piece.length < 2)) return null
  return pieces
}

function boardLooksWiggly(board: BoardModel, maxI: number, minTurns: number, playable: number): boolean {
  if (iPieceRatio(board) >= maxI) return false
  if (playable >= 25 && avgTurns(board) < Math.min(1.15, 0.55 + minTurns * 0.25)) return false
  return true
}

/**
 * Reverse-insert a packed, peel-solvable fill of the mask.
 * See `ALGO.md` for the step-by-step.
 */
export function generateLevel(input: GenerateLevelInput): BoardModel {
  const { width, height, seed } = input
  if (width < 1 || height < 1) throw new Error('grid too small')
  const mask = normalizeMask(width, height, input.mask)
  const playable = playableCells(width, height, mask)
  if (playable.length < 2) throw new Error('mask too small')

  const minTurns = input.minTurns ?? (playable.length >= 25 ? 2 : 1)
  const maxI = input.maxIRatio ?? defaultMaxIRatio(playable.length)
  const attempts = input.attempts ?? (playable.length >= 80 ? 80 : 56)
  const levelId = input.levelId ?? `gen_${width}x${height}`
  const difficulty = input.difficulty ?? 2

  let best: BoardModel | null = null
  let bestScore = Number.NEGATIVE_INFINITY

  for (let attempt = 0; attempt < attempts; attempt++) {
    const rng = new SeededRng((seed + attempt * 10007) >>> 0)
    const pieces = carvePieces(width, height, mask, rng, minTurns)
    if (!pieces) continue
    const board = piecesToBoard(pieces, width, height, levelId, difficulty)
    if (!isPacked(board, mask)) continue
    if (!isBoardSolvable(board)) continue
    const wiggly = boardLooksWiggly(board, maxI, minTurns, playable.length)
    const score = avgTurns(board) * 3 - iPieceRatio(board) * 8 + (wiggly ? 2 : 0)
    if (score > bestScore) {
      best = board
      bestScore = score
    }
    if (wiggly && avgTurns(board) >= 1.6) return board
  }

  if (best && isPacked(best, mask) && isBoardSolvable(best)) {
    if (playable.length >= 20 && iPieceRatio(best) >= maxI) {
      throw new Error(`unable to generate a wiggly packed board for ${levelId}`)
    }
    return best
  }
  throw new Error(`unable to generate a fully packed board for ${levelId}`)
}
