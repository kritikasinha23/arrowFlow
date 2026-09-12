import { PuzzleEngine } from "../../../packages/engine/src/engine.ts";
import type { BoardModel } from "../../../packages/engine/src/types.ts";

export type MoveLogEntry = {
  arrowId: string;
  tMs?: number;
  result: "free" | "blocked";
};

export type ReplayOk = {
  ok: true;
  heartsLeft: number;
  heartsLost: number;
  moves: number;
  pieceCount: number;
};

export type ReplayFail = { ok: false; reason: string };

export function replayMoveLog(board: BoardModel, moveLog: MoveLogEntry[]): ReplayOk | ReplayFail {
  if (!Array.isArray(moveLog) || moveLog.length === 0) {
    return { ok: false, reason: "move log is required" };
  }
  const pieceCount = board.arrows.length;
  const engine = new PuzzleEngine(board);
  const initialHearts = engine.hearts;

  for (const step of moveLog) {
    if (!step || (step.result !== "free" && step.result !== "blocked") || !step.arrowId) {
      return { ok: false, reason: "invalid move log entry" };
    }
    let weave;
    try {
      weave = engine.tryWeave(step.arrowId);
    } catch {
      return { ok: false, reason: `unknown piece ${step.arrowId}` };
    }
    if (weave.kind !== step.result) {
      return { ok: false, reason: `replay mismatch for ${step.arrowId}` };
    }
    if (weave.kind === "free") engine.commitFree(step.arrowId);
    else engine.commitBlocked(step.arrowId);
  }

  if (!engine.isWon) {
    return { ok: false, reason: "board was not cleared" };
  }

  return {
    ok: true,
    heartsLeft: engine.hearts,
    heartsLost: Math.max(0, initialHearts - engine.hearts),
    moves: engine.moves,
    pieceCount,
  };
}
