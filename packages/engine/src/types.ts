export type GridPoint = { row: number; col: number }

export type Direction = 'up' | 'down' | 'left' | 'right'

export type ArrowModel = {
  id: string
  cells: GridPoint[]
  direction: Direction
  headCell: GridPoint
  isRed: boolean
}

export type BoardModel = {
  width: number
  height: number
  arrows: ArrowModel[]
  levelId: string
  difficulty?: number
}

export type WeaveResult =
  | { kind: 'free'; progressStop: number }
  | { kind: 'blocked'; blockerId: string; rayIndex: number; progressStop: number }

export type EngineSnapshot = {
  board: BoardModel
  hearts: number
  moves: number
}

export type EngineJSON = {
  board: BoardModel
  initialBoard: BoardModel
  hearts: number
  initialHearts: number
  moves: number
  history: EngineSnapshot[]
}

export type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
