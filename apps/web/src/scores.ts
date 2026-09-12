import { computeScore } from "../../../packages/engine/src/season.ts";
import { postScore, type ScoreSubmit } from "./api";
import {
  clearQueuedScore,
  commitCampaignWin,
  queueScore,
  readProgress,
  recordModeBest,
  setDailyDone,
  setStreak,
  starsFromHearts,
  utcStamp,
} from "./storage";
import type { PendingScore, PlayMode } from "../../../packages/levels/src/progress.ts";

export type WinInput = {
  boardId: string;
  mode: PlayMode;
  heartsLeft: number;
  hints: number;
  elapsedMs: number;
  moves: number;
  pieceCount: number;
  moveLog: ScoreSubmit["moveLog"];
  date?: string;
  seasonId?: string;
};

export function bestFromWin(input: WinInput) {
  return {
    stars: starsFromHearts(input.heartsLeft),
    score: computeScore({
      heartsLeft: input.heartsLeft,
      moves: input.moves,
      hints: input.hints,
      elapsedMs: input.elapsedMs,
      pieceCount: input.pieceCount,
    }),
    heartsLeft: input.heartsLeft,
    moves: input.moves,
  };
}

export function commitWinLocally(input: WinInput) {
  if (input.heartsLeft <= 0) return readProgress();
  const best = bestFromWin(input);
  let progress = readProgress();
  if (input.mode === "campaign") {
    progress = commitCampaignWin(input.boardId, best);
  } else if (input.mode === "daily") {
    progress = recordModeBest("daily", input.date ?? utcStamp(), best);
    setDailyDone(input.date ?? utcStamp());
  } else {
    progress = recordModeBest("league", input.seasonId ?? input.boardId, best);
  }
  const pending: PendingScore = {
    boardId: input.boardId,
    mode: input.mode,
    date: input.mode === "daily" ? input.date ?? utcStamp() : undefined,
    seasonId: input.mode === "league" ? input.seasonId : undefined,
    hints: input.hints,
    elapsedMs: input.elapsedMs,
    moveLog: input.moveLog,
  };
  return queueScore(pending);
}

export async function flushPendingScores(token: string | null): Promise<void> {
  if (!token) return;
  const pending = readProgress().pendingScores.slice();
  for (const row of pending) {
    try {
      const res = await postScore(token, {
        boardId: row.boardId,
        mode: row.mode,
        date: row.date,
        hints: row.hints,
        elapsedMs: row.elapsedMs,
        moveLog: row.moveLog,
      });
      clearQueuedScore(row);
      if (typeof res.streak === "number") setStreak(res.streak);
    } catch {
      /* keep queued for the next retry */
    }
  }
}
