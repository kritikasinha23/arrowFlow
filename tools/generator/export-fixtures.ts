import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateLevel } from './generate.ts'
import { SHAPE_MASKS, playableCount } from './masks.ts'
import { occupancyStats } from './util.ts'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, 'fixtures')
mkdirSync(outDir, { recursive: true })

const seeds: Record<string, number> = {
  heart: 7101,
  donut: 7202,
  car: 7303,
}

for (const shape of Object.values(SHAPE_MASKS)) {
  const board = generateLevel({
    width: shape.width,
    height: shape.height,
    mask: shape.cells,
    seed: seeds[shape.id] ?? 8000,
    levelId: `shape_${shape.id}`,
    difficulty: 3,
    minTurns: 2,
  })
  const dest = join(outDir, `${shape.id}.json`)
  writeFileSync(dest, `${JSON.stringify(board, null, 2)}\n`)
  const stats = occupancyStats(board, shape.cells)
  process.stdout.write(
    `${shape.id} playable=${playableCount(shape)} occupied=${stats.occupied} pieces=${stats.pieces} iRatio=${stats.iRatio.toFixed(2)} avgTurns=${stats.avgTurns.toFixed(2)}\n`,
  )
}
