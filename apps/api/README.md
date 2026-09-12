# ArrowFlow API

Hono + TypeScript live-ops service. Persistence is a **SQLite file** at `apps/api/data/arrowflow.sqlite` (override with `ARROWFLOW_SQLITE`). Schema uses only `TEXT` / `INTEGER` so it can move to Postgres later.

## Run

From the repo root (Node 16+). This repo’s npm 8 workspaces choke on some optional native packages, so install API deps locally first:

```bash
npm install --no-workspaces --prefix ./apps/api
npm run dev:api
```

Or `node apps/api/scripts/run-dev.cjs` / `npm run dev` inside `apps/api`.

Listens on `http://127.0.0.1:8787`. In another terminal:

```bash
VITE_API_URL=http://127.0.0.1:8787 npm run dev --workspace @arrowflow/web
```

`apps/web` already defaults `VITE_API_URL` to that origin. Campaign play works if the API is down; Leagues and Challenge show “Can’t reach ArrowFlow right now.”

## Identity

1. Client creates `installId` (UUID v4) in `localStorage`. Never GAID / IDFA.
2. `POST /v1/users/guest` `{ installId }` upserts: mint `userId` + session `token` if new; assign `displayName` from the two-word generator keyed by `installId`.
3. Names are not unique. Rename with `PATCH /v1/users/me` (2–20 characters).
4. Two installs are two accounts. Apple / Google link is not in this release (no fake sign-in button).

## League buckets

Season id is the UTC ISO week (`2026-W37`). The season row stores one frozen packed `board_id`. Reset is Monday 00:00 UTC.

On first `GET /v1/leagues/current` or first league `POST /v1/scores` of the season:

- If the player already has a `league_members` row, keep that `bucket_index` (sticky).
- Else take the highest `bucket_index` for the season with `member_count < 30` and join it.
- Else insert `bucket_index + 1` and join that.
- v1 fill is sequential (first 30 in bucket 0, next 30 in bucket 1). `userId` is only a standings tie-break, not a reshuffle.

Standings are that bucket only. Rank is hearts lost (asc), then moves, then elapsed time. Published integer:

`score = 10000 + heartsLeft*400 − extraMoves*50 − hints*120 − floor(elapsedMs/1000)`

where `extraMoves = max(0, moves − pieceCount)`.

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/v1/users/guest` | Body `{ installId }` |
| GET | `/v1/users/me` | Bearer token; profile, streak, personal bests |
| PATCH | `/v1/users/me` | Rename |
| GET | `/v1/daily/:date` | Canonical challenge board |
| POST | `/v1/scores` | Replay `moveLog` with `PuzzleEngine` |
| GET | `/v1/scores/daily/:date` | Top 20 + me |
| GET | `/v1/leagues/current` | Season, bucket, board, `closesAt` |
| GET | `/v1/leagues/current/standings` | Bucket of ~30 |

Streak increments when a campaign, challenge, or league board is won on a **new UTC day**.

## Postgres later

Do not introduce Docker for local web. When you promote this service:

1. Swap `better-sqlite3` for `postgres` / `pg` (or Drizzle’s `postgres` driver) and a `DATABASE_URL`.
2. Keep the same table/column names. Prefer Postgres `uuid` for `user_id` / `install_id` (today they are `TEXT` UUIDs — a one-line type change).
3. Replace `score_attempts` time filters with `timestamptz` if you want native intervals; values are already ISO-8601 strings.
4. Dump SQLite and load with `COPY`, or replay guest upserts + scores through the HTTP API.

No SQLite-only JSON1 or blob hacks are used, so the migrate is driver + DSN, not a rewrite.
