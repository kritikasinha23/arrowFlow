import { describe, expect, it } from "vitest";
import { IDLE_WEAVE, acceptTap, isWeaving, takeQueued } from "./weave-queue";

describe("acceptTap", () => {
  it("starts a weave when idle", () => {
    const next = acceptTap(IDLE_WEAVE, "A");
    expect(next).toEqual({ action: "start", lock: { flyingId: "A", pendingId: null } });
    expect(isWeaving(next.lock)).toBe(true);
  });

  it("queues a different arrow while one is flying", () => {
    const flying = { flyingId: "A", pendingId: null };
    const next = acceptTap(flying, "B");
    expect(next).toEqual({ action: "queue", lock: { flyingId: "A", pendingId: "B" } });
  });

  it("replaces the single pending slot", () => {
    const next = acceptTap({ flyingId: "A", pendingId: "B" }, "C");
    expect(next).toEqual({ action: "queue", lock: { flyingId: "A", pendingId: "C" } });
  });

  it("ignores taps on the piece currently in flight", () => {
    const flying = { flyingId: "A", pendingId: "B" };
    expect(acceptTap(flying, "A")).toEqual({ action: "ignore", lock: flying });
  });

  it("ignores empty hit-tests", () => {
    const flying = { flyingId: "A", pendingId: "B" };
    expect(acceptTap(flying, null)).toEqual({ action: "ignore", lock: flying });
    expect(acceptTap(IDLE_WEAVE, null)).toEqual({ action: "ignore", lock: IDLE_WEAVE });
  });
});

describe("takeQueued", () => {
  it("starts the pending weave after commit if the id is still on the board", () => {
    const next = takeQueued({ flyingId: "A", pendingId: "B" }, (id) => id === "B");
    expect(next).toEqual({ startId: "B", lock: { flyingId: "B", pendingId: null } });
  });

  it("drops a pending id that left the board", () => {
    const next = takeQueued({ flyingId: "A", pendingId: "B" }, () => false);
    expect(next).toEqual({ startId: null, lock: IDLE_WEAVE });
  });

  it("returns idle when nothing was queued", () => {
    expect(takeQueued({ flyingId: "A", pendingId: null }, () => true)).toEqual({
      startId: null,
      lock: IDLE_WEAVE,
    });
  });
});
