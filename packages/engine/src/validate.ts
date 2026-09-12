import { headingOf, inBounds, manhattan, MIN_ARROW_CELLS, sameCell } from './geometry.ts'
import type { BoardModel } from './types.ts'

export function validateBoard(board: BoardModel): void {
  if (!Number.isInteger(board.width) || board.width < 1) {
    throw new Error('invalid board width')
  }
  if (!Number.isInteger(board.height) || board.height < 1) {
    throw new Error('invalid board height')
  }
  if (!board.levelId) {
    throw new Error('missing levelId')
  }

  const seenIds = new Set<string>()
  const seenCells = new Set<string>()

  for (const arrow of board.arrows) {
    if (!arrow.id) throw new Error('arrow missing id')
    if (seenIds.has(arrow.id)) throw new Error(`duplicate arrow id ${arrow.id}`)
    seenIds.add(arrow.id)

    if (!Array.isArray(arrow.cells) || arrow.cells.length < MIN_ARROW_CELLS) {
      throw new Error(`arrow ${arrow.id} shorter than ${MIN_ARROW_CELLS} cells`)
    }

    const local = new Set<string>()
    for (let i = 0; i < arrow.cells.length; i++) {
      const cell = arrow.cells[i]
      if (!inBounds(cell, board.width, board.height)) {
        throw new Error(`arrow ${arrow.id} cell out of bounds`)
      }
      const key = `${cell.row},${cell.col}`
      if (local.has(key)) throw new Error(`arrow ${arrow.id} repeats a cell`)
      if (seenCells.has(key)) throw new Error(`overlapping cell at ${key}`)
      local.add(key)
      seenCells.add(key)

      if (i > 0 && manhattan(arrow.cells[i - 1], cell) !== 1) {
        throw new Error(`arrow ${arrow.id} is not 4-connected`)
      }
    }

    const head = arrow.cells[arrow.cells.length - 1]
    if (!sameCell(head, arrow.headCell)) {
      throw new Error(`arrow ${arrow.id} headCell must be the last cell`)
    }

    const prev = arrow.cells[arrow.cells.length - 2]
    const heading = headingOf(prev, head)
    if (heading !== arrow.direction) {
      throw new Error(`arrow ${arrow.id} direction must match last segment`)
    }
  }
}

export function isEngineJSON(data: object): data is {
  board: BoardModel
  initialBoard: BoardModel
  hearts: number
  initialHearts: number
  moves: number
  history: { board: BoardModel; hearts: number; moves: number }[]
} {
  if (data === null || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return (
    typeof d.board === 'object' &&
    d.board !== null &&
    typeof d.initialBoard === 'object' &&
    d.initialBoard !== null &&
    typeof d.hearts === 'number' &&
    typeof d.initialHearts === 'number' &&
    typeof d.moves === 'number' &&
    Array.isArray(d.history)
  )
}
