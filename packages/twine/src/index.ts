export type Point = { x: number; y: number };

export type GridPoint = { row: number; col: number };

export type Direction = "up" | "down" | "left" | "right";

export type WeaveAnimKind = "free" | "blocked";

export const HIT_WIDTH_PX = 32;
export const STROKE_WIDTH_PX = 3.25;

export const DIR_DELTA: Record<Direction, GridPoint> = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
};

export function exitRayCells(
  head: GridPoint,
  direction: Direction,
  width: number,
  height: number,
): GridPoint[] {
  const d = DIR_DELTA[direction];
  const ray: GridPoint[] = [];
  let row = head.row + d.row;
  let col = head.col + d.col;
  while (row >= 0 && col >= 0 && row < height && col < width) {
    ray.push({ row, col });
    row += d.row;
    col += d.col;
  }
  return ray;
}

export function weaveCells(cells: GridPoint[], exitRay: GridPoint[]): GridPoint[] {
  return [...cells, ...exitRay];
}

export function cellCenters(
  cells: GridPoint[],
  cellCenter: (cell: GridPoint) => Point,
): Point[] {
  return cells.map(cellCenter);
}

export function headingUnit(direction: Direction): Point {
  const d = DIR_DELTA[direction];
  return { x: d.col, y: d.row };
}

export function translatePoints(points: Point[], dx: number, dy: number): Point[] {
  return points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

export type BoardBox = {
  minRow?: number;
  minCol?: number;
  maxRow?: number;
  maxCol?: number;
  width?: number;
  height?: number;
};

function boardBox(bounds: BoardBox): { minRow: number; minCol: number; maxRow: number; maxCol: number } {
  const minRow = bounds.minRow ?? 0;
  const minCol = bounds.minCol ?? 0;
  return {
    minRow,
    minCol,
    maxRow: bounds.maxRow ?? minRow + Math.max(1, bounds.height ?? 1) - 1,
    maxCol: bounds.maxCol ?? minCol + Math.max(1, bounds.width ?? 1) - 1,
  };
}

export type ViewRect = { x: number; y: number; w: number; h: number };

/** Extra px past the view AABB so the stroke + cap fully leave the clip. */
export const VIEW_CLEAR_PAD_PX = 18;

export const FREE_WEAVE_MS_MIN = 900;
export const FREE_WEAVE_MS_MAX = 1400;

/** Cells the head must travel along heading to clear the fitted AABB. */
export function headingClearCells(
  head: GridPoint,
  direction: Direction,
  widthOrBounds: number | BoardBox,
  height = 1,
): number {
  const box =
    typeof widthOrBounds === "number"
      ? boardBox({ width: widthOrBounds, height })
      : boardBox(widthOrBounds);
  switch (direction) {
    case "right":
      return Math.max(1, box.maxCol + 1 - head.col);
    case "left":
      return Math.max(1, head.col - box.minCol + 1);
    case "down":
      return Math.max(1, box.maxRow + 1 - head.row);
    case "up":
      return Math.max(1, head.row - box.minRow + 1);
  }
}

/**
 * Head travel (in cells) so the whole thread window leaves the initial AABB.
 * Rest length L plus the heading clearance — the tail follows G, not a rigid box.
 */
export function offBoardTravelCells(
  cells: GridPoint[],
  direction: Direction,
  widthOrBounds: number | BoardBox,
  height = 1,
): number {
  if (cells.length === 0) return 1;
  const head = cells[cells.length - 1];
  const restCells = Math.max(1, cells.length - 1);
  return restCells + headingClearCells(head, direction, widthOrBounds, height);
}

/** Distance from `head` along heading to the far side of `view` plus pad. */
export function headingClearPx(
  head: Point,
  direction: Direction,
  view: ViewRect,
  pad = VIEW_CLEAR_PAD_PX,
): number {
  switch (direction) {
    case "right":
      return Math.max(1, view.x + view.w + pad - head.x);
    case "left":
      return Math.max(1, head.x - view.x + pad);
    case "down":
      return Math.max(1, view.y + view.h + pad - head.y);
    case "up":
      return Math.max(1, head.y - view.y + pad);
  }
}

/**
 * Groove travel so the constant-length window (tail included) leaves `view`.
 * L along G, then heading clearance to the view AABB + pad — not the grid box.
 */
export function viewClearTravelPx(
  rest: Point[],
  direction: Direction,
  view: ViewRect,
  pad = VIEW_CLEAR_PAD_PX,
): number {
  if (rest.length === 0) return 1;
  const head = rest[rest.length - 1];
  const restLen = Math.max(1, polylineLength(rest));
  return restLen + headingClearPx(head, direction, view, pad);
}

/** Far-edge clip of a heading ray against the current view/canvas AABB. */
export function clipHeadingToView(head: Point, direction: Direction, view: ViewRect): Point {
  const d = headingUnit(direction);
  const x0 = view.x;
  const y0 = view.y;
  const x1 = view.x + view.w;
  const y1 = view.y + view.h;
  let t = Infinity;
  if (d.x > 0) t = Math.min(t, (x1 - head.x) / d.x);
  else if (d.x < 0) t = Math.min(t, (x0 - head.x) / d.x);
  if (d.y > 0) t = Math.min(t, (y1 - head.y) / d.y);
  else if (d.y < 0) t = Math.min(t, (y0 - head.y) / d.y);
  if (!Number.isFinite(t) || t <= 0) return { x: head.x, y: head.y };
  return { x: head.x + d.x * t, y: head.y + d.y * t };
}

export function pointInRect(p: Point, view: ViewRect, pad = 0): boolean {
  return (
    p.x >= view.x - pad &&
    p.x <= view.x + view.w + pad &&
    p.y >= view.y - pad &&
    p.y <= view.y + view.h + pad
  );
}

export function polylineOutsideRect(points: Point[], view: ViewRect, pad = 0): boolean {
  return points.length === 0 || points.every((p) => !pointInRect(p, view, pad));
}

/** Ease-in-out free exit: longer pieces / farther view clearance take longer. */
export function freeWeaveDurationMs(restLen: number, travel: number): number {
  const span = Math.max(0, restLen) + Math.max(0, travel);
  const u = Math.max(0, Math.min(1, (span - 120) / 1400));
  return Math.round(FREE_WEAVE_MS_MIN + (FREE_WEAVE_MS_MAX - FREE_WEAVE_MS_MIN) * u);
}

/** Cells to slide the head until it kisses the first foreign ray cell. */
export function blockedTravelCells(rayIndex: number): number {
  return Math.max(0.4, Math.max(0, rayIndex) + 0.82);
}

export function slideTravelPx(args: {
  kind: WeaveAnimKind;
  cells: GridPoint[];
  direction: Direction;
  width: number;
  height: number;
  cellSize: number;
  rayIndex?: number;
  bounds?: BoardBox;
  rest?: Point[];
  view?: ViewRect;
  pad?: number;
}): number {
  if (args.kind === "blocked") {
    return blockedTravelCells(args.rayIndex ?? 0) * args.cellSize;
  }
  if (args.rest && args.view) {
    return viewClearTravelPx(args.rest, args.direction, args.view, args.pad);
  }
  return (
    offBoardTravelCells(
      args.cells,
      args.direction,
      args.bounds ?? { width: args.width, height: args.height },
    ) * args.cellSize
  );
}

export function extendOffboard(
  points: Point[],
  direction: Direction,
  cellSize: number,
  extra = 1.35,
): Point[] {
  if (points.length === 0) return points;
  const tip = points[points.length - 1];
  const d = DIR_DELTA[direction];
  return [
    ...points,
    {
      x: tip.x + d.col * cellSize * extra,
      y: tip.y + d.row * cellSize * extra,
    },
  ];
}

export function polylineLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += dist(points[i - 1], points[i]);
  }
  return len;
}

export function dist(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

export function pointAlongPolyline(points: Point[], s: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1 || s <= 0) return points[0];
  let remaining = s;
  for (let i = 1; i < points.length; i++) {
    const seg = dist(points[i - 1], points[i]);
    if (remaining <= seg) {
      const t = seg === 0 ? 0 : remaining / seg;
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
      };
    }
    remaining -= seg;
  }
  return points[points.length - 1];
}

/** Visible thread after unspooling `s` units from the tail toward the head. */
export function trimFromTail(points: Point[], s: number): Point[] {
  if (points.length === 0) return [];
  const total = polylineLength(points);
  if (s <= 0) return points.slice();
  if (s >= total) return [];
  return slicePolyline(points, s, total);
}

/** Inclusive slice of a polyline between arc-length `startS` and `endS`. */
export function slicePolyline(points: Point[], startS: number, endS: number): Point[] {
  if (points.length === 0) return [];
  const total = polylineLength(points);
  const a = Math.max(0, Math.min(startS, total));
  const b = Math.max(0, Math.min(endS, total));
  if (b <= a + 1e-9) return [];
  if (points.length === 1) return [{ x: points[0].x, y: points[0].y }];
  const startPt = pointAlongPolyline(points, a);
  const endPt = pointAlongPolyline(points, b);
  const out: Point[] = [startPt];
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const seg = dist(points[i - 1], points[i]);
    const next = acc + seg;
    if (next > a + 1e-6 && next < b - 1e-6) {
      out.push({ x: points[i].x, y: points[i].y });
    }
    acc = next;
  }
  const last = out[out.length - 1];
  if (!last || dist(last, endPt) > 1e-6) out.push(endPt);
  return out;
}

export function headingFromSegment(a: Point, b: Point): Direction {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "down" : "up";
}

function clamp01(progress: number): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  return progress;
}

/**
 * Groove G = rest polyline (tail → head) then the heading ray of empty /
 * off-board points. The thread slides on G; it is not a rigid body.
 */
export function buildGroove(rest: Point[], direction: Direction, travel: number): Point[] {
  if (rest.length === 0) return [];
  const copy = rest.map((pt) => ({ x: pt.x, y: pt.y }));
  if (travel <= 1e-9) return copy;
  const tip = copy[copy.length - 1];
  const d = headingUnit(direction);
  return [...copy, { x: tip.x + d.x * travel, y: tip.y + d.y * travel }];
}

/**
 * Visible stroke at progress p: a window of rest length L along G, head at
 * the front. Corners unbend as the tail follows the groove. Length stays L
 * until the tail runs out of G at the end of the exit, then it shortens.
 */
export function progressToVisiblePath(
  polyline: Point[],
  progress: number,
  direction: Direction = "right",
  travel = 0,
): Point[] {
  if (polyline.length === 0) return [];
  const p = clamp01(progress);
  if (p <= 0 || travel <= 0) return polyline.map((pt) => ({ x: pt.x, y: pt.y }));
  const restLen = polylineLength(polyline);
  const groove = buildGroove(polyline, direction, travel);
  const gLen = polylineLength(groove);
  const headS = Math.min(gLen, restLen + p * travel);
  const tailS = Math.max(0, headS - restLen);
  return slicePolyline(groove, tailS, headS);
}

/** Head is the front of the thread window, travelling along the heading ray. */
export function headPointAtProgress(
  polyline: Point[],
  progress: number,
  direction: Direction = "right",
  travel = 0,
): Point {
  if (polyline.length === 0) return { x: 0, y: 0 };
  const tip = polyline[polyline.length - 1];
  const p = clamp01(progress);
  if (p <= 0 || travel <= 0) return { x: tip.x, y: tip.y };
  const restLen = polylineLength(polyline);
  const groove = buildGroove(polyline, direction, travel);
  return pointAlongPolyline(groove, Math.min(polylineLength(groove), restLen + p * travel));
}

/**
 * Fraction of `slideTravelPx` to use. Travel already encodes the stop
 * (off-board vs first foreign cell), so both kinds run 0→1.
 */
export function unweaveStopProgress(_kind: WeaveAnimKind): number {
  return 1;
}

export function buildRoundedStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  joinRadius: number,
): void {
  if (points.length === 0) return;
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, 1.2, 0, Math.PI * 2);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const inLen = dist(prev, curr);
    const outLen = dist(curr, next);
    const r = Math.min(joinRadius, inLen * 0.45, outLen * 0.45);
    if (r < 0.5) {
      ctx.lineTo(curr.x, curr.y);
      continue;
    }
    const a = {
      x: curr.x + ((prev.x - curr.x) / inLen) * r,
      y: curr.y + ((prev.y - curr.y) / inLen) * r,
    };
    const b = {
      x: curr.x + ((next.x - curr.x) / outLen) * r,
      y: curr.y + ((next.y - curr.y) / outLen) * r,
    };
    ctx.lineTo(a.x, a.y);
    ctx.quadraticCurveTo(curr.x, curr.y, b.x, b.y);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
}

export function drawTriangleHead(
  ctx: CanvasRenderingContext2D,
  tip: Point,
  direction: Direction,
  size: number,
  fill: string,
): void {
  const d = DIR_DELTA[direction];
  const nx = -d.row;
  const ny = d.col;
  const backX = tip.x - d.col * size;
  const backY = tip.y - d.row * size;
  const half = size * 0.55;
  ctx.beginPath();
  ctx.moveTo(tip.x + d.col * size * 0.15, tip.y + d.row * size * 0.15);
  ctx.lineTo(backX + nx * half, backY + ny * half);
  ctx.lineTo(backX - nx * half, backY - ny * half);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function hitTestFatPolyline(
  points: Point[],
  x: number,
  y: number,
  width = HIT_WIDTH_PX,
): boolean {
  if (points.length === 0) return false;
  const half = width / 2;
  if (points.length === 1) {
    return dist(points[0], { x, y }) <= half;
  }
  for (let i = 1; i < points.length; i++) {
    if (distToSegment({ x, y }, points[i - 1], points[i]) <= half) return true;
  }
  return false;
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

export type WeavePresetName = "WeaveFree" | "WeaveBlocked" | "HeartLoss" | "UndoRestore";

export type WeavePreset = {
  name: WeavePresetName;
  durationMs: number;
  reverseMs: number;
  ease: (t: number) => number;
};

const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

const easeOut = (t: number): number => 1 - Math.pow(1 - t, 2);

/** Linger briefly, then ease-in-out. Stays in [0, 1]; duration unchanged. */
const easeAnticipate = (t: number): number => {
  const hold = 0.1;
  if (t <= hold) return t * t * 0.35;
  const u = (t - hold) / (1 - hold);
  return 0.0035 + 0.9965 * easeInOut(u);
};

export const PRESETS: Record<WeavePresetName, WeavePreset> = {
  WeaveFree: { name: "WeaveFree", durationMs: 1100, reverseMs: 0, ease: easeInOut },
  WeaveBlocked: { name: "WeaveBlocked", durationMs: 480, reverseMs: 320, ease: easeInOut },
  HeartLoss: { name: "HeartLoss", durationMs: 220, reverseMs: 0, ease: easeOut },
  UndoRestore: { name: "UndoRestore", durationMs: 180, reverseMs: 0, ease: easeInOut },
};

export type WeaveAnimState = {
  id: string;
  kind: WeaveAnimKind;
  /** 0..1 eased thread-window progress along the groove (1 = full travel). */
  trim: number;
  /** 0..1 overall clock including reverse. */
  t: number;
  done: boolean;
};

export function reducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function presetDuration(preset: WeavePreset): { go: number; back: number } {
  const scale = reducedMotion() ? 0.32 : 1;
  return { go: Math.max(90, preset.durationMs * scale), back: Math.max(80, preset.reverseMs * scale) };
}

/**
 * Thread-window along G. Free: 0→1 (900–1400ms, view-clear travel), then commit.
 * Blocked: pull toward the first foreign cell, reverse to rest, then commit.
 */
export function createWeaveTicker(
  kind: WeaveAnimKind,
  progressStop: number,
  onFrame: (state: Omit<WeaveAnimState, "id">) => void,
  onDone: () => void,
  opts?: { durationMs?: number },
): { cancel: () => void } {
  const preset = kind === "free" ? PRESETS.WeaveFree : PRESETS.WeaveBlocked;
  const durationMs =
    kind === "free" && opts?.durationMs != null
      ? Math.min(FREE_WEAVE_MS_MAX, Math.max(FREE_WEAVE_MS_MIN, opts.durationMs))
      : preset.durationMs;
  const { go, back } = presetDuration({ ...preset, durationMs });
  const stop = kind === "free" ? 1 : Math.max(0.12, Math.min(1, progressStop));
  let raf = 0;
  let cancelled = false;
  const t0 = performance.now();

  const tick = (now: number) => {
    if (cancelled) return;
    const elapsed = now - t0;
    if (kind === "free") {
      const u = Math.min(1, elapsed / go);
      const trim = preset.ease(u);
      const done = u >= 1;
      onFrame({ kind, trim, t: u, done });
      if (done) {
        onDone();
        return;
      }
      raf = requestAnimationFrame(tick);
      return;
    }
    if (elapsed <= go) {
      const u = Math.min(1, elapsed / go);
      onFrame({ kind, trim: stop * preset.ease(u), t: u * 0.5, done: false });
      raf = requestAnimationFrame(tick);
      return;
    }
    const rev = Math.min(1, (elapsed - go) / back);
    const trim = stop * (1 - PRESETS.WeaveBlocked.ease(rev));
    const done = rev >= 1;
    onFrame({ kind, trim, t: 0.5 + rev * 0.5, done });
    if (done) {
      onDone();
      return;
    }
    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
  return {
    cancel: () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    },
  };
}
