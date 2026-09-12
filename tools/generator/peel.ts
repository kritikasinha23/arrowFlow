import { PuzzleEngine } from '../../packages/engine/src/engine.ts'
import { DELTA, exitRay } from '../../packages/engine/src/geometry.ts'
import type { BoardModel, Direction, GridPoint } from '../../packages/engine/src/types.ts'
import { keyOf } from './util.ts'

export type PeelResult = {
  ok: boolean
  order: string[]
}

/**
 * Peel using each piece's real heading only.
 * A piece may leave when its exit ray (engine ray to the bounding box,
 * skipping its own cells) contains no other piece.
 */
export function peelBoard(board: BoardModel): PeelResult {
  const engine = new PuzzleEngine(board)
  const order: string[] = []
  let guard = 0
  const limit = Math.max(8, board.arrows.length * 3)
  while (engine.board.arrows.length > 0 && guard++ < limit) {
    const next = engine.availableArrows()[0]
    if (!next) return { ok: false, order }
    engine.commitFree(next)
    order.push(next)
  }
  return { ok: engine.board.arrows.length === 0, order }
}

export function isBoardSolvable(board: BoardModel, nodeLimit = 12_000): boolean {
  if (peelBoard(board).ok) return true

  const shell = { ...board }
  const availableOf = (arrows: BoardModel['arrows']) =>
    new PuzzleEngine({ ...shell, arrows }).availableArrows()

  let nodes = 0
  const seen = new Set<string>()
  const search = (arrows: BoardModel['arrows']): boolean => {
    if (arrows.length === 0) return true
    if (++nodes > nodeLimit) return false
    const sig = arrows.map((arrow) => arrow.id).sort().join(',')
    if (seen.has(sig)) return false
    seen.add(sig)
    const available = availableOf(arrows)
    if (available.length === 0) return false
    for (const id of available) {
      if (search(arrows.filter((arrow) => arrow.id !== id))) return true
    }
    return false
  }
  return search(board.arrows)
}

/** Debug only: would this piece be free if it could face any of the 4 dirs? */
export function debugFreeDirections(
  head: GridPoint,
  ownKeys: Set<string>,
  occupied: Map<string, string>,
  width: number,
  height: number,
  selfId: string,
): Direction[] {
  const dirs: Direction[] = ['up', 'down', 'left', 'right']
  return dirs.filter((dir) => {
    for (const cell of exitRay(head, dir, width, height)) {
      const occupant = occupied.get(keyOf(cell))
      if (!occupant || ownKeys.has(keyOf(cell))) continue
      if (occupant !== selfId) return false
    }
    return true
  })
}

export function rayHitsOther(
  head: GridPoint,
  dir: Direction,
  width: number,
  height: number,
  blocked: Set<string>,
  ignore: Set<string>,
): boolean {
  for (const cell of exitRay(head, dir, width, height)) {
    const key = keyOf(cell)
    if (ignore.has(key)) continue
    if (blocked.has(key)) return true
  }
  return false
}

export function exitDelta(dir: Direction): GridPoint {
  return DELTA[dir]
}
