import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/** Postgres-portable types: TEXT / INTEGER / no SQLite-only column types. */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  install_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  streak INTEGER NOT NULL DEFAULT 0,
  last_win_utc TEXT,
  created_at TEXT NOT NULL,
  seen_at TEXT NOT NULL,
  name_customized INTEGER NOT NULL DEFAULT 0,
  progress TEXT
);

CREATE TABLE IF NOT EXISTS seasons (
  season_id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  closes_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS league_buckets (
  season_id TEXT NOT NULL,
  bucket_index INTEGER NOT NULL,
  member_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (season_id, bucket_index)
);

CREATE TABLE IF NOT EXISTS league_members (
  season_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  bucket_index INTEGER NOT NULL,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (season_id, user_id)
);

CREATE TABLE IF NOT EXISTS scores (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  board_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  date_key TEXT NOT NULL DEFAULT '',
  season_id TEXT NOT NULL DEFAULT '',
  hearts_left INTEGER NOT NULL,
  hearts_lost INTEGER NOT NULL,
  moves INTEGER NOT NULL,
  hints INTEGER NOT NULL,
  elapsed_ms INTEGER NOT NULL,
  extra_moves INTEGER NOT NULL,
  score INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS scores_best_idx
  ON scores (user_id, board_id, mode, date_key, season_id);

CREATE TABLE IF NOT EXISTS score_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  board_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

export function defaultSqlitePath(): string {
  if (process.env.ARROWFLOW_SQLITE) return process.env.ARROWFLOW_SQLITE;
  return path.resolve(process.cwd(), "data", "arrowflow.sqlite");
}

export function openDatabase(filePath: string): Database.Database {
  if (filePath !== ":memory:") {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  const cols = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "name_customized")) {
    db.exec("ALTER TABLE users ADD COLUMN name_customized INTEGER NOT NULL DEFAULT 0");
  }
  if (!cols.some((c) => c.name === "progress")) {
    db.exec("ALTER TABLE users ADD COLUMN progress TEXT");
  }
  return db;
}
