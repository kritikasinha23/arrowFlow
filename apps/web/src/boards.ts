import { getLevel, hasLevel } from "./levels-shim";
import type { BoardModel } from "./engine-bridge";

export class UnknownLevelError extends Error {
  readonly levelId: string;
  constructor(levelId: string) {
    super("Level unavailable");
    this.name = "UnknownLevelError";
    this.levelId = levelId;
  }
}

export function getBoard(levelId: string): BoardModel {
  if (!levelId || !hasLevel(levelId)) {
    throw new UnknownLevelError(levelId);
  }
  return getLevel(levelId);
}
