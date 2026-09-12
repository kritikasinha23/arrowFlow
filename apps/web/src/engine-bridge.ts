/**
 * Linked to packages/engine (DOM-free). Avoids packages/engine/src/index.ts
 * because that barrel also exports guest.ts (node:crypto).
 */
export type {
  ArrowModel,
  BoardModel,
  Direction,
  GridPoint,
  WeaveResult,
} from "../../../packages/engine/src/types.ts";
export { PuzzleEngine } from "../../../packages/engine/src/engine.ts";
