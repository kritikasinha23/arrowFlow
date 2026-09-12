import {
  displayNameFromInstallId,
  isUglyGeneratedName,
  normalizeDisplayName,
} from "../../../packages/engine/src/names.ts";

const INSTALL_KEY = "arrowflow.installId";
const NAME_KEY = "arrowflow.displayName";
const CUSTOM_KEY = "arrowflow.nameCustomized";
const USER_KEY = "arrowflow.userId";
const TOKEN_KEY = "arrowflow.token";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function store(): StorageLike | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function newUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const n = (Math.random() * 16) | 0;
    return (ch === "x" ? n : (n & 0x3) | 0x8).toString(16);
  });
}

export function getOrCreateInstallId(storage: StorageLike | null = store()): string {
  if (!storage) return newUuid();
  const existing = storage.getItem(INSTALL_KEY);
  if (existing) return existing;
  const id = newUuid();
  storage.setItem(INSTALL_KEY, id);
  return id;
}

export function offlineDisplayName(storage: StorageLike | null = store()): string {
  const installId = getOrCreateInstallId(storage);
  const existing = storage?.getItem(NAME_KEY);
  const customized = storage?.getItem(CUSTOM_KEY) === "1";
  if (existing && (customized || !isUglyGeneratedName(existing))) return existing;
  const name = displayNameFromInstallId(installId);
  storage?.setItem(NAME_KEY, name);
  return name;
}

export function getDisplayName(storage: StorageLike | null = store()): string {
  return storage?.getItem(NAME_KEY) ?? offlineDisplayName(storage);
}

export function isNameCustomized(storage: StorageLike | null = store()): boolean {
  return storage?.getItem(CUSTOM_KEY) === "1";
}

export function setDisplayName(name: string, storage: StorageLike | null = store()): string {
  const next = normalizeDisplayName(name) ?? offlineDisplayName(storage);
  storage?.setItem(NAME_KEY, next);
  storage?.setItem(CUSTOM_KEY, "1");
  return next;
}

export function getUserId(storage: StorageLike | null = store()): string | null {
  return storage?.getItem(USER_KEY) ?? null;
}

export function getToken(storage: StorageLike | null = store()): string | null {
  return storage?.getItem(TOKEN_KEY) ?? null;
}

export function saveSession(
  session: { userId: string; displayName: string; token: string },
  storage: StorageLike | null = store(),
): void {
  storage?.setItem(USER_KEY, session.userId);
  storage?.setItem(NAME_KEY, session.displayName);
  storage?.setItem(TOKEN_KEY, session.token);
}
