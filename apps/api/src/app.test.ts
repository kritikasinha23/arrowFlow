import { randomUUID } from "node:crypto";
import { fetch, Headers, Request, Response } from "undici";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { displayNameFromInstallId } from "../../../packages/engine/src/names.ts";
import { isoWeek } from "../../../packages/engine/src/season.ts";
import { createApp } from "./app.ts";
import { openDatabase } from "./db.ts";

if (!globalThis.fetch) {
  Object.assign(globalThis, { fetch, Headers, Request, Response });
}

function uuid(): string {
  return randomUUID();
}

async function json(res: Response, expectStatus?: number) {
  const body = await res.json();
  if (expectStatus != null) expect(res.status).toBe(expectStatus);
  return body as Record<string, unknown>;
}

describe("ArrowFlow API", () => {
  let db: ReturnType<typeof openDatabase>;
  let app: ReturnType<typeof createApp>;
  let now = new Date("2026-09-12T13:00:00.000Z");

  beforeEach(() => {
    now = new Date("2026-09-12T13:00:00.000Z");
    db = openDatabase(":memory:");
    app = createApp({ db, clock: () => now });
  });

  afterEach(() => {
    db.close();
  });

  async function guest(installId = uuid()) {
    const res = await app.request("/v1/users/guest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ installId }),
    });
    const body = await json(res);
    return { installId, ...body } as {
      installId: string;
      userId: string;
      displayName: string;
      token: string;
      streak: number;
    };
  }

  async function auth(path: string, token: string, init: RequestInit = {}) {
    return app.request(path, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  }

  it("upserts a guest idempotently on installId", async () => {
    const installId = uuid();
    const first = await guest(installId);
    expect(first.displayName).toBe(displayNameFromInstallId(installId));
    expect(first.streak).toBe(0);
    const second = await guest(installId);
    expect(second.userId).toBe(first.userId);
    expect(second.token).toBe(first.token);
    expect(second.displayName).toBe(first.displayName);
    const other = await guest(uuid());
    expect(other.userId).not.toBe(first.userId);
  });

  it("renames the signed-in player", async () => {
    const session = await guest();
    const res = await auth("/v1/users/me", session.token, {
      method: "PATCH",
      body: JSON.stringify({ displayName: "Quiet Needle 17" }),
    });
    const body = await json(res, 200);
    expect(body.displayName).toBe("Quiet Needle 17");
    const me = await json(await auth("/v1/users/me", session.token), 200);
    expect(me.displayName).toBe("Quiet Needle 17");
    expect(me.streak).toBe(0);
  });

  it("reassigns a Threadabc-style name on the next guest upsert", async () => {
    const installId = uuid();
    const seen = now.toISOString();
    db.prepare(
      `INSERT INTO users (user_id, install_id, display_name, token, streak, last_win_utc, created_at, seen_at)
       VALUES (?, ?, ?, ?, 0, NULL, ?, ?)`,
    ).run(randomUUID(), installId, "Threadabc", "tok-ugly", seen, seen);
    const again = await guest(installId);
    expect(again.displayName).toBe(displayNameFromInstallId(installId));
    expect(again.displayName).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{1,4}$/);
    expect(again.displayName).not.toMatch(/^Thread[A-Za-z]+$/);
  });

  it("keeps a customized name on guest upsert", async () => {
    const session = await guest();
    await auth("/v1/users/me", session.token, {
      method: "PATCH",
      body: JSON.stringify({ displayName: "Kritika" }),
    });
    const again = await guest(session.installId);
    expect(again.displayName).toBe("Kritika");
  });

  it("rejects a too-short rename", async () => {
    const session = await guest();
    const res = await auth("/v1/users/me", session.token, {
      method: "PATCH",
      body: JSON.stringify({ displayName: "Q" }),
    });
    expect(res.status).toBe(400);
  });

  it("fills league buckets of 30 then opens the next", async () => {
    const first = await guest();
    const opened = await json(await auth("/v1/leagues/current", first.token), 200);
    expect(opened.seasonId).toBe("2026-W37");
    expect(opened.weekLabel).toBe("Week 37");
    expect(opened.endsIn).toBe("Ends in 1d 11h");
    expect(opened.bucketIndex).toBe(0);
    expect(opened.memberCount).toBe(1);
    expect(opened.rank).toBeNull();

    for (let i = 0; i < 29; i++) {
      const s = await guest();
      await auth("/v1/leagues/current", s.token);
    }
    const full = await json(await auth("/v1/leagues/current", first.token), 200);
    expect(full.bucketIndex).toBe(0);
    expect(full.memberCount).toBe(30);

    const overflow = await guest();
    const next = await json(await auth("/v1/leagues/current", overflow.token), 200);
    expect(next.bucketIndex).toBe(1);
    expect(next.memberCount).toBe(1);
    const still = await json(await auth("/v1/leagues/current", first.token), 200);
    expect(still.bucketIndex).toBe(0);
  });

  it("computes the UTC ISO week id", () => {
    expect(isoWeek(new Date("2026-09-12T13:00:00.000Z")).seasonId).toBe("2026-W37");
    expect(isoWeek(new Date("2026-09-14T00:00:00.000Z")).seasonId).toBe("2026-W38");
  });

  it("rejects a score whose move log does not replay", async () => {
    const session = await guest();
    const res = await auth("/v1/scores", session.token, {
      method: "POST",
      body: JSON.stringify({
        boardId: "flow_0002",
        mode: "campaign",
        hints: 0,
        elapsedMs: 1200,
        moveLog: [{ arrowId: "A", tMs: 100, result: "free" }],
      }),
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(String(body.error)).toMatch(/replay/i);
  });

  it("accepts a cleared solo board and bumps streak on a new UTC day", async () => {
    const session = await guest();
    const win = {
      boardId: "flow_0001",
      mode: "campaign",
      hints: 0,
      elapsedMs: 2400,
      moveLog: [{ arrowId: "A", tMs: 400, result: "free" }],
    };
    const first = await json(await auth("/v1/scores", session.token, { method: "POST", body: JSON.stringify(win) }), 200);
    expect(first.streak).toBe(1);
    expect(first.accepted).toBe(true);
    const sameDay = await json(
      await auth("/v1/scores", session.token, { method: "POST", body: JSON.stringify(win) }),
      200,
    );
    expect(sameDay.streak).toBe(1);
    now = new Date("2026-09-13T08:00:00.000Z");
    const nextDay = await json(
      await auth("/v1/scores", session.token, { method: "POST", body: JSON.stringify(win) }),
      200,
    );
    expect(nextDay.streak).toBe(2);
    const me = await json(await auth("/v1/users/me", session.token), 200);
    expect(me.streak).toBe(2);
  });

  it("stores and returns campaign progress on the guest profile", async () => {
    const session = await guest();
    const me = await json(await auth("/v1/users/me", session.token), 200);
    expect(me.progress).toMatchObject({ version: 1, lastCampaignLevelId: "flow_0001" });
    const patched = await json(
      await auth("/v1/users/me", session.token, {
        method: "PATCH",
        body: JSON.stringify({
          progress: {
            version: 1,
            lastCampaignLevelId: "flow_0002",
            completedIds: ["flow_0001"],
            campaign: { flow_0001: { stars: 3, score: 11200, heartsLeft: 3, moves: 1 } },
            daily: {},
            league: {},
            pendingScores: [],
          },
        }),
      }),
      200,
    );
    expect(patched.progress).toMatchObject({ lastCampaignLevelId: "flow_0002" });
    const again = await json(await auth("/v1/users/me", session.token), 200);
    expect(again.progress).toMatchObject({
      lastCampaignLevelId: "flow_0002",
      completedIds: ["flow_0001"],
    });
  });

  it("returns daily board id and empty high scores", async () => {
    const daily = await json(await app.request("/v1/daily/2026-09-12"), 200);
    expect(daily.date).toBe("2026-09-12");
    expect(String(daily.boardId)).toMatch(/^flow_/);
    const scores = await json(await app.request("/v1/scores/daily/2026-09-12"), 200);
    expect(scores.top).toEqual([]);
    expect(scores.me).toBeNull();
  });
});
