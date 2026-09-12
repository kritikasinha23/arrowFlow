import { cloneBoard, exitRay, MAX_UNDO, occupancyMap } from './geometry.ts'
import type { BoardModel, EngineJSON, EngineSnapshot, WeaveResult } from './types.ts'
import { isEngineJSON, validateBoard } from './validate.ts'

const DEFAULT_HEARTS = 3

export class PuzzleEngine {
  readonly board: BoardModel
  hearts: number
  moves: number

  private readonly initialBoard: BoardModel
  private readonly initialHearts: number
  private history: EngineSnapshot[] = []

  constructor(board: BoardModel, opts?: { hearts?: number }) {
    validateBoard(board)
    this.board = cloneBoard(board)
    this.initialBoard = cloneBoard(board)
    this.initialHearts = opts?.hearts ?? DEFAULT_HEARTS
    this.hearts = this.initialHearts
    this.moves = 0
  }

  get isOutOfHearts(): boolean {
    return this.hearts <= 0
  }

  get isWon(): boolean {
    return this.board.arrows.length === 0
  }

  tryWeave(id: string): WeaveResult {
    const arrow = this.requireArrow(id)
    const ray = exitRay(arrow.headCell, arrow.direction, this.board.width, this.board.height)
    const occ = occupancyMap(this.board)

    for (let i = 0; i < ray.length; i++) {
      const occupant = occ.get(`${ray[i].row},${ray[i].col}`)
      if (occupant && occupant !== id) {
        return { kind: 'blocked', blockerId: occupant, rayIndex: i, progressStop: i }
      }
    }

    return { kind: 'free', progressStop: ray.length }
  }

  commitFree(id: string): void {
    this.requireArrow(id)
    this.pushSnapshot()
    this.board.arrows = this.board.arrows.filter((arrow) => arrow.id !== id)
    this.moves += 1
  }

  commitBlocked(id: string): void {
    const arrow = this.requireArrow(id)
    this.pushSnapshot()
    if (!arrow.isRed) {
      arrow.isRed = true
      this.hearts -= 1
    }
    this.moves += 1
  }

  undo(): boolean {
    const snap = this.history.pop()
    if (!snap) return false
    this.restoreSnapshot(snap)
    return true
  }

  reset(): void {
    this.restoreSnapshot({
      board: cloneBoard(this.initialBoard),
      hearts: this.initialHearts,
      moves: 0,
    })
    this.history = []
  }

  availableArrows(): string[] {
    return this.board.arrows.filter((arrow) => this.tryWeave(arrow.id).kind === 'free').map((arrow) => arrow.id)
  }

  toJSON(): EngineJSON {
    return {
      board: cloneBoard(this.board),
      initialBoard: cloneBoard(this.initialBoard),
      hearts: this.hearts,
      initialHearts: this.initialHearts,
      moves: this.moves,
      history: this.history.map((snap) => ({
        board: cloneBoard(snap.board),
        hearts: snap.hearts,
        moves: snap.moves,
      })),
    }
  }

  static fromJSON(data: object): PuzzleEngine {
    if (!isEngineJSON(data)) {
      throw new Error('invalid engine json')
    }
    const engine = new PuzzleEngine(data.initialBoard, { hearts: data.initialHearts })
    engine.restoreSnapshot({
      board: cloneBoard(data.board),
      hearts: data.hearts,
      moves: data.moves,
    })
    engine.history = data.history.map((snap) => ({
      board: cloneBoard(snap.board),
      hearts: snap.hearts,
      moves: snap.moves,
    }))
    if (engine.history.length > MAX_UNDO) {
      engine.history = engine.history.slice(-MAX_UNDO)
    }
    return engine
  }

  private requireArrow(id: string) {
    const arrow = this.board.arrows.find((item) => item.id === id)
    if (!arrow) throw new Error(`unknown arrow ${id}`)
    return arrow
  }

  private pushSnapshot(): void {
    this.history.push({
      board: cloneBoard(this.board),
      hearts: this.hearts,
      moves: this.moves,
    })
    if (this.history.length > MAX_UNDO) {
      this.history.shift()
    }
  }

  private restoreSnapshot(snap: EngineSnapshot): void {
    this.board.width = snap.board.width
    this.board.height = snap.board.height
    this.board.levelId = snap.board.levelId
    this.board.difficulty = snap.board.difficulty
    this.board.arrows = cloneBoard(snap.board).arrows
    this.hearts = snap.hearts
    this.moves = snap.moves
  }
}
