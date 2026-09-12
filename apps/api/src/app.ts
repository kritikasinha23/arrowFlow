import { randomBytes, randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  displayNameFromInstallId,
  isUglyGeneratedName,
  normalizeDisplayName,
} from "../../../packages/engine/src/names.ts";
import { compareStandings, computeScore, formatEndsIn, isoWeek, previousUtcDateKey, utcDateKey } from "../../../packages/engine/src/season.ts";
import { getDailyLevelId, getLevel, PACKED_LEVEL_IDS } from "../../../packages/levels/src/index.ts";
import { emptyProgress, mergeProgress, parseProgress, type ProgressV1 } from "../../../packages/levels/src/progress.ts";
import { replayMoveLog } from "./replay.ts";

export const BUCKET_SIZE = 30;
const RATE_LIMIT = 8;
const TOP_N = 20;

type Variables = { user: UserRow };

type UserRow = {
  user_id: string;
  install_id: string;
  display_name: string;
  token: string;
  streak: number;
  last_win_utc: string | null;
  created_at: string;
  seen_at: string;
  name_customized: number;
  progress: string | null;
};

type ScoreRow = {
  id: string;
  user_id: string;
  board_id: string;
  mode: string;
  date_key: string;
  season_id: string;
  hearts_left: number;
  hearts_lost: number;
  moves: number;
  hints: number;
  elapsed_ms: number;
  extra_moves: number;
  score: number;
  created_at: string;
};

const INSTALL_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function nowIso(clock: () => Date): string {
  return clock().toISOString();
}

function newToken(): string {
  return randomBytes(24).toString("hex");
}

function seasonBoardId(seasonId: string): string {
  const packed = PACKED_LEVEL_IDS;
  if (packed.length === 0) throw new Error("packed catalog is empty");
  let h = 0;
  for (let i = 0; i < seasonId.length; i++) h = (h * 31 + seasonId.charCodeAt(i)) >>> 0;
  const id = packed[h % packed.length];
  if (!id) throw new Error("packed catalog is empty");
  return id;
}

function readProgressBlob(user: UserRow): ProgressV1 {
  if (!user.progress) return emptyProgress();
  try {
    return parseProgress(JSON.parse(user.progress) as unknown) ?? emptyProgress();
  } catch {
    return emptyProgress();
  }
}

function ensureSeason(db: Database.Database, clock: () => Date) {
  const week = isoWeek(clock());
  const existing = db.prepare("SELECT * FROM seasons WHERE season_id = ?").get(week.seasonId) as
    | { season_id: string; board_id: string; starts_at: string; closes_at: string }
    | undefined;
  if (existing) return existing;
  const row = {
    season_id: week.seasonId,
    board_id: seasonBoardId(week.seasonId),
    starts_at: week.startsAt.toISOString(),
    closes_at: week.closesAt.toISOString(),
  };
  db.prepare("INSERT INTO seasons (season_id, board_id, starts_at, closes_at) VALUES (?, ?, ?, ?)").run(
    row.season_id,
    row.board_id,
    row.starts_at,
    row.closes_at,
  );
  return row;
}

function assignBucket(db: Database.Database, userId: string, seasonId: string, clock: () => Date) {
  const existing = db
    .prepare("SELECT bucket_index FROM league_members WHERE season_id = ? AND user_id = ?")
    .get(seasonId, userId) as { bucket_index: number } | undefined;
  if (existing) return existing.bucket_index;

  return db.transaction(() => {
    const latest = db
      .prepare(
        "SELECT bucket_index, member_count FROM league_buckets WHERE season_id = ? ORDER BY bucket_index DESC LIMIT 1",
      )
      .get(seasonId) as { bucket_index: number; member_count: number } | undefined;

    let bucketIndex = 0;
    if (!latest) {
      db.prepare("INSERT INTO league_buckets (season_id, bucket_index, member_count) VALUES (?, 0, 0)").run(seasonId);
      bucketIndex = 0;
    } else if (latest.member_count < BUCKET_SIZE) {
      bucketIndex = latest.bucket_index;
    } else {
      bucketIndex = latest.bucket_index + 1;
      db.prepare("INSERT INTO league_buckets (season_id, bucket_index, member_count) VALUES (?, ?, 0)").run(
        seasonId,
        bucketIndex,
      );
    }

    db.prepare("INSERT INTO league_members (season_id, user_id, bucket_index, joined_at) VALUES (?, ?, ?, ?)").run(
      seasonId,
      userId,
      bucketIndex,
      nowIso(clock),
    );
    db.prepare(
      "UPDATE league_buckets SET member_count = member_count + 1 WHERE season_id = ? AND bucket_index = ?",
    ).run(seasonId, bucketIndex);
    return bucketIndex;
  })();
}

function applyStreak(user: UserRow, today: string): { streak: number; lastWinUtc: string } {
  if (user.last_win_utc === today) {
    return { streak: user.streak, lastWinUtc: today };
  }
  if (user.last_win_utc && user.last_win_utc === previousUtcDateKey(today)) {
    return { streak: user.streak + 1, lastWinUtc: today };
  }
  return { streak: 1, lastWinUtc: today };
}

function publicUser(user: UserRow) {
  return { userId: user.user_id, displayName: user.display_name, streak: user.streak };
}

function rankRows(rows: ScoreRow[]) {
  const sorted = [...rows].sort(compareStandings);
  return sorted.map((row, i) => ({ ...row, rank: i + 1 }));
}

export function createApp(opts: { db: Database.Database; clock?: () => Date }) {
  const db = opts.db;
  const clock = opts.clock ?? (() => new Date());
  const app = new Hono<{ Variables: Variables }>();

  app.use(
    "*",
    cors({
      origin: [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
      ],
      allowHeaders: ["Authorization", "Content-Type"],
      allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
    }),
  );

  app.get("/health", (c) => c.json({ ok: true, service: "arrowflow-api" }));

  const userByToken = db.prepare("SELECT * FROM users WHERE token = ?");
  const userByInstall = db.prepare("SELECT * FROM users WHERE install_id = ?");
  const userById = db.prepare("SELECT * FROM users WHERE user_id = ?");

  async function readUser(c: { req: { header: (n: string) => string | undefined } }): Promise<UserRow | null> {
    const header = c.req.header("authorization") ?? "";
    const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
    if (!token) return null;
    return (userByToken.get(token) as UserRow | undefined) ?? null;
  }

  app.post("/v1/users/guest", async (c) => {
    const body = await c.req.json().catch(() => null);
    const installId = typeof body?.installId === "string" ? body.installId.trim() : "";
    if (!INSTALL_RE.test(installId)) {
      return c.json({ error: "installId must be a UUID" }, 400);
    }
    const existing = userByInstall.get(installId) as UserRow | undefined;
    const seen = nowIso(clock);
    if (existing) {
      const customized = Number(existing.name_customized) === 1;
      if (!customized && isUglyGeneratedName(existing.display_name)) {
        db.prepare("UPDATE users SET seen_at = ?, display_name = ? WHERE user_id = ?").run(
          seen,
          displayNameFromInstallId(installId),
          existing.user_id,
        );
      } else {
        db.prepare("UPDATE users SET seen_at = ? WHERE user_id = ?").run(seen, existing.user_id);
      }
      const fresh = userById.get(existing.user_id) as UserRow;
      return c.json({ ...publicUser(fresh), token: fresh.token });
    }
    const user: UserRow = {
      user_id: randomUUID(),
      install_id: installId,
      display_name: displayNameFromInstallId(installId),
      token: newToken(),
      streak: 0,
      last_win_utc: null,
      created_at: seen,
      seen_at: seen,
      name_customized: 0,
      progress: null,
    };
    db.prepare(
      `INSERT INTO users (user_id, install_id, display_name, token, streak, last_win_utc, created_at, seen_at, name_customized)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      user.user_id,
      user.install_id,
      user.display_name,
      user.token,
      user.streak,
      user.last_win_utc,
      user.created_at,
      user.seen_at,
      user.name_customized,
    );
    return c.json({ ...publicUser(user), token: user.token }, 201);
  });

  app.get("/v1/users/me", async (c) => {
    const user = await readUser(c);
    if (!user) return c.json({ error: "sign in required" }, 401);
    const season = ensureSeason(db, clock);
    const member = db
      .prepare("SELECT bucket_index FROM league_members WHERE season_id = ? AND user_id = ?")
      .get(season.season_id, user.user_id) as { bucket_index: number } | undefined;
    let leagueRank: number | null = null;
    let leagueScore: number | null = null;
    if (member) {
      const rows = db
        .prepare("SELECT * FROM scores WHERE mode = 'league' AND season_id = ? AND user_id IN (SELECT user_id FROM league_members WHERE season_id = ? AND bucket_index = ?)")
        .all(season.season_id, season.season_id, member.bucket_index) as ScoreRow[];
      const ranked = rankRows(rows);
      const mine = ranked.find((r) => r.user_id === user.user_id);
      leagueRank = mine?.rank ?? null;
      leagueScore = mine?.score ?? null;
    }
    const bests = db
      .prepare(
        `SELECT mode, board_id, date_key, season_id, score, hearts_lost, moves, elapsed_ms
         FROM scores WHERE user_id = ? ORDER BY score DESC`,
      )
      .all(user.user_id) as Array<{
      mode: string;
      board_id: string;
      date_key: string;
      season_id: string;
      score: number;
      hearts_lost: number;
      moves: number;
      elapsed_ms: number;
    }>;
    const campaign = bests.filter((b) => b.mode === "campaign").slice(0, 8);
    const dailyBest = bests.find((b) => b.mode === "daily") ?? null;
    return c.json({
      ...publicUser(user),
      lastWinUtc: user.last_win_utc,
      progress: readProgressBlob(user),
      league: {
        seasonId: season.season_id,
        weekLabel: isoWeek(clock()).weekLabel,
        rank: leagueRank,
        score: leagueScore,
      },
      bests: {
        campaign: campaign.map((b) => ({ boardId: b.board_id, score: b.score, heartsLost: b.hearts_lost, moves: b.moves })),
        daily: dailyBest
          ? { date: dailyBest.date_key, boardId: dailyBest.board_id, score: dailyBest.score }
          : null,
      },
    });
  });

  app.patch("/v1/users/me", async (c) => {
    const user = await readUser(c);
    if (!user) return c.json({ error: "sign in required" }, 401);
    const body = await c.req.json().catch(() => null);
    const hasName = typeof body?.displayName === "string";
    const hasProgress = body?.progress !== undefined;
    if (!hasName && !hasProgress) {
      return c.json({ error: "displayName must be 2–20 characters" }, 400);
    }
    if (hasName) {
      const name = normalizeDisplayName(body.displayName);
      if (!name) {
        return c.json({ error: "displayName must be 2–20 characters" }, 400);
      }
      db.prepare("UPDATE users SET display_name = ?, name_customized = 1, seen_at = ? WHERE user_id = ?").run(
        name,
        nowIso(clock),
        user.user_id,
      );
    }
    let storedProgress = readProgressBlob(user);
    if (hasProgress) {
      const incoming = parseProgress(body.progress);
      if (!incoming) {
        return c.json({ error: "progress must be a campaign progress blob" }, 400);
      }
      storedProgress = mergeProgress(storedProgress, incoming);
      db.prepare("UPDATE users SET progress = ?, seen_at = ? WHERE user_id = ?").run(
        JSON.stringify(storedProgress),
        nowIso(clock),
        user.user_id,
      );
    }
    const fresh = userById.get(user.user_id) as UserRow;
    return c.json({ ...publicUser(fresh), progress: storedProgress });
  });

  app.get("/v1/daily/:date", (c) => {
    const date = c.req.param("date");
    if (!DATE_RE.test(date)) return c.json({ error: "date must be YYYY-MM-DD" }, 400);
    const boardId = getDailyLevelId(new Date(`${date}T12:00:00.000Z`));
    return c.json({ date, boardId });
  });

  app.post("/v1/scores", async (c) => {
    const user = await readUser(c);
    if (!user) return c.json({ error: "sign in required" }, 401);
    const body = await c.req.json().catch(() => null);
    const boardId = typeof body?.boardId === "string" ? body.boardId : "";
    const mode = body?.mode;
    if (mode !== "campaign" && mode !== "daily" && mode !== "league") {
      return c.json({ error: "mode must be campaign, daily, or league" }, 400);
    }
    let board;
    try {
      board = getLevel(boardId);
    } catch {
      return c.json({ error: "unknown board" }, 400);
    }

    const hourAgo = new Date(clock().getTime() - 3_600_000).toISOString();
    const recent = db
      .prepare("SELECT COUNT(*) AS n FROM score_attempts WHERE user_id = ? AND board_id = ? AND created_at >= ?")
      .get(user.user_id, boardId, hourAgo) as { n: number };
    if (recent.n >= RATE_LIMIT) {
      return c.json({ error: "too many score submits for this board" }, 429);
    }
    db.prepare("INSERT INTO score_attempts (id, user_id, board_id, created_at) VALUES (?, ?, ?, ?)").run(
      randomUUID(),
      user.user_id,
      boardId,
      nowIso(clock),
    );

    const replayed = replayMoveLog(board, body?.moveLog);
    if (!replayed.ok) {
      return c.json({ error: replayed.reason }, 400);
    }

    const hints = Number.isFinite(body?.hints) ? Math.max(0, Math.floor(Number(body.hints))) : 0;
    const elapsedMs = Number.isFinite(body?.elapsedMs) ? Math.max(0, Math.floor(Number(body.elapsedMs))) : 0;
    const extraMoves = Math.max(0, replayed.moves - replayed.pieceCount);
    const score = computeScore({
      heartsLeft: replayed.heartsLeft,
      moves: replayed.moves,
      hints,
      elapsedMs,
      pieceCount: replayed.pieceCount,
    });

    const week = isoWeek(clock());
    const today = utcDateKey(clock());
    const dateKey = mode === "daily" ? (typeof body?.date === "string" && DATE_RE.test(body.date) ? body.date : today) : "";
    let seasonId = "";
    if (mode === "league") {
      const season = ensureSeason(db, clock);
      seasonId = season.season_id;
      assignBucket(db, user.user_id, seasonId, clock);
    }

    const nextStreak = applyStreak(user, today);
    db.prepare("UPDATE users SET streak = ?, last_win_utc = ?, seen_at = ? WHERE user_id = ?").run(
      nextStreak.streak,
      nextStreak.lastWinUtc,
      nowIso(clock),
      user.user_id,
    );

    const existing = db
      .prepare("SELECT * FROM scores WHERE user_id = ? AND board_id = ? AND mode = ? AND date_key = ? AND season_id = ?")
      .get(user.user_id, boardId, mode, dateKey, seasonId) as ScoreRow | undefined;

    const incoming: ScoreRow = {
      id: existing?.id ?? randomUUID(),
      user_id: user.user_id,
      board_id: boardId,
      mode,
      date_key: dateKey,
      season_id: seasonId,
      hearts_left: replayed.heartsLeft,
      hearts_lost: replayed.heartsLost,
      moves: replayed.moves,
      hints,
      elapsed_ms: elapsedMs,
      extra_moves: extraMoves,
      score,
      created_at: nowIso(clock),
    };

    const better =
      !existing ||
      compareStandings(
        { ...incoming, userId: incoming.user_id },
        { ...existing, userId: existing.user_id },
      ) < 0;

    if (better) {
      if (existing) {
        db.prepare(
          `UPDATE scores SET hearts_left=?, hearts_lost=?, moves=?, hints=?, elapsed_ms=?, extra_moves=?, score=?, created_at=?
           WHERE id=?`,
        ).run(
          incoming.hearts_left,
          incoming.hearts_lost,
          incoming.moves,
          incoming.hints,
          incoming.elapsed_ms,
          incoming.extra_moves,
          incoming.score,
          incoming.created_at,
          existing.id,
        );
      } else {
        db.prepare(
          `INSERT INTO scores (id, user_id, board_id, mode, date_key, season_id, hearts_left, hearts_lost, moves, hints, elapsed_ms, extra_moves, score, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          incoming.id,
          incoming.user_id,
          incoming.board_id,
          incoming.mode,
          incoming.date_key,
          incoming.season_id,
          incoming.hearts_left,
          incoming.hearts_lost,
          incoming.moves,
          incoming.hints,
          incoming.elapsed_ms,
          incoming.extra_moves,
          incoming.score,
          incoming.created_at,
        );
      }
    }

    const kept = better ? incoming : (existing as ScoreRow);
    return c.json({
      accepted: true,
      best: better,
      score: kept.score,
      heartsLost: kept.hearts_lost,
      moves: kept.moves,
      elapsedMs: kept.elapsed_ms,
      streak: nextStreak.streak,
    });
  });

  app.get("/v1/scores/daily/:date", async (c) => {
    const date = c.req.param("date");
    if (!DATE_RE.test(date)) return c.json({ error: "date must be YYYY-MM-DD" }, 400);
    const boardId = getDailyLevelId(new Date(`${date}T12:00:00.000Z`));
    const rows = db.prepare("SELECT * FROM scores WHERE mode = 'daily' AND date_key = ?").all(date) as ScoreRow[];
    const ranked = rankRows(rows);
    const me = await readUser(c);
    const mine = me ? ranked.find((r) => r.user_id === me.user_id) : undefined;
    const names = new Map(
      (db.prepare("SELECT user_id, display_name FROM users").all() as Array<{ user_id: string; display_name: string }>).map(
        (u) => [u.user_id, u.display_name],
      ),
    );
    const toEntry = (row: ScoreRow & { rank: number }) => ({
      rank: row.rank,
      userId: row.user_id,
      displayName: names.get(row.user_id) ?? displayNameFromInstallId(row.user_id),
      score: row.score,
      heartsLost: row.hearts_lost,
      moves: row.moves,
      elapsedMs: row.elapsed_ms,
    });
    return c.json({
      date,
      boardId,
      top: ranked.slice(0, TOP_N).map(toEntry),
      me: mine ? toEntry(mine) : null,
    });
  });

  app.get("/v1/leagues/current", async (c) => {
    const user = await readUser(c);
    if (!user) return c.json({ error: "sign in required" }, 401);
    const week = isoWeek(clock());
    const season = ensureSeason(db, clock);
    const bucketIndex = assignBucket(db, user.user_id, season.season_id, clock);
    const bucket = db
      .prepare("SELECT member_count FROM league_buckets WHERE season_id = ? AND bucket_index = ?")
      .get(season.season_id, bucketIndex) as { member_count: number };
    const rows = db
      .prepare(
        "SELECT * FROM scores WHERE mode = 'league' AND season_id = ? AND user_id IN (SELECT user_id FROM league_members WHERE season_id = ? AND bucket_index = ?)",
      )
      .all(season.season_id, season.season_id, bucketIndex) as ScoreRow[];
    const mine = rankRows(rows).find((r) => r.user_id === user.user_id);
    return c.json({
      seasonId: season.season_id,
      weekLabel: week.weekLabel,
      endsIn: formatEndsIn(new Date(season.closes_at), clock()),
      boardId: season.board_id,
      bucketIndex,
      memberCount: bucket.member_count,
      closesAt: season.closes_at,
      rank: mine?.rank ?? null,
    });
  });

  app.get("/v1/leagues/current/standings", async (c) => {
    const user = await readUser(c);
    if (!user) return c.json({ error: "sign in required" }, 401);
    const week = isoWeek(clock());
    const season = ensureSeason(db, clock);
    const bucketIndex = assignBucket(db, user.user_id, season.season_id, clock);
    const members = db
      .prepare("SELECT user_id FROM league_members WHERE season_id = ? AND bucket_index = ?")
      .all(season.season_id, bucketIndex) as Array<{ user_id: string }>;
    const rows = db
      .prepare(
        "SELECT * FROM scores WHERE mode = 'league' AND season_id = ? AND user_id IN (SELECT user_id FROM league_members WHERE season_id = ? AND bucket_index = ?)",
      )
      .all(season.season_id, season.season_id, bucketIndex) as ScoreRow[];
    const ranked = rankRows(rows);
    const names = new Map(
      (db.prepare("SELECT user_id, display_name FROM users").all() as Array<{ user_id: string; display_name: string }>).map(
        (u) => [u.user_id, u.display_name],
      ),
    );
    const scored = new Set(ranked.map((r) => r.user_id));
    const entries = [
      ...ranked.map((row) => ({
        rank: row.rank,
        userId: row.user_id,
        displayName: names.get(row.user_id) ?? displayNameFromInstallId(row.user_id),
        score: row.score,
        heartsLost: row.hearts_lost,
        moves: row.moves,
        elapsedMs: row.elapsed_ms,
        me: row.user_id === user.user_id,
      })),
      ...members
        .filter((m) => !scored.has(m.user_id))
        .map((m) => ({
          rank: null as number | null,
          userId: m.user_id,
          displayName: names.get(m.user_id) ?? displayNameFromInstallId(m.user_id),
          score: null as number | null,
          heartsLost: null as number | null,
          moves: null as number | null,
          elapsedMs: null as number | null,
          me: m.user_id === user.user_id,
        })),
    ];
    return c.json({
      seasonId: season.season_id,
      weekLabel: week.weekLabel,
      bucketIndex,
      boardId: season.board_id,
      entries,
    });
  });

  return app;
}
