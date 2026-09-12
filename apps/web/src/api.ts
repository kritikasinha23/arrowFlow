import type { ProgressV1 } from "../../../packages/levels/src/progress.ts";

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://127.0.0.1:8787";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Can't reach ArrowFlow right now");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? "Can't reach ArrowFlow right now");
  }
  return data;
}

export type GuestSession = {
  userId: string;
  displayName: string;
  token: string;
  streak: number;
};

export type Profile = GuestSession & {
  lastWinUtc?: string | null;
  league?: { seasonId: string; weekLabel: string; rank: number | null; score: number | null };
  bests?: {
    campaign: Array<{ boardId: string; score: number; heartsLost: number; moves: number }>;
    daily: { date: string; boardId: string; score: number } | null;
  };
  progress?: ProgressV1 | null;
};

export type LeagueCurrent = {
  seasonId: string;
  weekLabel: string;
  endsIn: string;
  boardId: string;
  bucketIndex: number;
  memberCount: number;
  closesAt: string;
  rank: number | null;
};

export type StandingRow = {
  rank: number | null;
  userId: string;
  displayName: string;
  score: number | null;
  heartsLost: number | null;
  moves: number | null;
  elapsedMs: number | null;
  me?: boolean;
};

export type DailyBoard = { date: string; boardId: string };

export type DailyScores = {
  date: string;
  boardId: string;
  top: Array<{
    rank: number;
    userId: string;
    displayName: string;
    score: number;
    heartsLost: number;
    moves: number;
    elapsedMs: number;
  }>;
  me: { rank: number; displayName: string; score: number } | null;
};

export function postGuest(installId: string) {
  return request<GuestSession>("/v1/users/guest", {
    method: "POST",
    body: JSON.stringify({ installId }),
  });
}

export function getMe(token: string) {
  return request<Profile>("/v1/users/me", {}, token);
}

export function patchMe(token: string, displayName: string) {
  return request<GuestSession>("/v1/users/me", {
    method: "PATCH",
    body: JSON.stringify({ displayName }),
  }, token);
}

export function patchProgress(token: string, progress: ProgressV1) {
  return request<{ progress: ProgressV1 }>("/v1/users/me", {
    method: "PATCH",
    body: JSON.stringify({ progress }),
  }, token);
}

export function getDaily(date: string) {
  return request<DailyBoard>(`/v1/daily/${date}`);
}

export function getDailyScores(date: string, token?: string | null) {
  return request<DailyScores>(`/v1/scores/daily/${date}`, {}, token);
}

export function getLeague(token: string) {
  return request<LeagueCurrent>("/v1/leagues/current", {}, token);
}

export function getStandings(token: string) {
  return request<{ seasonId: string; weekLabel: string; bucketIndex: number; boardId: string; entries: StandingRow[] }>(
    "/v1/leagues/current/standings",
    {},
    token,
  );
}

export type ScoreSubmit = {
  boardId: string;
  mode: "campaign" | "daily" | "league";
  date?: string;
  hints: number;
  elapsedMs: number;
  moveLog: Array<{ arrowId: string; tMs: number; result: "free" | "blocked" }>;
};

export function postScore(token: string, body: ScoreSubmit) {
  return request<{ accepted: boolean; score: number; streak: number }>("/v1/scores", {
    method: "POST",
    body: JSON.stringify(body),
  }, token);
}
