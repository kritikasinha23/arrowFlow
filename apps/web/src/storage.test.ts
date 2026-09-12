import { describe, expect, it } from "vitest";
import { CAMPAIGN_LEVEL_IDS, CAMPAIGN_START_ID } from "../../../packages/levels/src/catalog.ts";
import { emptyProgress } from "../../../packages/levels/src/progress.ts";
import {
  PROGRESS_KEY,
  commitCampaignWin,
  getLastLevel,
  getStars,
  queueScore,
  readProgress,
  recordModeBest,
} from "./storage";

function memory() {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}

const WIN = { stars: 3, score: 11_200, heartsLeft: 3, moves: 1 };

describe("campaign persistence", () => {
  it("winning level i persists i+1", () => {
    const storage = memory();
    expect(getLastLevel(storage)).toBe(CAMPAIGN_START_ID);
    expect(storage.getItem(PROGRESS_KEY)).toBeNull();
    const won = commitCampaignWin("flow_0001", WIN, storage);
    expect(won.lastCampaignLevelId).toBe("flow_0002");
    expect(getLastLevel(storage)).toBe("flow_0002");
    expect(getStars("flow_0001", storage)).toBe(3);
    expect(JSON.parse(storage.getItem(PROGRESS_KEY) ?? "{}").lastCampaignLevelId).toBe("flow_0002");
  });

  it("missing storage starts at the tutorial and never writes flow_0015 or flow_0025", () => {
    const storage = memory();
    expect(getLastLevel(storage)).toBe("flow_0001");
    expect(readProgress(storage).lastCampaignLevelId).toBe("flow_0001");
    expect(storage.getItem(PROGRESS_KEY)).toBeNull();
    expect(storage.getItem("arrowflow.lastLevel")).toBeNull();
    const raw = JSON.stringify(readProgress(storage));
    expect(raw).not.toContain("flow_0015");
    expect(raw).not.toContain("flow_0025");
  });

  it("does not treat a leftover lastLevel default as progress when there are no stars", () => {
    const storage = memory();
    storage.setItem("arrowflow.lastLevel", "flow_0025");
    expect(getLastLevel(storage)).toBe("flow_0001");
  });

  it("out of hearts does not advance the saved index", () => {
    const storage = memory();
    commitCampaignWin("flow_0001", { stars: 0, score: 0, heartsLeft: 0, moves: 3 }, storage);
    expect(getLastLevel(storage)).toBe("flow_0001");
    expect(storage.getItem(PROGRESS_KEY)).toBeNull();
  });

  it("keeps campaign, daily, and league scores on separate maps", () => {
    const storage = memory();
    commitCampaignWin("flow_0001", WIN, storage);
    recordModeBest("daily", "2026-09-12", { ...WIN, score: 9000 }, storage);
    recordModeBest("league", "2026-W37", { ...WIN, score: 8000 }, storage);
    const progress = readProgress(storage);
    expect(progress.campaign.flow_0001?.score).toBe(11_200);
    expect(progress.daily["2026-09-12"]?.score).toBe(9000);
    expect(progress.league["2026-W37"]?.score).toBe(8000);
    expect(progress.lastCampaignLevelId).toBe("flow_0002");
  });

  it("queues an offline score for retry", () => {
    const storage = memory();
    queueScore(
      {
        boardId: "flow_0001",
        mode: "campaign",
        hints: 0,
        elapsedMs: 900,
        moveLog: [{ arrowId: "A", tMs: 200, result: "free" }],
      },
      storage,
    );
    expect(readProgress(storage).pendingScores).toHaveLength(1);
  });

  it("empty progress continue id is the first campaign board", () => {
    expect(emptyProgress().lastCampaignLevelId).toBe(CAMPAIGN_LEVEL_IDS[0]);
  });
});
