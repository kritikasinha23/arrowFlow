export type ViewTransform = {
  scale: number;
  panX: number;
  panY: number;
};

export type ContentBox = { x: number; y: number; w: number; h: number };

/** Zoom multipliers relative to the initial content-fit scale (fit = 1). */
export const ZOOM_MIN = 0.75;
export const ZOOM_MAX = 2.5;
export const TAP_SLOP_PX = 12;
const EDGE_KEEP_PX = 32;

export const FIT_VIEW: ViewTransform = { scale: 1, panX: 0, panY: 0 };

export function clampZoom(z: number, fitScale = 1): number {
  const lo = ZOOM_MIN * fitScale;
  const hi = ZOOM_MAX * fitScale;
  return Math.min(hi, Math.max(lo, z));
}

function projectBox(box: ContentBox, scale: number, cssW: number, cssH: number): { x0: number; y0: number; x1: number; y1: number } {
  const cx = cssW / 2;
  const cy = cssH / 2;
  return {
    x0: cx + (box.x - cx) * scale,
    y0: cy + (box.y - cy) * scale,
    x1: cx + (box.x + box.w - cx) * scale,
    y1: cy + (box.y + box.h - cy) * scale,
  };
}

function clampAxis(pan: number, start: number, end: number, viewSize: number): number {
  const size = Math.max(0, end - start);
  const keep = Math.min(EDGE_KEEP_PX, Math.max(8, size * 0.2));
  const minPan = keep - end;
  const maxPan = viewSize - keep - start;
  if (minPan > maxPan) return (minPan + maxPan) / 2;
  return Math.min(maxPan, Math.max(minPan, pan));
}

/** Keep the content AABB from being dragged fully off-screen. */
export function clampPan(
  view: ViewTransform,
  cssW: number,
  cssH: number,
  content?: ContentBox,
  fitScale = 1,
): ViewTransform {
  const scale = clampZoom(view.scale, fitScale);
  const box = content ?? { x: 0, y: 0, w: cssW, h: cssH };
  const proj = projectBox(box, scale, cssW, cssH);
  return {
    scale,
    panX: clampAxis(view.panX, proj.x0, proj.x1, cssW),
    panY: clampAxis(view.panY, proj.y0, proj.y1, cssH),
  };
}

export function zoomAround(
  view: ViewTransform,
  cssX: number,
  cssY: number,
  nextScale: number,
  cssW: number,
  cssH: number,
  content?: ContentBox,
  fitScale = 1,
): ViewTransform {
  const scale = clampZoom(nextScale, fitScale);
  const cx = cssW / 2;
  const cy = cssH / 2;
  const ratio = scale / (view.scale || 1);
  return clampPan(
    {
      scale,
      panX: (view.panX + cssX - cx) * ratio - (cssX - cx),
      panY: (view.panY + cssY - cy) * ratio - (cssY - cy),
    },
    cssW,
    cssH,
    content,
    fitScale,
  );
}

export function viewIsFit(view: ViewTransform, fitScale = 1): boolean {
  return Math.abs(view.scale - fitScale) < 0.012 && Math.abs(view.panX) < 0.5 && Math.abs(view.panY) < 0.5;
}
