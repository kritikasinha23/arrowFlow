/** Concurrent weaves: no pending-tap queue. */

export type FlightKind = "free" | "blocked";

export type Flight = {
  id: string;
  kind: FlightKind;
};

/**
 * Hit-test while any number of weaves may be playing.
 * - Empty hit: ignore.
 * - Already flying (free ghost or blocked reverse): ignore.
 * - Any other remaining piece: start immediately.
 */
export function acceptTap(
  flights: Flight[],
  hitId: string | null,
): { action: "start" | "ignore" } {
  if (!hitId) return { action: "ignore" };
  if (flights.some((f) => f.id === hitId)) return { action: "ignore" };
  return { action: "start" };
}

/** Free weaves leave occupancy immediately; blocked stay until reverse commit. */
export function occupancyAfterWeave(ids: string[], id: string, kind: FlightKind): string[] {
  return kind === "free" ? ids.filter((x) => x !== id) : ids.slice();
}

export function beginFlight(flights: Flight[], id: string, kind: FlightKind): Flight[] {
  return [...flights.filter((f) => f.id !== id), { id, kind }];
}

export function endFlight(flights: Flight[], id: string): Flight[] {
  return flights.filter((f) => f.id !== id);
}

export function flyingIds(flights: Flight[]): string[] {
  return flights.map((f) => f.id);
}
