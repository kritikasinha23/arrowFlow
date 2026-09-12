import type { ArrowModel, BoardModel, Direction, GridPoint } from './types.ts'

export const DELTA: Record<Direction, GridPoint> = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
}

export const MIN_ARROW_CELLS = 2
export const MAX_UNDO = 20

export function cellKey(p: GridPoint): string {
  return `${p.row},${p.col}`
}

export function sameCell(a: GridPoint, b: GridPoint): boolean {
  return a.row === b.row && a.col === b.col
}

export function inBounds(p: GridPoint, width: number, height: number): boolean {
  return p.row >= 0 && p.row < height && p.col >= 0 && p.col < width
}

export function manhattan(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col)
}

export function headingOf(from: GridPoint, to: GridPoint): Direction | null {
  const dr = to.row - from.row
  const dc = to.col - from.col
  if (dr === -1 && dc === 0) return 'up'
  if (dr === 1 && dc === 0) return 'down'
  if (dr === 0 && dc === -1) return 'left'
  if (dr === 0 && dc === 1) return 'right'
  return null
}

export function clonePoint(p: GridPoint): GridPoint {
  return { row: p.row, col: p.col }
}

export function cloneArrow(arrow: ArrowModel): ArrowModel {
  return {
    id: arrow.id,
    direction: arrow.direction,
    isRed: arrow.isRed,
    headCell: clonePoint(arrow.headCell),
    cells: arrow.cells.map(clonePoint),
  }
}

export function cloneBoard(board: BoardModel): BoardModel {
  return {
    width: board.width,
    height: board.height,
    levelId: board.levelId,
    difficulty: board.difficulty,
    arrows: board.arrows.map(cloneArrow),
  }
}

export function occupancyMap(board: BoardModel): Map<string, string> {
  const occ = new Map<string, string>()
  for (const arrow of board.arrows) {
    for (const cell of arrow.cells) {
      occ.set(cellKey(cell), arrow.id)
    }
  }
  return occ
}

export function exitRay(
  head: GridPoint,
  direction: Direction,
  width: number,
  height: number,
): GridPoint[] {
  const d = DELTA[direction]
  const ray: GridPoint[] = []
  let row = head.row + d.row
  let col = head.col + d.col
  while (row >= 0 && row < height && col >= 0 && col < width) {
    ray.push({ row, col })
    row += d.row
    col += d.col
  }
  return ray
}
