import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  BoardRenderer,
  CoordinateMapper,
  FIT_VIEW,
  TAP_SLOP_PX,
  TAP_FX_MS,
  WIN_CARD_AFTER_MS,
  WIN_FX_MS,
  boardBounds,
  clampPan,
  headingRays,
  latticeCells,
  linesAreOn,
  occupiedBounds,
  seedConfetti,
  seedTapConfetti,
  viewIsFit,
  zoomAround,
  type ContentBox,
  type LinesMode,
  type RenderArrow,
  type ViewTransform,
  type WinFx,
} from "@arrowflow/renderer";
import {
  VIEW_CLEAR_PAD_PX,
  createWeaveTicker,
  freeWeaveDurationMs,
  polylineLength,
  unweaveStopProgress,
  viewClearTravelPx,
} from "@arrowflow/twine";
import { IconBack, IconHash, IconHeart, IconSpark, IconUndo } from "../chrome/icons";
import { getBoard, UnknownLevelError } from "../boards";
import { PuzzleEngine, type ArrowModel } from "../engine-bridge";
import { getToken } from "../guest";
import { CAMPAIGN_START_ID, nextCampaignLevelId } from "../levels-shim";
import { commitWinLocally, flushPendingScores } from "../scores";
import { useSession } from "../session";
import {
  cycleLines,
  getLastLevel,
  getLinesMode,
  setLinesMode,
  utcStamp,
} from "../storage";
import { acceptTap } from "../weave-queue";

type FlightAnim = {
  id: string;
  trim: number;
  kind: "free" | "blocked";
  rayIndex: number;
  ghost?: RenderArrow;
  cancel: () => void;
};

type Ptr = { id: number; x: number; y: number };

function snapshotGhost(a: ArrowModel): RenderArrow {
  return {
    id: a.id,
    cells: a.cells.map((c) => ({ row: c.row, col: c.col })),
    direction: a.direction,
    headCell: { row: a.headCell.row, col: a.headCell.col },
    isRed: a.isRed,
    ghost: true,
  };
}

function toRender(
  arrows: ArrowModel[],
  flights: Map<string, FlightAnim>,
  hintId: string | null,
  pulse: number,
): RenderArrow[] {
  const out: RenderArrow[] = arrows.map((a) => {
    const anim = flights.get(a.id);
    return {
      id: a.id,
      cells: a.cells,
      direction: a.direction,
      headCell: a.headCell,
      isRed: a.isRed,
      rayIndex: anim?.rayIndex ?? 0,
      animKind: anim?.kind,
      trim: anim?.trim ?? 0,
      pulse: hintId === a.id ? pulse : 0,
    };
  });
  for (const anim of flights.values()) {
    if (anim.kind !== "free" || !anim.ghost) continue;
    if (arrows.some((a) => a.id === anim.id)) continue;
    out.push({
      ...anim.ghost,
      trim: anim.trim,
      animKind: "free",
      rayIndex: anim.rayIndex,
      ghost: true,
    });
  }
  return out;
}

function Heart({ on }: { on: boolean }) {
  return <IconHeart className={on ? "heart on" : "heart off"} filled={on} />;
}

export function Play() {
  const { levelId } = useParams();
  const [searchParams] = useSearchParams();
  const playMode = searchParams.get("mode");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PuzzleEngine | null>(null);
  const rendererRef = useRef<BoardRenderer | null>(null);
  const mapperRef = useRef<CoordinateMapper | null>(null);
  const flightsRef = useRef<Map<string, FlightAnim>>(new Map());
  const winFxRef = useRef<WinFx | null>(null);
  const winFxRafRef = useRef(0);
  const winFxStartedRef = useRef(false);
  const tapFxRef = useRef<Array<WinFx & { startedAt: number }>>([]);
  const tapFxRafRef = useRef(0);
  const lastExitRef = useRef<{ x: number; y: number } | null>(null);
  const hintRef = useRef<string | null>(null);
  const pulseRef = useRef(0);
  const viewRef = useRef<ViewTransform>({ ...FIT_VIEW });
  const contentBoxRef = useRef<ContentBox | null>(null);
  const contentBoundsRef = useRef(boardBounds(1, 1));
  const latticeRef = useRef<ReturnType<typeof latticeCells>>([]);
  const ptrsRef = useRef<Map<number, Ptr>>(new Map());
  const gestureRef = useRef({
    mode: "none" as "none" | "tap" | "pan" | "pinch",
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    startMidX: 0,
    startMidY: 0,
    startDist: 0,
    startView: { ...FIT_VIEW },
    moved: false,
    lastTapAt: 0,
    lastTapX: 0,
    lastTapY: 0,
    suppressTapUntil: 0,
  });

  const session = useSession();
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const [hearts, setHearts] = useState(3);
  const [flightCount, setFlightCount] = useState(0);
  const [won, setWon] = useState(false);
  const [showWinCard, setShowWinCard] = useState(false);
  const [failed, setFailed] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [lines, setLines] = useState<LinesMode>(getLinesMode);
  const [redIds, setRedIds] = useState<string[]>([]);
  const [pieceCount, setPieceCount] = useState(0);
  const [levelLabel, setLevelLabel] = useState(levelId ?? CAMPAIGN_START_ID);
  const startCountRef = useRef(0);
  const holdRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const hintCountRef = useRef(0);
  const moveLogRef = useRef<Array<{ arrowId: string; tMs: number; result: "free" | "blocked" }>>([]);
  const submittedRef = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewTick, setViewTick] = useState(0);
  const linesRef = useRef(lines);
  const selectedRef = useRef(selectedId);
  linesRef.current = lines;
  selectedRef.current = selectedId;

  const syncHud = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    setHearts(engine.hearts);
    setWon(engine.isWon);
    setRedIds(engine.board.arrows.filter((a) => a.isRed).map((a) => a.id));
    setPieceCount(engine.board.arrows.length);
    setLevelLabel(engine.board.levelId);
    if (startCountRef.current === 0) startCountRef.current = engine.board.arrows.length;
    setFailed(engine.isOutOfHearts && !engine.isWon);
    if (engine.isWon && !submittedRef.current) {
      submittedRef.current = true;
      const mode = playMode === "daily" ? "daily" : playMode === "league" ? "league" : "campaign";
      if (engine.hearts > 0) {
        commitWinLocally({
          boardId: engine.board.levelId,
          mode,
          heartsLeft: engine.hearts,
          hints: hintCountRef.current,
          elapsedMs: Math.max(0, Date.now() - startedAtRef.current),
          moves: moveLogRef.current.length,
          pieceCount: startCountRef.current || engine.board.arrows.length,
          moveLog: moveLogRef.current,
          date: mode === "daily" ? utcStamp() : undefined,
          seasonId: mode === "league" ? sessionRef.current.profile?.league?.seasonId : undefined,
        });
        void flushPendingScores(getToken()).then(() => {
          void sessionRef.current.refresh();
        });
      }
    }
  }, [playMode]);

  const applyView = useCallback((next: ViewTransform) => {
    const canvas = canvasRef.current;
    const w = canvas?.clientWidth ?? 1;
    const h = canvas?.clientHeight ?? 1;
    viewRef.current = clampPan(next, w, h, contentBoxRef.current ?? undefined);
    setViewTick((n) => n + 1);
  }, []);

  /** Recenter to the initial fit. Does not latch a no-pan mode. */
  const resetView = useCallback(() => {
    viewRef.current = { ...FIT_VIEW };
    setViewTick((n) => n + 1);
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !engine || !renderer) return;
    const wrap = canvas.parentElement;
    const cssW = wrap && wrap.clientWidth > 8 ? wrap.clientWidth : canvas.clientWidth;
    const cssH = wrap && wrap.clientHeight > 8 ? wrap.clientHeight : canvas.clientHeight;
    if (cssW < 8 || cssH < 8) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    const bounds = contentBoundsRef.current;
    const mapper = new CoordinateMapper(engine.board.width, engine.board.height, cssW, cssH, {
      padRatio: 0.1,
      view: viewRef.current,
      content: bounds,
    });
    mapperRef.current = mapper;
    contentBoxRef.current = mapper.contentBox;
    const arrows = toRender(engine.board.arrows, flightsRef.current, hintRef.current, pulseRef.current);
    const frame = {
      boardW: engine.board.width,
      boardH: engine.board.height,
      arrows,
      lattice: latticeRef.current,
      lines: linesRef.current,
      hintId: hintRef.current,
      hintPulse: pulseRef.current,
      selectedId: selectedRef.current,
      winFx: winFxRef.current,
      tapFx: tapFxRef.current,
    };
    renderer.draw(mapper, frame, dpr);
    for (const key of [...canvas.attributes].map((a) => a.name)) {
      if (key.startsWith("data-hit-")) canvas.removeAttribute(key);
    }
    canvas.setAttribute("data-lattice-count", String(latticeRef.current.length));
    canvas.setAttribute(
      "data-ray-count",
      String(linesAreOn(frame.lines) ? headingRays(frame).length : 0),
    );
    canvas.setAttribute("data-pending", "");
    canvas.setAttribute("data-flying", [...flightsRef.current.keys()].join(","));
    canvas.setAttribute(
      "data-ghost-count",
      String([...flightsRef.current.values()].filter((f) => f.kind === "free").length),
    );
    canvas.setAttribute("data-win-fx", winFxRef.current ? "true" : "false");
    canvas.setAttribute("data-tap-fx", tapFxRef.current.length ? "true" : "false");
    canvas.setAttribute("data-busy", flightsRef.current.size > 0 ? "true" : "false");
    canvas.setAttribute(
      "data-bounds",
      `${bounds.minRow},${bounds.minCol},${bounds.maxRow},${bounds.maxCol}`,
    );
    canvas.setAttribute("data-pan-x", viewRef.current.panX.toFixed(1));
    canvas.setAttribute("data-pan-y", viewRef.current.panY.toFixed(1));
    for (const a of engine.board.arrows) {
      const p = renderer.hitCenter(mapper, a);
      canvas.setAttribute(`data-hit-${a.id}`, `${Math.round(p.x)},${Math.round(p.y)}`);
    }
  }, []);

  const cancelFlights = useCallback(() => {
    for (const flight of flightsRef.current.values()) flight.cancel();
    flightsRef.current.clear();
    setFlightCount(0);
  }, []);

  const cancelWinFx = useCallback(() => {
    if (winFxRafRef.current) cancelAnimationFrame(winFxRafRef.current);
    winFxRafRef.current = 0;
    winFxRef.current = null;
    winFxStartedRef.current = false;
    lastExitRef.current = null;
    if (tapFxRafRef.current) cancelAnimationFrame(tapFxRafRef.current);
    tapFxRafRef.current = 0;
    tapFxRef.current = [];
  }, []);

  const boot = useCallback(() => {
    cancelFlights();
    cancelWinFx();
    setShowWinCard(false);
    hintRef.current = null;
    viewRef.current = { ...FIT_VIEW };
    contentBoxRef.current = null;
    contentBoundsRef.current = boardBounds(1, 1);
    latticeRef.current = [];
    startCountRef.current = 0;
    startedAtRef.current = Date.now();
    hintCountRef.current = 0;
    moveLogRef.current = [];
    submittedRef.current = false;
    const requested = levelId && levelId.length > 0 ? levelId : getLastLevel();
    try {
      const board = getBoard(requested);
      engineRef.current = new PuzzleEngine(board);
      const startCells = board.arrows.flatMap((a) => a.cells);
      latticeRef.current = latticeCells(startCells);
      contentBoundsRef.current = occupiedBounds(startCells) ?? boardBounds(board.width, board.height);
      setUnavailable(false);
      setFailed(false);
      setWon(false);
      setSelectedId(null);
      syncHud();
      requestAnimationFrame(paint);
    } catch (error) {
      engineRef.current = null;
      setUnavailable(error instanceof UnknownLevelError);
      setWon(false);
      setFailed(false);
    }
  }, [levelId, playMode, syncHud, paint, cancelFlights, cancelWinFx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    rendererRef.current = new BoardRenderer(ctx);
    boot();
    const onResize = () => paint();
    const ro = new ResizeObserver(() => paint());
    ro.observe(canvas.parentElement ?? canvas);
    window.addEventListener("resize", onResize);
    requestAnimationFrame(() => requestAnimationFrame(paint));
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      cancelFlights();
      cancelWinFx();
    };
  }, [levelId, playMode, boot, paint, cancelFlights, cancelWinFx]);

  useEffect(() => {
    paint();
  }, [lines, paint, hearts, pieceCount, redIds, won, selectedId, viewTick, flightCount, showWinCard]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0018);
      applyView(
        zoomAround(
          viewRef.current,
          x,
          y,
          viewRef.current.scale * factor,
          canvas.clientWidth,
          canvas.clientHeight,
          contentBoxRef.current ?? undefined,
        ),
      );
      paint();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [applyView, paint]);

  const onHint = () => {
    const engine = engineRef.current;
    if (!engine || engine.isWon) return;
    const ids = engine.availableArrows();
    hintRef.current = ids[0] ?? null;
    if (!hintRef.current) return;
    hintCountRef.current += 1;
    const t0 = performance.now();
    const tick = (now: number) => {
      pulseRef.current = ((now - t0) % 700) / 700;
      paint();
      if (now - t0 < 1400 && hintRef.current) requestAnimationFrame(tick);
      else {
        hintRef.current = null;
        pulseRef.current = 0;
        paint();
      }
    };
    requestAnimationFrame(tick);
  };

  const startWinFx = useCallback(() => {
    if (winFxStartedRef.current) return;
    winFxStartedRef.current = true;
    const mapper = mapperRef.current;
    const origin = lastExitRef.current ?? {
      x: (mapper?.cssWidth ?? 200) / 2,
      y: (mapper?.cssHeight ?? 400) / 2,
    };
    winFxRef.current = { t: 0, origin, bits: seedConfetti(origin), durationMs: WIN_FX_MS };
    const t0 = performance.now();
    const tick = (now: number) => {
      if (!winFxRef.current) return;
      const elapsed = now - t0;
      winFxRef.current.t = Math.min(1, elapsed / WIN_FX_MS);
      if (elapsed >= WIN_CARD_AFTER_MS) setShowWinCard(true);
      paint();
      if (elapsed < WIN_FX_MS) {
        winFxRafRef.current = requestAnimationFrame(tick);
        return;
      }
      winFxRef.current = null;
      paint();
    };
    winFxRafRef.current = requestAnimationFrame(tick);
  }, [paint]);

  const spawnTapConfetti = useCallback(
    (origin: { x: number; y: number }) => {
      tapFxRef.current.push({
        t: 0,
        origin,
        bits: seedTapConfetti(origin, (performance.now() * 1000) | 0),
        durationMs: TAP_FX_MS,
        startedAt: performance.now(),
      });
      if (tapFxRafRef.current) return;
      const tick = (now: number) => {
        tapFxRef.current = tapFxRef.current.filter((fx) => {
          fx.t = Math.min(1, (now - fx.startedAt) / (fx.durationMs ?? TAP_FX_MS));
          return fx.t < 1;
        });
        paint();
        if (tapFxRef.current.length) {
          tapFxRafRef.current = requestAnimationFrame(tick);
          return;
        }
        tapFxRafRef.current = 0;
      };
      tapFxRafRef.current = requestAnimationFrame(tick);
    },
    [paint],
  );

  const startWeave = useCallback(
    (id: string, tap?: { x: number; y: number }) => {
      const engine = engineRef.current;
      if (!engine || engine.isOutOfHearts) return;
      if (flightsRef.current.has(id)) return;
      const arrow = engine.board.arrows.find((a) => a.id === id);
      if (!arrow) return;
      const result = engine.tryWeave(id);
      const rayIndex = result.kind === "blocked" ? result.rayIndex : 0;
      const stop = unweaveStopProgress(result.kind);
      const mapper = mapperRef.current;
      const renderer = rendererRef.current;
      let durationMs: number | undefined;
      let ghost: RenderArrow | undefined;
      if (result.kind === "free") {
        ghost = snapshotGhost(arrow);
        if (mapper && renderer) {
          const rest = renderer.restPoints(mapper, arrow);
          const travel = viewClearTravelPx(
            rest,
            arrow.direction,
            { x: 0, y: 0, w: mapper.cssWidth, h: mapper.cssHeight },
            VIEW_CLEAR_PAD_PX,
          );
          durationMs = freeWeaveDurationMs(polylineLength(rest), travel);
          lastExitRef.current = mapper.cellCenter(arrow.headCell);
        }
        const blastAt = tap ?? lastExitRef.current ?? { x: 0, y: 0 };
        spawnTapConfetti(blastAt);
        engine.commitFree(id);
        moveLogRef.current.push({
          arrowId: id,
          tMs: Math.max(0, Date.now() - startedAtRef.current),
          result: "free",
        });
        syncHud();
      }
      setSelectedId(id);
      hintRef.current = null;
      const flight: FlightAnim = {
        id,
        trim: 0,
        kind: result.kind,
        rayIndex,
        ghost,
        cancel: () => {},
      };
      flightsRef.current.set(id, flight);
      setFlightCount(flightsRef.current.size);
      paint();
      const ticker = createWeaveTicker(
        result.kind,
        stop,
        (frame) => {
          const cur = flightsRef.current.get(id);
          if (!cur) return;
          cur.trim = frame.trim;
          paint();
        },
        () => {
          const cur = flightsRef.current.get(id);
          if (cur) flightsRef.current.delete(id);
          setFlightCount(flightsRef.current.size);
          if (result.kind === "blocked") {
            engine.commitBlocked(id);
            moveLogRef.current.push({
              arrowId: id,
              tMs: Math.max(0, Date.now() - startedAtRef.current),
              result: "blocked",
            });
            syncHud();
          }
          const ghostsLeft = [...flightsRef.current.values()].some((f) => f.kind === "free");
          if (engine.isWon && !ghostsLeft) startWinFx();
          paint();
        },
        { durationMs },
      );
      flight.cancel = ticker.cancel;
    },
    [paint, syncHud, startWinFx, spawnTapConfetti],
  );

  const onTap = (cssX: number, cssY: number) => {
    const engine = engineRef.current;
    const mapper = mapperRef.current;
    const renderer = rendererRef.current;
    if (!engine || !mapper || !renderer || engine.isOutOfHearts) return;
    const arrows = toRender(engine.board.arrows, new Map(), null, 0);
    const id = renderer.hitTest(mapper, arrows, cssX, cssY);
    if (acceptTap([...flightsRef.current.values()], id).action === "start" && id) {
      startWeave(id, { x: cssX, y: cssY });
    }
  };

  const localPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = localPoint(e);
    ptrsRef.current.set(e.pointerId, { id: e.pointerId, x: p.x, y: p.y });
    e.currentTarget.setPointerCapture(e.pointerId);
    const g = gestureRef.current;
    if (ptrsRef.current.size >= 2) {
      const pts = [...ptrsRef.current.values()];
      g.mode = "pinch";
      g.moved = true;
      g.startDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      g.startMidX = (pts[0].x + pts[1].x) / 2;
      g.startMidY = (pts[0].y + pts[1].y) / 2;
      g.startView = { ...viewRef.current };
      g.suppressTapUntil = performance.now() + 280;
      return;
    }
    g.mode = "tap";
    g.moved = false;
    g.startX = p.x;
    g.startY = p.y;
    g.startPanX = viewRef.current.panX;
    g.startPanY = viewRef.current.panY;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ptrsRef.current.has(e.pointerId)) return;
    const p = localPoint(e);
    ptrsRef.current.set(e.pointerId, { id: e.pointerId, x: p.x, y: p.y });
    const g = gestureRef.current;
    const canvas = e.currentTarget;
    if (g.mode === "pinch" && ptrsRef.current.size >= 2) {
      const pts = [...ptrsRef.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const scaled = zoomAround(
        g.startView,
        g.startMidX,
        g.startMidY,
        g.startView.scale * (dist / g.startDist),
        canvas.clientWidth,
        canvas.clientHeight,
        contentBoxRef.current ?? undefined,
      );
      applyView({
        ...scaled,
        panX: scaled.panX + (midX - g.startMidX),
        panY: scaled.panY + (midY - g.startMidY),
      });
      paint();
      return;
    }
    if (g.mode === "none") return;
    const dx = p.x - g.startX;
    const dy = p.y - g.startY;
    if (!g.moved && Math.hypot(dx, dy) > TAP_SLOP_PX) {
      g.moved = true;
      g.mode = "pan";
      g.suppressTapUntil = performance.now() + 200;
    }
    if (g.mode === "pan") {
      applyView({
        scale: viewRef.current.scale,
        panX: g.startPanX + dx,
        panY: g.startPanY + dy,
      });
      paint();
    }
  };

  const endPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = localPoint(e);
    ptrsRef.current.delete(e.pointerId);
    const g = gestureRef.current;
    if (g.mode === "pinch") {
      if (ptrsRef.current.size < 2) {
        g.mode = "none";
        g.suppressTapUntil = performance.now() + 280;
      }
      return;
    }
    if (g.mode === "pan") {
      g.mode = "none";
      return;
    }
    if (g.mode !== "tap") {
      g.mode = "none";
      return;
    }
    g.mode = "none";
    g.moved = false;
    if (performance.now() < g.suppressTapUntil) return;
    const now = performance.now();
    const mapper = mapperRef.current;
    const renderer = rendererRef.current;
    const engine = engineRef.current;
    if (!mapper || !renderer || !engine) return;
    const arrows = toRender(engine.board.arrows, new Map(), null, 0);
    const hit = renderer.hitTest(mapper, arrows, p.x, p.y);
    if (
      !hit &&
      now - g.lastTapAt < 320 &&
      Math.hypot(p.x - g.lastTapX, p.y - g.lastTapY) < 28
    ) {
      resetView();
      paint();
      g.lastTapAt = 0;
      return;
    }
    g.lastTapAt = now;
    g.lastTapX = p.x;
    g.lastTapY = p.y;
    onTap(p.x, p.y);
  };

  const onUndo = () => {
    if (showWinCard || engineRef.current?.isWon) return;
    cancelFlights();
    engineRef.current?.undo();
    syncHud();
    paint();
  };

  const onReset = () => {
    if (showWinCard) return;
    cancelFlights();
    cancelWinFx();
    engineRef.current?.reset();
    startCountRef.current = engineRef.current?.board.arrows.length ?? 0;
    syncHud();
    paint();
  };

  const onUndoHoldStart = () => {
    if (holdRef.current != null) window.clearTimeout(holdRef.current);
    holdRef.current = window.setTimeout(() => {
      holdRef.current = null;
      onReset();
    }, 520);
  };

  const onUndoHoldEnd = () => {
    if (holdRef.current != null) {
      window.clearTimeout(holdRef.current);
      holdRef.current = null;
    }
  };

  const onLines = () => {
    const next = cycleLines(lines);
    setLines(next);
    setLinesMode(next);
  };

  const fit = viewIsFit(viewRef.current);
  const startCount = startCountRef.current || Math.max(pieceCount, 1);
  const cleared = Math.max(0, startCount - pieceCount);
  const progress = won || showWinCard ? 1 : cleared / startCount;
  const campaignMode = playMode !== "daily" && playMode !== "league";
  const nextId = campaignMode ? nextCampaignLevelId(levelLabel) : null;

  if (unavailable) {
    return (
      <main className="play">
        <header className="hud">
          <div className="hud-left">
            <Link className="circle-btn" to="/home" data-testid="hud-home" aria-label="Back">
              <IconBack />
            </Link>
          </div>
        </header>
        <aside className="win-card" data-testid="level-unavailable">
          <p>Level unavailable</p>
          <Link className="play-btn" to="/home" data-testid="unavailable-home">
            Home
          </Link>
        </aside>
      </main>
    );
  }

  return (
    <main className="play">
      <header className="hud">
        <div className="hud-left">
          <Link className="circle-btn" to="/home" data-testid="hud-home" aria-label="Back">
            <IconBack />
          </Link>
          <button
            type="button"
            className="circle-btn"
            data-testid="btn-undo"
            aria-label="Undo"
            title="Undo · hold to reset"
            disabled={showWinCard || won}
            onClick={onUndo}
            onPointerDown={onUndoHoldStart}
            onPointerUp={onUndoHoldEnd}
            onPointerLeave={onUndoHoldEnd}
            onPointerCancel={onUndoHoldEnd}
          >
            <IconUndo />
          </button>
          <button type="button" className="sr-only" data-testid="btn-reset" onClick={onReset} disabled={showWinCard}>
            Reset
          </button>
        </div>
        <div className="hearts" data-testid="hud-hearts" data-hearts={hearts}>
          {Array.from({ length: 3 }, (_, i) => (
            <Heart key={i} on={i < hearts} />
          ))}
        </div>
        <div className="hud-right">
          <button type="button" className="hint-pill" data-testid="btn-hint" onClick={onHint} disabled={won || showWinCard}>
            <IconSpark />
            Hint
          </button>
        </div>
        <div className="level-id sr-only" data-testid="hud-level">
          {levelLabel}
        </div>
      </header>
      <div className="hud-rule" aria-hidden>
        <i style={{ width: `${Math.max(8, progress * 100)}%` }} />
      </div>

      <div className="board-wrap">
        <canvas
          ref={canvasRef}
          className="board"
          data-testid="board-canvas"
          data-busy={flightCount > 0 ? "true" : "false"}
          data-red={redIds.join(",")}
          data-piece-count={pieceCount}
          data-lines={lines}
          data-won={won || showWinCard ? "true" : "false"}
          data-scale={viewRef.current.scale.toFixed(2)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
        />
        {!fit ? (
          <button
            type="button"
            className="circle-btn fit-btn"
            data-testid="btn-fit"
            data-fit="false"
            aria-label="Fit"
            onClick={() => {
              resetView();
              requestAnimationFrame(paint);
            }}
          >
            ·
          </button>
        ) : (
          <span className="sr-only" data-testid="btn-fit" data-fit="true" />
        )}
        <button
          type="button"
          className="circle-btn hash-btn"
          data-testid="btn-lines"
          data-lines={lines}
          aria-label="Hash"
          onClick={onLines}
        >
          <IconHash />
        </button>
      </div>

      {showWinCard ? (
        <aside className="win-card" data-testid="win-card" data-won="true">
          <p>Board clear</p>
          <div className="win-card-actions">
            {nextId ? (
              <Link className="play-btn" to={`/play/${nextId}?mode=campaign`} data-testid="win-next">
                Next
              </Link>
            ) : null}
            <button type="button" className="play-btn play-btn-ghost" data-testid="win-replay" onClick={boot}>
              Replay
            </button>
            <Link className="play-btn play-btn-ghost" to="/home" data-testid="win-home">
              Home
            </Link>
          </div>
        </aside>
      ) : null}
      {failed ? (
        <aside className="win-card" data-testid="fail-card">
          <p>Out of hearts</p>
          <div className="win-card-actions">
            <button type="button" className="play-btn" data-testid="fail-replay" onClick={boot}>
              Replay
            </button>
            <Link className="play-btn play-btn-ghost" to="/home" data-testid="fail-home">
              Home
            </Link>
          </div>
        </aside>
      ) : null}
    </main>
  );
}
