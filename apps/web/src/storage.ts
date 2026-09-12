import type { LinesMode } from "@arrowflow/renderer";
import {
  CAMPAIGN_START_ID,
  applyCampaignWin,
  applyModeBest,
  dequeuePendingScore,
  emptyProgress,
  enqueuePendingScore,
  isCampaignUnlocked,
  listCampaignBests,
  mergeProgress,
  parseProgress,
  starsFromHearts,
  type LevelBest,
  type PendingScore,
  type PlayMode,
  type ProgressV1,
} from "../../../packages/levels/src/progress.ts";
import { isCampaignLevelId } from "../../../packages/levels/src/catalog.ts";

export const PROGRESS_KEY = "arrowflow.progress.v1";
const LINES_KEY = "arrowflow.lines";
const LAST_LEVEL_KEY = "arrowflow.lastLevel";
const MUTE_KEY = "arrowflow.mute";
const STREAK_KEY = "arrowflow.streak";
const DAILY_DONE_KEY = "arrowflow.dailyDone";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
  length?: number;
  key?(index: number): string | null;
};

function store(): StorageLike | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function safeGet(key: string, storage: StorageLike | null = store()): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string, storage: StorageLike | null = store()): void {
  try {
    storage?.setItem(key, value);
  } catch {
    /* ignore quota / private mode */
  }
}

function listKeys(storage: StorageLike | null): string[] {
  if (!storage) return [];
  if (typeof storage.key === "function" && typeof storage.length === "number") {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key) keys.push(key);
    }
    return keys;
  }
  return Object.keys(storage);
}

function migrateLegacy(storage: StorageLike | null): ProgressV1 | null {
  if (!storage) return null;
  const stars: Record<string, number> = {};
  for (const key of listKeys(storage)) {
    if (!key.startsWith("arrowflow.stars.")) continue;
    const id = key.slice("arrowflow.stars.".length);
    const n = Number(storage.getItem(key));
    if (isCampaignLevelId(id) && Number.isFinite(n) && n > 0) stars[id] = Math.max(0, Math.min(3, n));
  }
  if (Object.keys(stars).length === 0) return null;
  const progress = emptyProgress();
  progress.campaign = Object.fromEntries(
    Object.entries(stars).map(([boardId, value]) => [
      boardId,
      { stars: value, score: 0, heartsLeft: value, moves: 0 },
    ]),
  );
  progress.completedIds = Object.keys(stars);
  const old = storage.getItem(LAST_LEVEL_KEY);
  if (old && isCampaignLevelId(old)) progress.lastCampaignLevelId = old;
  return progress;
}

export function readProgress(storage: StorageLike | null = store()): ProgressV1 {
  const raw = safeGet(PROGRESS_KEY, storage);
  if (raw) {
    try {
      const parsed = parseProgress(JSON.parse(raw) as unknown);
      if (parsed) return parsed;
    } catch {
      /* fall through to empty first-run */
    }
  }
  const migrated = migrateLegacy(storage);
  if (migrated) {
    writeProgress(migrated, storage);
    return migrated;
  }
  return emptyProgress();
}

export function writeProgress(progress: ProgressV1, storage: StorageLike | null = store()): void {
  safeSet(PROGRESS_KEY, JSON.stringify(progress), storage);
}

export function getLastLevel(storage: StorageLike | null = store()): string {
  return readProgress(storage).lastCampaignLevelId;
}

export function setLastLevel(id: string, storage: StorageLike | null = store()): void {
  if (!isCampaignLevelId(id)) return;
  const progress = readProgress(storage);
  if (progress.lastCampaignLevelId === id) return;
  writeProgress({ ...progress, lastCampaignLevelId: id }, storage);
}

export function getStars(levelId: string, storage: StorageLike | null = store()): number {
  return readProgress(storage).campaign[levelId]?.stars ?? 0;
}

export function isLevelUnlocked(levelId: string, storage: StorageLike | null = store()): boolean {
  return isCampaignUnlocked(readProgress(storage), levelId);
}

export function commitCampaignWin(
  levelId: string,
  result: LevelBest,
  storage: StorageLike | null = store(),
): ProgressV1 {
  const current = readProgress(storage);
  const next = applyCampaignWin(current, levelId, result);
  if (next === current) return current;
  writeProgress(next, storage);
  return next;
}

export function recordModeBest(
  mode: PlayMode,
  key: string,
  result: LevelBest,
  storage: StorageLike | null = store(),
): ProgressV1 {
  const next = applyModeBest(readProgress(storage), mode, key, result);
  writeProgress(next, storage);
  return next;
}

export function queueScore(pending: PendingScore, storage: StorageLike | null = store()): ProgressV1 {
  const next = enqueuePendingScore(readProgress(storage), pending);
  writeProgress(next, storage);
  return next;
}

export function clearQueuedScore(pending: PendingScore, storage: StorageLike | null = store()): ProgressV1 {
  const next = dequeuePendingScore(readProgress(storage), pending);
  writeProgress(next, storage);
  return next;
}

export function mergeAndStoreProgress(incoming: ProgressV1, storage: StorageLike | null = store()): ProgressV1 {
  const next = mergeProgress(readProgress(storage), incoming);
  writeProgress(next, storage);
  return next;
}

export function campaignBests(storage: StorageLike | null = store()) {
  return listCampaignBests(readProgress(storage));
}

export { CAMPAIGN_START_ID, starsFromHearts };

export function getLinesMode(): LinesMode {
  const v = safeGet(LINES_KEY);
  if (v === "off") return "off";
  if (v === "on" || v === "subtle" || v === "full") return "on";
  return "off";
}

export function setLinesMode(mode: LinesMode): void {
  safeSet(LINES_KEY, mode === "off" ? "off" : "on");
}

export function cycleLines(mode: LinesMode): LinesMode {
  return mode === "off" ? "on" : "off";
}

export function getMuted(): boolean {
  return safeGet(MUTE_KEY) === "1";
}

export function setMuted(muted: boolean): void {
  safeSet(MUTE_KEY, muted ? "1" : "0");
}

export function getStreak(): number {
  const raw = safeGet(STREAK_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

export function setStreak(n: number): void {
  safeSet(STREAK_KEY, String(Math.max(0, Math.floor(n))));
}

export function getDailyDoneStamp(): string | null {
  return safeGet(DAILY_DONE_KEY);
}

export function setDailyDone(stamp: string): void {
  safeSet(DAILY_DONE_KEY, stamp);
}

export function isDailyCompleted(stamp = utcStamp()): boolean {
  return getDailyDoneStamp() === stamp;
}

export function utcStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
