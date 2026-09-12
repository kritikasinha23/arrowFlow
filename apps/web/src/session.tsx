import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getMe, patchMe, patchProgress, postGuest, type Profile } from "./api";
import { flushPendingScores } from "./scores";
import { normalizeDisplayName } from "../../../packages/engine/src/names.ts";
import { CAMPAIGN_START_ID } from "../../../packages/levels/src/catalog.ts";
import {
  getOrCreateInstallId,
  getToken,
  isNameCustomized,
  offlineDisplayName,
  saveSession,
  setDisplayName,
} from "./guest";
import { getStreak, mergeAndStoreProgress, readProgress, setStreak } from "./storage";

type SessionState = {
  installId: string;
  displayName: string;
  userId: string | null;
  token: string | null;
  streak: number;
  online: boolean;
  profile: Profile | null;
  ready: boolean;
  refresh: () => Promise<void>;
  rename: (name: string) => Promise<string | null>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [installId] = useState(() => getOrCreateInstallId());
  const [displayName, setName] = useState(() => offlineDisplayName());
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem("arrowflow.userId"));
  const [token, setToken] = useState<string | null>(() => getToken());
  const [streak, setStreakState] = useState(() => getStreak());
  const [online, setOnline] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const id = getOrCreateInstallId();
    const localName = offlineDisplayName();
    const localCustomized = isNameCustomized();
    setName(localName);
    try {
      let guest = await postGuest(id);
      if (localCustomized && localName && localName !== guest.displayName) {
        try {
          const updated = await patchMe(guest.token, localName);
          guest = { ...guest, displayName: updated.displayName };
        } catch {
          /* keep the upserted name if rename sync fails */
        }
      }
      saveSession(guest);
      setUserId(guest.userId);
      setToken(guest.token);
      setName(guest.displayName);
      setStreak(guest.streak);
      setStreakState(guest.streak);
      const me = await getMe(guest.token);
      if (me.progress) mergeAndStoreProgress(me.progress);
      const local = readProgress();
      if (local.completedIds.length > 0 || local.pendingScores.length > 0 || local.lastCampaignLevelId !== CAMPAIGN_START_ID) {
        try {
          const saved = await patchProgress(guest.token, local);
          if (saved.progress) mergeAndStoreProgress(saved.progress);
        } catch {
          /* local progress stays until the next successful sync */
        }
      }
      await flushPendingScores(guest.token);
      setProfile(me);
      setStreak(me.streak);
      setStreakState(me.streak);
      setName(me.displayName);
      setOnline(true);
    } catch {
      setOnline(false);
      setProfile(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rename = useCallback(async (raw: string) => {
    const next = normalizeDisplayName(raw);
    if (!next) return null;
    setDisplayName(next);
    setName(next);
    const t = getToken();
    if (!t) return next;
    try {
      const updated = await patchMe(t, next);
      saveSession(updated);
      setName(updated.displayName);
      setOnline(true);
      return updated.displayName;
    } catch {
      setOnline(false);
      return next;
    }
  }, []);

  const value = useMemo<SessionState>(
    () => ({
      installId,
      displayName,
      userId,
      token,
      streak,
      online,
      profile,
      ready,
      refresh,
      rename,
    }),
    [installId, displayName, userId, token, streak, online, profile, ready, refresh, rename],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    return {
      installId: getOrCreateInstallId(),
      displayName: offlineDisplayName(),
      userId: null,
      token: getToken(),
      streak: getStreak(),
      online: false,
      profile: null,
      ready: true,
      refresh: async () => undefined,
      rename: async (name) => setDisplayName(name),
    };
  }
  return ctx;
}
