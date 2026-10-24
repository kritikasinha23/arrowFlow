import {
  HIT_WIDTH_PX,
  VIEW_CLEAR_PAD_PX,
  buildRoundedStroke,
  cellCenters,
  clipHeadingToView,
  drawTriangleHead,
  exitRayCells,
  headPointAtProgress,
  hitTestFatPolyline,
  progressToVisiblePath,
  slideTravelPx,
  type Direction,
  type GridPoint,
  type Point,
  type ViewRect,
  type WeaveAnimKind,
} from "@arrowflow/twine";
import { drawConfetti, latticeRipple, type WinFx } from "./celebration";
import { CoordinateMapper, linesAreOn, type LinesMode } from "./coordinate-mapper";
import { occupiedCells } from "./vacant";

export type RenderArrow = {
  id: string;
  cells: GridPoint[];
  direction: Direction;
  headCell: GridPoint;
  isRed: boolean;
  exitRay?: GridPoint[];
  rayIndex?: number;
  animKind?: WeaveAnimKind;
  /** 0 = rest, 1 = full heading travel. */
  trim?: number;
  hidden?: boolean;
  pulse?: number;
  /** Visual-only escape stroke; excluded from occupancy rays and hit-tests. */
  ghost?: boolean;
};

export type RenderFrame = {
  boardW: number;
  boardH: number;
  arrows: RenderArrow[];
  lines: LinesMode;
  /** Starting mask / occupied cells — lattice dots persist after exits. */
  lattice?: GridPoint[];
  hintId?: string | null;
  hintPulse?: number;
  selectedId?: string | null;
  winFx?: WinFx | null;
  tapFx?: WinFx[];
};

export type HeadingRay = {
  arrowId: string;
  from: GridPoint;
  cells: GridPoint[];
  direction: Direction;
  accent: boolean;
};

/** Lattice dots: starting mask if provided, otherwise live occupancy. Always drawn. */
export function hashDots(frame: RenderFrame): GridPoint[] {
  return occupiedCells(frame.lattice ?? frame.arrows.flatMap((a) => a.cells));
}

/**
 * Heading ray per remaining arrow. Cells list the on-board heading walk (does
 * not stop at the first occupant). The draw path continues to the view AABB.
 */
export function headingRays(frame: RenderFrame): HeadingRay[] {
  const rays: HeadingRay[] = [];
  for (const arrow of frame.arrows) {
    if (arrow.hidden || arrow.ghost) continue;
    rays.push({
      arrowId: arrow.id,
      from: { row: arrow.headCell.row, col: arrow.headCell.col },
      cells: exitRayCells(arrow.headCell, arrow.direction, frame.boardW, frame.boardH),
      direction: arrow.direction,
      accent: arrow.isRed,
    });
  }
  return rays;
}

function mapperViewRect(mapper: CoordinateMapper): ViewRect {
  return { x: 0, y: 0, w: mapper.cssWidth, h: mapper.cssHeight };
}

const INK = "#16161f";
const RED = "#ff3b4e";
const PAPER = "#ffffff";
const DOT = "#c8cad6";
const RAY = "124, 118, 168";
const RAY_RED = "255, 59, 78";

/** Keep stroke weight readable across board sizes without drowning small cells. */
function strokeWidthForCell(screenCell: number): number {
  return Math.min(7.5, Math.max(2.75, screenCell * 0.08));
}

function hitWidthForCell(screenCell: number): number {
  return Math.min(64, Math.max(HIT_WIDTH_PX * 0.9, screenCell * 0.58));
}

function hatchPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 8;
  const g = c.getContext("2d");
  if (!g) return null;
  g.strokeStyle = "rgba(255,59,78,0.55)";
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(-2, 6);
  g.lineTo(6, -2);
  g.moveTo(2, 10);
  g.lineTo(10, 2);
  g.stroke();
  return ctx.createPattern(c, "repeat");
}

export class BoardRenderer {
  private hatch: CanvasPattern | null = null;

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  draw(mapper: CoordinateMapper, frame: RenderFrame, dpr: number): void {
    const ctx = this.ctx;
    const { cssWidth, cssHeight } = mapper;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    this.drawGuides(mapper, frame);
    for (const arrow of frame.arrows) {
      if (arrow.hidden) continue;
      this.drawArrow(mapper, arrow, frame);
    }
    if (frame.winFx) drawConfetti(this.ctx, frame.winFx);
    for (const tap of frame.tapFx ?? []) drawConfetti(this.ctx, tap);
  }

  hitTest(mapper: CoordinateMapper, arrows: RenderArrow[], x: number, y: number): string | null {
    const hitW = hitWidthForCell(mapper.screenCell);
    for (let i = arrows.length - 1; i >= 0; i--) {
      const arrow = arrows[i];
      if (arrow.hidden || arrow.ghost) continue;
      const pts = this.restPoints(mapper, arrow);
      if (hitTestFatPolyline(pts, x, y, hitW)) return arrow.id;
    }
    return null;
  }

  hitCenter(mapper: CoordinateMapper, arrow: RenderArrow): Point {
    const mid = arrow.cells[Math.floor(arrow.cells.length / 2)] ?? arrow.headCell;
    return mapper.cellCenter(mid);
  }

  restPoints(mapper: CoordinateMapper, arrow: RenderArrow): Point[] {
    return cellCenters(arrow.cells, (c) => mapper.cellCenter(c));
  }

  private drawGuides(mapper: CoordinateMapper, frame: RenderFrame): void {
    const ctx = this.ctx;
    const dots = hashDots(frame);
    const r = Math.max(1.15, mapper.screenCell * 0.045);
    ctx.save();
    ctx.fillStyle = DOT;
    const fx = frame.winFx;
    for (const cell of dots) {
      const p = mapper.cellCenter(cell);
      const ripple = fx ? latticeRipple(fx.origin, p, fx.t, r) : { r, alpha: 1 };
      ctx.globalAlpha = ripple.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, ripple.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (linesAreOn(frame.lines)) this.drawHeadingRays(mapper, frame);
    ctx.restore();
  }

  private drawHeadingRays(mapper: CoordinateMapper, frame: RenderFrame): void {
    const ctx = this.ctx;
    const view = mapperViewRect(mapper);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = strokeWidthForCell(mapper.screenCell) * 0.92;
    for (const ray of headingRays(frame)) {
      const from = mapper.cellCenter(ray.from);
      const to = clipHeadingToView(from, ray.direction, view);
      if (Math.hypot(to.x - from.x, to.y - from.y) < 2) continue;
      const rgb = ray.accent ? RAY_RED : RAY;
      const grad = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
      grad.addColorStop(0, `rgba(${rgb}, 0.42)`);
      grad.addColorStop(0.55, `rgba(${rgb}, 0.22)`);
      grad.addColorStop(1, `rgba(${rgb}, 0.06)`);
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
  }

  private drawArrow(mapper: CoordinateMapper, arrow: RenderArrow, frame: RenderFrame): void {
    const ctx = this.ctx;
    const rest = this.restPoints(mapper, arrow);
    const trim = arrow.trim ?? 0;
    const travel =
      trim <= 0
        ? 0
        : slideTravelPx({
            kind: arrow.animKind ?? "free",
            cells: arrow.cells,
            direction: arrow.direction,
            width: frame.boardW,
            height: frame.boardH,
            cellSize: mapper.screenCell,
            rayIndex: arrow.rayIndex ?? 0,
            rest,
            view: mapperViewRect(mapper),
            pad: VIEW_CLEAR_PAD_PX,
          });
    const visible = progressToVisiblePath(rest, trim, arrow.direction, travel);
    if (visible.length === 0) return;
    const color = arrow.isRed || arrow.animKind === "blocked" ? RED : INK;
    const pulse = frame.hintId === arrow.id ? frame.hintPulse ?? 0 : 0;
    const alpha = pulse > 0 ? 0.55 + 0.45 * Math.sin(pulse * Math.PI * 2) : 1;
    const strokeW = strokeWidthForCell(mapper.screenCell);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeW;
    buildRoundedStroke(ctx, visible, mapper.screenCell * 0.22);
    ctx.stroke();
    if (arrow.isRed) {
      if (!this.hatch) this.hatch = hatchPattern(ctx);
      if (this.hatch) {
        ctx.save();
        buildRoundedStroke(ctx, visible, mapper.screenCell * 0.22);
        ctx.lineWidth = hitWidthForCell(mapper.screenCell) * 0.42;
        ctx.strokeStyle = this.hatch;
        ctx.globalAlpha = 0.35 * alpha;
        ctx.stroke();
        ctx.restore();
      }
    }
    const tip = headPointAtProgress(rest, trim, arrow.direction, travel);
    drawTriangleHead(ctx, tip, arrow.direction, mapper.screenCell * 0.26, color);
    ctx.restore();
  }
}
