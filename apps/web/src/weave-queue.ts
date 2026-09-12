/** One-at-a-time weave lock with a single queued tap. */
export type WeaveLock = {
  flyingId: string | null;
  pendingId: string | null;
};

export const IDLE_WEAVE: WeaveLock = { flyingId: null, pendingId: null };

export function isWeaving(lock: WeaveLock): boolean {
  return lock.flyingId != null;
}

/**
 * Hit-test while a weave may be playing.
 * - Idle: start that id immediately.
 * - Same as the in-flight piece: ignore.
 * - Other id: replace the single pending slot (no extra debounce).
 */
export function acceptTap(
  lock: WeaveLock,
  hitId: string | null,
): { action: "start" | "queue" | "ignore"; lock: WeaveLock } {
  if (!hitId) return { action: "ignore", lock };
  if (lock.flyingId === hitId) return { action: "ignore", lock };
  if (lock.flyingId) {
    return { action: "queue", lock: { flyingId: lock.flyingId, pendingId: hitId } };
  }
  return { action: "start", lock: { flyingId: hitId, pendingId: null } };
}

/** After the current tween commits, start the pending id if it is still on the board. */
export function takeQueued(
  lock: WeaveLock,
  onBoard: (id: string) => boolean,
): { startId: string | null; lock: WeaveLock } {
  const id = lock.pendingId;
  if (id && onBoard(id)) {
    return { startId: id, lock: { flyingId: id, pendingId: null } };
  }
  return { startId: null, lock: IDLE_WEAVE };
}
