/**
 * Generate Silhouette / tier sample boards and write JSON under packages/levels.
 * Run: node --experimental-strip-types tools/generator/export-samples.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SILHOUETTE_SPECS, generateCatalogLevel } from './hamiltonian.ts'
import { SHAPE_MASKS } from './masks.ts'
import { occupancyStats } from './util.ts'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '../../packages/levels/src/levels')

mkdirSync(outDir, { recursive: true })

const summary: string[] = []
for (const spec of SILHOUETTE_SPECS) {
  try {
    const board = generateCatalogLevel(spec)
    const dest = join(outDir, `${spec.id}.json`)
    writeFileSync(dest, `${JSON.stringify(board, null, 2)}\n`)
    const mask = spec.maskId ? SHAPE_MASKS[spec.maskId].cells : undefined
    const stats = occupancyStats(board, mask)
    const lens = board.arrows.map((a) => a.cells.length)
    const line = `${spec.id} tier=${spec.tier} layout=${spec.layout} mask=${spec.maskId ?? '-'} ${board.width}x${board.height} pieces=${stats.pieces} lens=${lens.sort((a, b) => b - a).slice(0, 6).join(',')} iRatio=${stats.iRatio.toFixed(2)} avgTurns=${stats.avgTurns.toFixed(2)}`
    summary.push(line)
    process.stdout.write(`${line}\n`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stdout.write(`FAIL ${spec.id}: ${msg}\n`)
    summary.push(`FAIL ${spec.id}: ${msg}`)
  }
}

writeFileSync(join(outDir, '_silhouette_summary.txt'), `${summary.join('\n')}\n`)
