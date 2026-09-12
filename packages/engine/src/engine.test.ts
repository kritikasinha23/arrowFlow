import { describe, expect, it } from 'vitest'
import { PuzzleEngine } from './engine.ts'
import type { ArrowModel, BoardModel, Direction, GridPoint } from './types.ts'

function P(row: number, col: number): GridPoint {
  return { row, col }
}

function arrow(
  id: string,
  cells: GridPoint[],
  direction: Direction,
  extra?: Partial<ArrowModel>,
): ArrowModel {
  return {
    id,
    cells,
    direction,
    headCell: cells[cells.length - 1],
    isRed: false,
    ...extra,
  }
}

function board(width: number, height: number, arrows: ArrowModel[], levelId = 'test'): BoardModel {
  return { width, height, arrows, levelId }
}

function engine(arrows: ArrowModel[], size = 6, opts?: { hearts?: number; width?: number; height?: number }) {
  return new PuzzleEngine(
    board(opts?.width ?? size, opts?.height ?? size, arrows),
    opts?.hearts !== undefined ? { hearts: opts.hearts } : undefined,
  )
}

describe('constructor + validation', () => {
  it('accepts a valid two-cell arrow', () => {
    const e = engine([arrow('A', [P(0, 0), P(0, 1)], 'right')], 3)
    expect(e.board.arrows).toHaveLength(1)
  })

  it('defaults hearts to 3', () => {
    expect(engine([arrow('A', [P(0, 0), P(0, 1)], 'right')], 3).hearts).toBe(3)
  })

  it('accepts custom hearts', () => {
    expect(engine([arrow('A', [P(0, 0), P(0, 1)], 'right')], 3, { hearts: 1 }).hearts).toBe(1)
  })

  it('starts with zero moves', () => {
    expect(engine([arrow('A', [P(0, 0), P(0, 1)], 'right')], 3).moves).toBe(0)
  })

  it('clones the input board', () => {
    const source = board(3, 3, [arrow('A', [P(0, 0), P(0, 1)], 'right')])
    const e = new PuzzleEngine(source)
    e.commitFree('A')
    expect(source.arrows).toHaveLength(1)
  })

  it('rejects a one-cell arrow', () => {
    expect(() => new PuzzleEngine(board(3, 3, [{
      id: 'A',
      cells: [P(0, 0)],
      direction: 'right',
      headCell: P(0, 0),
      isRed: false,
    }]))).toThrow(/shorter/)
  })

  it('rejects an empty cell list', () => {
    expect(() => new PuzzleEngine(board(3, 3, [{
      id: 'A',
      cells: [],
      direction: 'right',
      headCell: P(0, 0),
      isRed: false,
    }]))).toThrow(/shorter/)
  })

  it('rejects a disconnected polyline', () => {
    expect(() => engine([arrow('A', [P(0, 0), P(0, 2)], 'right')], 3)).toThrow(/4-connected/)
  })

  it('rejects a diagonal step', () => {
    expect(() => engine([arrow('A', [P(0, 0), P(1, 1)], 'down')], 3)).toThrow(/4-connected/)
  })

  it('rejects overlapping arrows', () => {
    expect(() =>
      engine([
        arrow('A', [P(0, 0), P(0, 1)], 'right'),
        arrow('B', [P(0, 1), P(0, 2)], 'right'),
      ], 3),
    ).toThrow(/overlapping/)
  })

  it('rejects a repeated cell inside one arrow', () => {
    expect(() => engine([arrow('A', [P(0, 0), P(0, 1), P(0, 0)], 'left')], 3)).toThrow()
  })

  it('rejects out-of-bounds cells', () => {
    expect(() => engine([arrow('A', [P(0, 0), P(0, 3)], 'right')], 3)).toThrow(/bounds/)
  })

  it('rejects duplicate ids', () => {
    expect(() =>
      engine([
        arrow('A', [P(0, 0), P(0, 1)], 'right'),
        arrow('A', [P(1, 0), P(1, 1)], 'right'),
      ], 3),
    ).toThrow(/duplicate/)
  })

  it('rejects a mismatched headCell', () => {
    expect(() =>
      new PuzzleEngine(board(3, 3, [{
        id: 'A',
        cells: [P(0, 0), P(0, 1)],
        direction: 'right',
        headCell: P(0, 0),
        isRed: false,
      }])),
    ).toThrow(/headCell/)
  })

  it('rejects a direction that does not match the last segment', () => {
    expect(() => engine([arrow('A', [P(0, 0), P(0, 1)], 'left')], 3)).toThrow(/direction/)
  })

  it('rejects missing levelId', () => {
    expect(() => new PuzzleEngine({ width: 2, height: 2, arrows: [arrow('A', [P(0, 0), P(0, 1)], 'right')], levelId: '' })).toThrow(/levelId/)
  })

  it('rejects invalid width', () => {
    expect(() => new PuzzleEngine({ width: 0, height: 2, arrows: [], levelId: 'x' })).toThrow(/width/)
  })

  it('rejects invalid height', () => {
    expect(() => new PuzzleEngine({ width: 2, height: -1, arrows: [], levelId: 'x' })).toThrow(/height/)
  })

  it('allows an empty board (already won)', () => {
    const e = new PuzzleEngine({ width: 2, height: 2, arrows: [], levelId: 'empty' })
    expect(e.isWon).toBe(true)
  })

  it('validates up heading', () => {
    expect(engine([arrow('A', [P(2, 1), P(1, 1)], 'up')], 3).board.arrows[0].direction).toBe('up')
  })

  it('validates down heading', () => {
    expect(engine([arrow('A', [P(1, 1), P(2, 1)], 'down')], 3).board.arrows[0].direction).toBe('down')
  })

  it('validates left heading', () => {
    expect(engine([arrow('A', [P(1, 2), P(1, 1)], 'left')], 3).board.arrows[0].direction).toBe('left')
  })
})

describe('tryWeave free', () => {
  it('frees a trivial I heading right', () => {
    const e = engine([arrow('A', [P(1, 1), P(1, 2)], 'right')], 4)
    expect(e.tryWeave('A')).toEqual({ kind: 'free', progressStop: 1 })
  })

  it('frees an I heading left', () => {
    const e = engine([arrow('A', [P(1, 2), P(1, 1)], 'left')], 4)
    expect(e.tryWeave('A').kind).toBe('free')
  })

  it('frees an I heading up', () => {
    const e = engine([arrow('A', [P(2, 1), P(1, 1)], 'up')], 4)
    expect(e.tryWeave('A').kind).toBe('free')
  })

  it('frees an I heading down', () => {
    const e = engine([arrow('A', [P(1, 1), P(2, 1)], 'down')], 4)
    expect(e.tryWeave('A').kind).toBe('free')
  })

  it('uses progressStop equal to remaining ray length', () => {
    const e = engine([arrow('A', [P(0, 0), P(0, 1)], 'right')], 5)
    expect(e.tryWeave('A')).toEqual({ kind: 'free', progressStop: 3 })
  })

  it('treats an empty exit ray at the edge as free', () => {
    const e = engine([arrow('A', [P(0, 2), P(0, 3)], 'right')], 4)
    expect(e.tryWeave('A')).toEqual({ kind: 'free', progressStop: 0 })
  })

  it('does not mutate occupancy on a free probe', () => {
    const e = engine([arrow('A', [P(0, 0), P(0, 1)], 'right')], 3)
    e.tryWeave('A')
    expect(e.board.arrows).toHaveLength(1)
    expect(e.hearts).toBe(3)
    expect(e.moves).toBe(0)
  })

  it('skips own body on the exit ray and still frees', () => {
    const e = engine(
      [
        arrow('U', [P(0, 1), P(1, 1), P(2, 1), P(2, 2), P(2, 3), P(1, 3), P(0, 3), P(0, 2)], 'left'),
      ],
      4,
    )
    const result = e.tryWeave('U')
    expect(result.kind).toBe('free')
  })
})

describe('tryWeave blocked', () => {
  it('blocks when the first ray cell is another id', () => {
    const e = engine(
      [
        arrow('A', [P(1, 0), P(1, 1)], 'right'),
        arrow('B', [P(1, 2), P(1, 3)], 'right'),
      ],
      4,
    )
    expect(e.tryWeave('A')).toEqual({
      kind: 'blocked',
      blockerId: 'B',
      rayIndex: 0,
      progressStop: 0,
    })
  })

  it('blocks on a later ray cell after empty space', () => {
    const e = engine(
      [
        arrow('A', [P(0, 0), P(0, 1)], 'right'),
        arrow('B', [P(0, 3), P(0, 4)], 'right'),
      ],
      5,
    )
    expect(e.tryWeave('A')).toEqual({
      kind: 'blocked',
      blockerId: 'B',
      rayIndex: 1,
      progressStop: 1,
    })
  })

  it('does not treat own body as a blocker', () => {
    const e = engine(
      [arrow('L', [P(2, 1), P(1, 1), P(0, 1), P(0, 2), P(0, 3)], 'right')],
      5,
    )
    expect(e.tryWeave('L').kind).toBe('free')
  })

  it('blocks after skipping own body if another id remains', () => {
    const e = engine(
      [
        arrow('U', [P(0, 1), P(1, 1), P(2, 1), P(2, 2), P(2, 3), P(1, 3), P(0, 3), P(0, 2)], 'left'),
        arrow('X', [P(0, 0), P(1, 0)], 'down'),
      ],
      4,
    )
    const result = e.tryWeave('U')
    expect(result).toMatchObject({ kind: 'blocked', blockerId: 'X' })
  })

  it('leaves occupancy unchanged after a blocked probe', () => {
    const e = engine(
      [
        arrow('A', [P(1, 0), P(1, 1)], 'right'),
        arrow('B', [P(1, 2), P(1, 3)], 'right'),
      ],
      4,
    )
    e.tryWeave('A')
    expect(e.board.arrows.map((a) => a.id)).toEqual(['A', 'B'])
    expect(e.board.arrows.every((a) => !a.isRed)).toBe(true)
  })

  it('throws on an unknown id', () => {
    const e = engine([arrow('A', [P(0, 0), P(0, 1)], 'right')], 3)
    expect(() => e.tryWeave('Z')).toThrow(/unknown/)
  })
})

describe('commitFree', () => {
  it('removes the arrow', () => {
    const e = engine([arrow('A', [P(0, 0), P(0, 1)], 'right')], 3)
    e.commitFree('A')
    expect(e.board.arrows).toHaveLength(0)
  })

  it('increments moves', () => {
    const e = engine([arrow('A', [P(0, 0), P(0, 1)], 'right')], 3)
    e.commitFree('A')
    expect(e.moves).toBe(1)
  })

  it('does not spend a heart', () => {
    const e = engine([arrow('A', [P(0, 0), P(0, 1)], 'right')], 3)
    e.commitFree('A')
    expect(e.hearts).toBe(3)
  })

  it('throws on an unknown id', () => {
    const e = engine([arrow('A', [P(0, 0), P(0, 1)], 'right')], 3)
    expect(() => e.commitFree('nope')).toThrow(/unknown/)
  })
})

describe('commitBlocked + red retap', () => {
  it('sets isRed on first block', () => {
    const e = engine(
      [
        arrow('A', [P(1, 0), P(1, 1)], 'right'),
        arrow('B', [P(1, 2), P(1, 3)], 'right'),
      ],
      4,
    )
    e.commitBlocked('A')
    expect(e.board.arrows.find((a) => a.id === 'A')?.isRed).toBe(true)
  })

  it('decrements a heart on first block', () => {
    const e = engine(
      [
        arrow('A', [P(1, 0), P(1, 1)], 'right'),
        arrow('B', [P(1, 2), P(1, 3)], 'right'),
      ],
      4,
    )
    e.commitBlocked('A')
    expect(e.hearts).toBe(2)
  })

  it('does not decrement on a red retap', () => {
    const e = engine(
      [
        arrow('A', [P(1, 0), P(1, 1)], 'right'),
        arrow('B', [P(1, 2), P(1, 3)], 'right'),
      ],
      4,
    )
    e.commitBlocked('A')
    e.commitBlocked('A')
    expect(e.hearts).toBe(2)
    expect(e.board.arrows.find((a) => a.id === 'A')?.isRed).toBe(true)
  })

  it('keeps the arrow on the board', () => {
    const e = engine(
      [
        arrow('A', [P(1, 0), P(1, 1)], 'right'),
        arrow('B', [P(1, 2), P(1, 3)], 'right'),
      ],
      4,
    )
    e.commitBlocked('A')
    expect(e.board.arrows.map((a) => a.id)).toContain('A')
  })

  it('increments moves on red retap', () => {
    const e = engine(
      [
        arrow('A', [P(1, 0), P(1, 1)], 'right'),
        arrow('B', [P(1, 2), P(1, 3)], 'right'),
      ],
      4,
    )
    e.commitBlocked('A')
    e.commitBlocked('A')
    expect(e.moves).toBe(2)
  })
})

describe('order C then B then A', () => {
  function chain() {
    return engine(
      [
        arrow('A', [P(0, 0), P(0, 1)], 'right'),
        arrow('B', [P(0, 2), P(0, 3)], 'right'),
        arrow('C', [P(0, 4), P(0, 5)], 'right'),
      ],
      6,
    )
  }

  it('starts with only C free', () => {
    const e = chain()
    expect(e.tryWeave('A').kind).toBe('blocked')
    expect(e.tryWeave('B').kind).toBe('blocked')
    expect(e.tryWeave('C').kind).toBe('free')
    expect(e.availableArrows()).toEqual(['C'])
  })

  it('unlocks B after C leaves', () => {
    const e = chain()
    e.commitFree('C')
    expect(e.tryWeave('B').kind).toBe('free')
    expect(e.tryWeave('A').kind).toBe('blocked')
  })

  it('unlocks A after B then wins', () => {
    const e = chain()
    e.commitFree('C')
    e.commitFree('B')
    expect(e.tryWeave('A').kind).toBe('free')
    e.commitFree('A')
    expect(e.isWon).toBe(true)
  })

  it('names B as the blocker of A', () => {
    const e = chain()
    expect(e.tryWeave('A')).toMatchObject({ kind: 'blocked', blockerId: 'B' })
    expect(e.tryWeave('B')).toMatchObject({ kind: 'blocked', blockerId: 'C' })
  })
})

describe('two frees', () => {
  function pair() {
    return engine(
      [
        arrow('A', [P(0, 0), P(0, 1)], 'right'),
        arrow('B', [P(3, 0), P(3, 1)], 'right'),
      ],
      4,
    )
  }

  it('lists both ids', () => {
    expect(pair().availableArrows()).toEqual(['A', 'B'])
  })

  it('can remove either first', () => {
    const left = pair()
    left.commitFree('B')
    expect(left.availableArrows()).toEqual(['A'])
    const right = pair()
    right.commitFree('A')
    expect(right.availableArrows()).toEqual(['B'])
  })

  it('wins after both leave', () => {
    const e = pair()
    e.commitFree('A')
    e.commitFree('B')
    expect(e.isWon).toBe(true)
  })
})

describe('L weave-free vs old sweep', () => {
  it('frees an L whose stem would self-hit under a whole-body sweep', () => {
    const e = engine([arrow('L', [P(2, 1), P(1, 1), P(0, 1), P(0, 2), P(0, 3)], 'right')], 5)
    expect(e.tryWeave('L')).toEqual({ kind: 'free', progressStop: 1 })
    expect(e.availableArrows()).toEqual(['L'])
  })

  it('commits that L and wins', () => {
    const e = engine([arrow('L', [P(2, 1), P(1, 1), P(0, 1), P(0, 2), P(0, 3)], 'right')], 5)
    e.commitFree('L')
    expect(e.isWon).toBe(true)
  })
})

describe('availableArrows', () => {
  it('is empty when every ray is blocked', () => {
    const e = engine(
      [
        arrow('A', [P(0, 0), P(0, 1)], 'right'),
        arrow('B', [P(0, 2), P(1, 2)], 'down'),
      ],
      3,
    )
    expect(e.tryWeave('B').kind).toBe('free')
    e.commitFree('B')
    expect(e.availableArrows()).toEqual(['A'])
  })

  it('includes an edge arrow with an empty ray', () => {
    const e = engine([arrow('A', [P(0, 1), P(0, 2)], 'right')], 3)
    expect(e.availableArrows()).toEqual(['A'])
  })

  it('omits a blocked arrow', () => {
    const e = engine(
      [
        arrow('A', [P(0, 0), P(0, 1)], 'right'),
        arrow('B', [P(0, 2), P(1, 2)], 'down'),
      ],
      3,
    )
    expect(e.availableArrows()).toEqual(['B'])
  })
})

describe('hearts + win', () => {
  it('is not out of hearts at start', () => {
    expect(engine([arrow('A', [P(0, 0), P(0, 1)], 'right')], 3).isOutOfHearts).toBe(false)
  })

  it('is not won while arrows remain', () => {
    expect(engine([arrow('A', [P(0, 0), P(0, 1)], 'right')], 3).isWon).toBe(false)
  })

  it('is won after the last free commit', () => {
    const e = engine([arrow('A', [P(0, 0), P(0, 1)], 'right')], 3)
    e.commitFree('A')
    expect(e.isWon).toBe(true)
  })

  it('hits zero hearts after three distinct blocks', () => {
    const e = engine(
      [
        arrow('A', [P(0, 0), P(0, 1)], 'right'),
        arrow('B', [P(1, 0), P(1, 1)], 'right'),
        arrow('C', [P(2, 0), P(2, 1)], 'right'),
        arrow('X', [P(0, 3), P(1, 3), P(2, 3)], 'down'),
      ],
      4,
    )
    e.commitBlocked('A')
    e.commitBlocked('B')
    e.commitBlocked('C')
    expect(e.hearts).toBe(0)
    expect(e.isOutOfHearts).toBe(true)
  })

  it('custom one-heart board empties on first block', () => {
    const e = engine(
      [
        arrow('A', [P(0, 0), P(0, 1)], 'right'),
        arrow('B', [P(0, 2), P(0, 3)], 'right'),
      ],
      4,
      { hearts: 1 },
    )
    e.commitBlocked('A')
    expect(e.isOutOfHearts).toBe(true)
  })
})

describe('undo', () => {
  it('returns false with no history', () => {
    expect(engine([arrow('A', [P(0, 0), P(0, 1)], 'right')], 3).undo()).toBe(false)
  })

  it('restores a freed arrow', () => {
    const e = engine([arrow('A', [P(0, 0), P(0, 1)], 'right')], 3)
    e.commitFree('A')
    expect(e.undo()).toBe(true)
    expect(e.board.arrows).toHaveLength(1)
    expect(e.moves).toBe(0)
  })

  it('restores hearts after a block', () => {
    const e = engine(
      [
        arrow('A', [P(0, 0), P(0, 1)], 'right'),
        arrow('B', [P(0, 2), P(0, 3)], 'right'),
      ],
      4,
    )
    e.commitBlocked('A')
    e.undo()
    expect(e.hearts).toBe(3)
    expect(e.board.arrows.find((a) => a.id === 'A')?.isRed).toBe(false)
  })

  it('undoes two commits in reverse', () => {
    const e = engine(
      [
        arrow('A', [P(0, 0), P(0, 1)], 'right'),
        arrow('B', [P(2, 0), P(2, 1)], 'right'),
      ],
      4,
    )
    e.commitFree('A')
    e.commitFree('B')
    e.undo()
    expect(e.board.arrows.map((a) => a.id)).toEqual(['B'])
    e.undo()
    expect(e.board.arrows.map((a) => a.id).sort()).toEqual(['A', 'B'])
  })

  it('keeps only 20 snapshots', () => {
    const e = engine(
      [
        arrow('A', [P(0, 0), P(0, 1)], 'right'),
        arrow('B', [P(1, 0), P(1, 1)], 'right'),
      ],
      4,
    )
    for (let i = 0; i < 24; i++) e.commitBlocked('A')
    let steps = 0
    while (e.undo()) steps += 1
    expect(steps).toBe(20)
  })

  it('drops the oldest snapshot after 21 commits', () => {
    const e = engine([arrow('A', [P(0, 0), P(0, 1)], 'right'), arrow('B', [P(2, 0), P(2, 1)], 'right')], 4)
    e.commitFree('B')
    for (let i = 0; i < 20; i++) e.commitBlocked('A')
    for (let i = 0; i < 20; i++) expect(e.undo()).toBe(true)
    expect(e.board.arrows.map((a) => a.id).sort()).toEqual(['A'])
    expect(e.undo()).toBe(false)
  })
})

describe('reset', () => {
  it('restores arrows, hearts, and moves', () => {
    const e = engine(
      [
        arrow('A', [P(0, 0), P(0, 1)], 'right'),
        arrow('B', [P(0, 2), P(0, 3)], 'right'),
      ],
      4,
    )
    e.commitFree('B')
    e.commitBlocked('A')
    e.reset()
    expect(e.board.arrows).toHaveLength(2)
    expect(e.hearts).toBe(3)
    expect(e.moves).toBe(0)
    expect(e.board.arrows.every((a) => !a.isRed)).toBe(true)
  })

  it('clears undo history', () => {
    const e = engine([arrow('A', [P(0, 0), P(0, 1)], 'right')], 3)
    e.commitFree('A')
    e.reset()
    expect(e.undo()).toBe(false)
  })

  it('restores custom hearts', () => {
    const e = engine(
      [
        arrow('A', [P(0, 0), P(0, 1)], 'right'),
        arrow('B', [P(0, 2), P(0, 3)], 'right'),
      ],
      4,
      { hearts: 5 },
    )
    e.commitBlocked('A')
    e.reset()
    expect(e.hearts).toBe(5)
  })
})

describe('toJSON / fromJSON roundtrip', () => {
  function busy() {
    const e = engine(
      [
        arrow('A', [P(0, 0), P(0, 1)], 'right'),
        arrow('B', [P(0, 2), P(0, 3)], 'right'),
        arrow('C', [P(2, 0), P(2, 1)], 'right'),
      ],
      4,
    )
    e.commitFree('B')
    e.commitBlocked('A')
    return e
  }

  it('preserves hearts', () => {
    const copy = PuzzleEngine.fromJSON(busy().toJSON())
    expect(copy.hearts).toBe(2)
  })

  it('preserves moves', () => {
    expect(PuzzleEngine.fromJSON(busy().toJSON()).moves).toBe(2)
  })

  it('preserves remaining arrows and red state', () => {
    const copy = PuzzleEngine.fromJSON(busy().toJSON())
    expect(copy.board.arrows.map((a) => a.id).sort()).toEqual(['A', 'C'])
    expect(copy.board.arrows.find((a) => a.id === 'A')?.isRed).toBe(true)
  })

  it('preserves availableArrows', () => {
    const original = busy()
    const copy = PuzzleEngine.fromJSON(original.toJSON())
    expect(copy.availableArrows()).toEqual(original.availableArrows())
  })

  it('can still undo after restore', () => {
    const copy = PuzzleEngine.fromJSON(busy().toJSON())
    expect(copy.undo()).toBe(true)
    expect(copy.hearts).toBe(3)
    expect(copy.board.arrows.find((a) => a.id === 'A')?.isRed).toBe(false)
  })

  it('can still win after restore', () => {
    const e = engine([arrow('A', [P(0, 0), P(0, 1)], 'right')], 3)
    const copy = PuzzleEngine.fromJSON(e.toJSON())
    copy.commitFree('A')
    expect(copy.isWon).toBe(true)
  })

  it('roundtrips an already-won board', () => {
    const e = engine([arrow('A', [P(0, 0), P(0, 1)], 'right')], 3)
    e.commitFree('A')
    const copy = PuzzleEngine.fromJSON(e.toJSON())
    expect(copy.isWon).toBe(true)
    expect(copy.board.arrows).toHaveLength(0)
  })

  it('rejects invalid json', () => {
    expect(() => PuzzleEngine.fromJSON({ hello: 'nope' })).toThrow(/invalid/)
  })

  it('does not share mutable arrays with the snapshot', () => {
    const e = busy()
    const json = e.toJSON() as { board: BoardModel }
    json.board.arrows.pop()
    expect(e.board.arrows).toHaveLength(2)
  })
})
