import { describe, expect, it } from "vitest";
import { PuzzleEngine } from "./engine-bridge";
import { getBoard } from "./boards";
import {
  acceptTap,
  beginFlight,
  occupancyAfterWeave,
} from "./weave-queue";

describe("acceptTap", () => {
  it("starts a weave when nothing is flying", () => {
    expect(acceptTap([], "A")).toEqual({ action: "start" });
  });

  it("starts a different piece immediately while another is flying", () => {
    const flights = beginFlight([], "A", "free");
    expect(acceptTap(flights, "B")).toEqual({ action: "start" });
  });

  it("ignores re-taps on a free-escape ghost", () => {
    const flights = beginFlight([], "A", "free");
    expect(acceptTap(flights, "A")).toEqual({ action: "ignore" });
  });

  it("ignores a piece mid-blocked-reverse", () => {
    const flights = beginFlight([], "A", "blocked");
    expect(acceptTap(flights, "A")).toEqual({ action: "ignore" });
    expect(acceptTap(flights, "B")).toEqual({ action: "start" });
  });

  it("ignores empty hit-tests", () => {
    expect(acceptTap([], null)).toEqual({ action: "ignore" });
    expect(acceptTap([{ id: "A", kind: "free" }], null)).toEqual({ action: "ignore" });
  });

  it("does not blast mid-level on a piece or empty tap", () => {
    expect(acceptTap([], "A", false)).toEqual({ action: "start" });
    expect(acceptTap([], null, false)).toEqual({ action: "ignore" });
    expect(acceptTap([{ id: "A", kind: "free" }], "B", false).action).not.toBe("blast");
  });

  it("blasts at the tap when isWon and never starts a weave", () => {
    expect(acceptTap([], null, true)).toEqual({ action: "blast" });
    expect(acceptTap([], "A", true)).toEqual({ action: "blast" });
    expect(acceptTap([{ id: "A", kind: "free" }], "B", true)).toEqual({ action: "blast" });
  });
});

describe("occupancy timing", () => {
  it("drops a free piece from occupancy while its ghost is still animating", () => {
    const occ = occupancyAfterWeave(["A", "B"], "A", "free");
    expect(occ).toEqual(["B"]);
    expect(occ).not.toContain("A");
    expect(acceptTap([{ id: "A", kind: "free" }], "B").action).toBe("start");
  });

  it("keeps a blocked piece in occupancy until reverse commit", () => {
    expect(occupancyAfterWeave(["A", "B"], "A", "blocked")).toEqual(["A", "B"]);
  });

  it("second free tap commits while first ghost still animating", () => {
    const engine = new PuzzleEngine(getBoard("flow_0002"));
    expect(engine.tryWeave("B").kind).toBe("free");
    engine.commitFree("B");
    const occ = engine.board.arrows.map((a) => a.id);
    expect(occ).toEqual(["A"]);
    expect(occ).not.toContain("B");
    const flights = beginFlight([], "B", "free");
    expect(acceptTap(flights, "B").action).toBe("ignore");
    expect(acceptTap(flights, "A").action).toBe("start");
    expect(engine.tryWeave("A").kind).toBe("free");
    engine.commitFree("A");
    expect(engine.board.arrows.map((a) => a.id)).not.toContain("B");
    expect(engine.isWon).toBe(true);
  });
});
