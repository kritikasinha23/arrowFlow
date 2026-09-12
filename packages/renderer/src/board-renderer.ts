import {
  HIT_WIDTH_PX,
  STROKE_WIDTH_PX,
  buildRoundedStroke,
  cellCenters,
  drawTriangleHead,
  exitRayCells,
  headPointAtProgress,
  hitTestFatPolyline,
  progressToVisiblePath,
  slideTravelPx,
  type Direction,
  type GridPoint,
  type Point,
  type WeaveAnimKind,
} from "@arrowflow/twine";
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
};

export type HeadingRay = {
  arrowId: string;
  from: GridPoint;
  cells: GridPoint[];
  accent: boolean;
};

/** Lattice dots: starting mask if provided, otherwise live occupancy. Always drawn. */
export function hashDots(frame: RenderFrame): GridPoint[] {
  return occupiedCells(frame.lattice ?? frame.arrows.flatMap((a) => a.cells));
}

function cellKey(cell: GridPoint): string {
  return `${cell.row},${cell.col}`;
}

/**
 * Heading ray per remaining arrow along `exitRay`. Stops at the first foreign
 * occupant (inclusive) or the declared board edge.
 */
export function headingRays(frame: RenderFrame): HeadingRay[] {
  const occ = new Map<string, string>();
  for (const arrow of frame.arrows) {
    if (arrow.hidden) continue;
    for (const cell of arrow.cells) occ.set(cellKey(cell), arrow.id);
  }
  const rays: HeadingRay[] = [];
  for (const arrow of frame.arrows) {
    if (arrow.hidden) continue;
    const raw = exitRayCells(arrow.headCell, arrow.direction, frame.boardW, frame.boardH);
    const cells: GridPoint[] = [];
    for (const cell of raw) {
      cells.push(cell);
      const occupant = occ.get(cellKey(cell));
      if (occupant && occupant !== arrow.id) break;
    }
    rays.push({
      arrowId: arrow.id,
      from: { row: arrow.headCell.row, col: arrow.headCell.col },
      cells,
      accent: arrow.isRed || arrow.animKind === "blocked" || frame.selectedId === arrow.id,
    });
  }
  return rays;
}

const INK = "#16161f";
const RED = "#ff3b4e";
const PAPER = "#ffffff";
const DOT = "#c8cad6";
const TICK = "rgba(160, 164, 184, 0.35)";

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
  }

  hitTest(mapper: CoordinateMapper, arrows: RenderArrow[], x: number, y: number): string | null {
    for (let i = arrows.length - 1; i >= 0; i--) {
      const arrow = arrows[i];
      if (arrow.hidden) continue;
      const pts = this.restPoints(mapper, arrow);
      if (hitTestFatPolyline(pts, x, y, HIT_WIDTH_PX)) return arrow.id;
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
    for (const cell of dots) {
      const p = mapper.cellCenter(cell);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (linesAreOn(frame.lines)) this.drawHeadingRays(mapper, frame);
    ctx.restore();
  }

  private drawHeadingRays(mapper: CoordinateMapper, frame: RenderFrame): void {
    const ctx = this.ctx;
    const r = Math.max(1.05, mapper.screenCell * 0.038);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, mapper.screenCell * 0.035);
    ctx.setLineDash([2.1, 5.4]);
    for (const ray of headingRays(frame)) {
      const pts = [mapper.cellCenter(ray.from), ...ray.cells.map((cell) => mapper.cellCenter(cell))];
      if (pts.length < 2) continue;
      ctx.strokeStyle = ray.accent ? "rgba(255, 59, 78, 0.42)" : TICK;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.fillStyle = ray.accent ? "rgba(255, 59, 78, 0.38)" : DOT;
      for (const cell of ray.cells) {
        const p = mapper.cellCenter(cell);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.setLineDash([]);
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
            bounds: mapper.content,
          });
    const visible = progressToVisiblePath(rest, trim, arrow.direction, travel);
    if (visible.length === 0) return;
    const color = arrow.isRed || arrow.animKind === "blocked" ? RED : INK;
    const pulse = frame.hintId === arrow.id ? frame.hintPulse ?? 0 : 0;
    const alpha = pulse > 0 ? 0.55 + 0.45 * Math.sin(pulse * Math.PI * 2) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = STROKE_WIDTH_PX;
    buildRoundedStroke(ctx, visible, mapper.screenCell * 0.22);
    ctx.stroke();
    if (arrow.isRed) {
      if (!this.hatch) this.hatch = hatchPattern(ctx);
      if (this.hatch) {
        ctx.save();
        buildRoundedStroke(ctx, visible, mapper.screenCell * 0.22);
        ctx.lineWidth = HIT_WIDTH_PX * 0.45;
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
