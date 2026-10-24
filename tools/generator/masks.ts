import type { CellMask } from './util.ts'

export type ShapeMask = {
  id: string
  width: number
  height: number
  cells: CellMask
}

function fromArt(id: string, lines: string[]): ShapeMask {
  const height = lines.length
  const width = lines[0]?.length ?? 0
  const cells = lines.map((line) => {
    if (line.length !== width) throw new Error(`${id} mask row width mismatch`)
    return [...line].map((ch) => ch !== '.' && ch !== ' ')
  })
  return { id, width, height, cells }
}

/** Pixel heart. Playable cells are `#`. */
export const HEART_MASK: ShapeMask = fromArt('heart', [
  '.##...##.',
  '###.#.###',
  '#########',
  '#########',
  '.#######.',
  '..#####..',
  '...###...',
  '....#....',
])

/** Ring with a 3×3 hole. Ray still travels through the hole to the far side. */
export const DONUT_MASK: ShapeMask = fromArt('donut', [
  '#########',
  '#########',
  '#########',
  '###...###',
  '###...###',
  '###...###',
  '#########',
  '#########',
  '#########',
])

/** Side-view car: cabin, body, two wheels. */
export const CAR_MASK: ShapeMask = fromArt('car', [
  '...#####...',
  '..#######..',
  '###########',
  '###########',
  '.##.....##.',
  '.##.....##.',
])

/** Classic 5-point-ish star blob. */
export const STAR_MASK: ShapeMask = fromArt('star', [
  '....#....',
  '...###...',
  '#########',
  '.#######.',
  '..##.##..',
  '.##...##.',
  '##.....##',
])

/** Diamond / kite. */
export const DIAMOND_MASK: ShapeMask = fromArt('diamond', [
  '....#....',
  '...###...',
  '..#####..',
  '.#######.',
  '#########',
  '.#######.',
  '..#####..',
  '...###...',
  '....#....',
])

/** Open C / horseshoe — forces routing around a bay. */
export const C_BEND_MASK: ShapeMask = fromArt('cBend', [
  '.#######',
  '########',
  '###.....',
  '###.....',
  '###.....',
  '########',
  '.#######',
])

/** Crescent moon. */
export const MOON_MASK: ShapeMask = fromArt('moon', [
  '..#####..',
  '.#######.',
  '####..##.',
  '###....#.',
  '###....#.',
  '####..##.',
  '.#######.',
  '..#####..',
])

export const SHAPE_MASKS: Record<string, ShapeMask> = {
  heart: HEART_MASK,
  donut: DONUT_MASK,
  car: CAR_MASK,
  star: STAR_MASK,
  diamond: DIAMOND_MASK,
  cBend: C_BEND_MASK,
  moon: MOON_MASK,
}

export type ShapeMaskId = keyof typeof SHAPE_MASKS

export function playableCount(shape: ShapeMask): number {
  let n = 0
  for (const row of shape.cells) {
    for (const cell of row) if (cell) n += 1
  }
  return n
}
