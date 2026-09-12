import { describe, expect, it } from "vitest";
import { getBoard, UnknownLevelError } from "./boards";

describe("board lookup", () => {
  it("does not remap a missing id to flow_0015 or flow_0025", () => {
    expect(() => getBoard("flow_9999")).toThrow(UnknownLevelError);
    expect(() => getBoard("flow_9999")).toThrow(/Level unavailable/);
    try {
      getBoard("missing_level");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(UnknownLevelError);
      expect((error as UnknownLevelError).message).toBe("Level unavailable");
      expect((error as UnknownLevelError).levelId).toBe("missing_level");
    }
  });

  it("does not invent a default when the id is empty", () => {
    expect(() => getBoard("")).toThrow(UnknownLevelError);
    expect(() => getBoard("")).not.toThrow(/flow_0015|flow_0025/);
  });

  it("loads the requested catalog board", () => {
    expect(getBoard("flow_0001").levelId).toBe("flow_0001");
    expect(getBoard("flow_0015").levelId).toBe("flow_0015");
  });
});
