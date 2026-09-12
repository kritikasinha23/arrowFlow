import { FIT_VIEW, type ContentBox, type ViewTransform } from "./viewport";
import type { GridAABB } from "./vacant";
import { boardBounds } from "./vacant";

export type GridPoint = { row: number; col: number };
export type Point = { x: number; y: number };
export type LinesMode = "off" | "on" | "subtle" | "full";
export type { ContentBox };

export function linesAreOn(mode: LinesMode): boolean {
  return mode !== "off";
}

export class CoordinateMapper {
  readonly width: number;
  readonly height: number;
  readonly pad: number;
  /** Unzoomed cell size used to fit occupied content. */
  readonly cell: number;
  readonly originX: number;
  readonly originY: number;
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly view: ViewTransform;
  readonly content: GridAABB;
  readonly cols: number;
  readonly rows: number;

  constructor(
    boardW: number,
    boardH: number,
    cssWidth: number,
    cssHeight: number,
    opts?: { padRatio?: number; view?: ViewTransform; content?: GridAABB },
  ) {
    this.width = boardW;
    this.height = boardH;
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    this.view = opts?.view ?? FIT_VIEW;
    const padRatio = opts?.padRatio ?? 0.1;
    const pad = Math.min(cssWidth, cssHeight) * padRatio;
    this.pad = pad;
    this.content = opts?.content ?? boardBounds(boardW, boardH);
    this.cols = Math.max(1, this.content.maxCol - this.content.minCol + 1);
    this.rows = Math.max(1, this.content.maxRow - this.content.minRow + 1);
    const innerW = cssWidth - pad * 2;
    const innerH = cssHeight - pad * 2;
    this.cell = Math.min(innerW / this.cols, innerH / this.rows);
    const usedW = this.cell * this.cols;
    const usedH = this.cell * this.rows;
    this.originX = (cssWidth - usedW) / 2 - this.content.minCol * this.cell;
    this.originY = (cssHeight - usedH) / 2 - this.content.minRow * this.cell;
  }

  get screenCell(): number {
    return this.cell * this.view.scale;
  }

  get contentBox(): ContentBox {
    return {
      x: this.originX + this.content.minCol * this.cell,
      y: this.originY + this.content.minRow * this.cell,
      w: this.cols * this.cell,
      h: this.rows * this.cell,
    };
  }

  toScreen(p: Point): Point {
    const cx = this.cssWidth / 2;
    const cy = this.cssHeight / 2;
    const { scale, panX, panY } = this.view;
    return {
      x: cx + (p.x - cx) * scale + panX,
      y: cy + (p.y - cy) * scale + panY,
    };
  }

  fromScreen(p: Point): Point {
    const cx = this.cssWidth / 2;
    const cy = this.cssHeight / 2;
    const { scale, panX, panY } = this.view;
    return {
      x: cx + (p.x - cx - panX) / scale,
      y: cy + (p.y - cy - panY) / scale,
    };
  }

  cellCenter(cell: GridPoint): Point {
    return this.toScreen({
      x: this.originX + (cell.col + 0.5) * this.cell,
      y: this.originY + (cell.row + 0.5) * this.cell,
    });
  }

  cellOrigin(cell: GridPoint): Point {
    return this.toScreen({
      x: this.originX + cell.col * this.cell,
      y: this.originY + cell.row * this.cell,
    });
  }

  cssToGrid(x: number, y: number): GridPoint {
    const world = this.fromScreen({ x, y });
    return {
      col: Math.floor((world.x - this.originX) / this.cell),
      row: Math.floor((world.y - this.originY) / this.cell),
    };
  }
}
