import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GENERATED_SPECS, generateCatalogLevel } from './hamiltonian.ts'
import { occupancyStats } from './util.ts'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '../../packages/levels/src/levels')

mkdirSync(outDir, { recursive: true })

for (const spec of GENERATED_SPECS) {
  const board = generateCatalogLevel(spec)
  const dest = join(outDir, `${spec.id}.json`)
  writeFileSync(dest, `${JSON.stringify(board, null, 2)}\n`)
  const stats = occupancyStats(board)
  process.stdout.write(
    `${spec.id} ${spec.width}x${spec.height} pieces=${stats.pieces} occupied=${stats.occupied}/${stats.playable} iRatio=${stats.iRatio.toFixed(2)} avgTurns=${stats.avgTurns.toFixed(2)}\n`,
  )
}
