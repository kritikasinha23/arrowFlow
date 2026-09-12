import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  BoardRenderer,
  CoordinateMapper,
  FIT_VIEW,
  TAP_SLOP_PX,
  boardBounds,
  clampPan,
  headingRays,
  latticeCells,
  linesAreOn,
  occupiedBounds,
  viewIsFit,
  zoomAround,
  type ContentBox,
  type LinesMode,
  type RenderArrow,
  type ViewTransform,
} from "@arrowflow/renderer";
import { createWeaveTicker, unweaveStopProgress } from "@arrowflow/twine";
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
import { IDLE_WEAVE, acceptTap, takeQueued, type WeaveLock } from "../weave-queue";

type Anim = {
  id: string;
  trim: number;
  kind: "free" | "blocked";
  rayIndex: number;
};

type Ptr = { id: number; x: number; y: number };

function toRender(
  arrows: ArrowModel[],
  anim: Anim | null,
  hintId: string | null,
  pulse: number,
): RenderArrow[] {
  return arrows.map((a) => ({
    id: a.id,
    cells: a.cells,
    direction: a.direction,
    headCell: a.headCell,
    isRed: a.isRed,
    rayIndex: anim?.id === a.id ? anim.rayIndex : 0,
    animKind: anim?.id === a.id ? anim.kind : undefined,
    hidden: anim?.id === a.id && anim.kind === "free" && anim.trim >= 0.999,
    trim: anim?.id === a.id ? anim.trim : 0,
    pulse: hintId === a.id ? pulse : 0,
  }));
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
  const animRef = useRef<Anim | null>(null);
  const cancelRef = useRef<{ cancel: () => void } | null>(null);
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
  const [busy, setBusy] = useState(false);
  const [won, setWon] = useState(false);
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
  const lockRef = useRef<WeaveLock>(IDLE_WEAVE);
  const startWeaveRef = useRef<(id: string) => void>(() => {});
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
    const arrows = toRender(engine.board.arrows, animRef.current, hintRef.current, pulseRef.current);
    const frame = {
      boardW: engine.board.width,
      boardH: engine.board.height,
      arrows,
      lattice: latticeRef.current,
      lines: linesRef.current,
      hintId: hintRef.current,
      hintPulse: pulseRef.current,
      selectedId: selectedRef.current,
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
    canvas.setAttribute("data-pending", lockRef.current.pendingId ?? "");
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

  const boot = useCallback(() => {
    cancelRef.current?.cancel();
    cancelRef.current = null;
    animRef.current = null;
    lockRef.current = IDLE_WEAVE;
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
      setBusy(false);
      setSelectedId(null);
      syncHud();
      requestAnimationFrame(paint);
    } catch (error) {
      engineRef.current = null;
      setUnavailable(error instanceof UnknownLevelError);
      setBusy(false);
      setWon(false);
      setFailed(false);
    }
  }, [levelId, playMode, syncHud, paint]);

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
      cancelRef.current?.cancel();
    };
  }, [levelId, playMode, boot, paint]);

  useEffect(() => {
    paint();
  }, [lines, paint, hearts, pieceCount, redIds, won, selectedId, viewTick]);

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
    if (!engine || busy) return;
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

  const startWeave = useCallback(
    (id: string) => {
      const engine = engineRef.current;
      const canvas = canvasRef.current;
      if (!engine || engine.isWon || engine.isOutOfHearts) return;
      if (!engine.board.arrows.some((a) => a.id === id)) return;
      const result = engine.tryWeave(id);
      const rayIndex = result.kind === "blocked" ? result.rayIndex : 0;
      const stop = unweaveStopProgress(result.kind);
      setSelectedId(id);
      setBusy(true);
      if (canvas) canvas.dataset.busy = "true";
      hintRef.current = null;
      animRef.current = { id, trim: 0, kind: result.kind, rayIndex };
      paint();
      cancelRef.current = createWeaveTicker(
        result.kind,
        stop,
        (frame) => {
          animRef.current = { id, trim: frame.trim, kind: result.kind, rayIndex };
          paint();
        },
        () => {
          animRef.current = null;
          if (result.kind === "free") engine.commitFree(id);
          else engine.commitBlocked(id);
          moveLogRef.current.push({
            arrowId: id,
            tMs: Math.max(0, Date.now() - startedAtRef.current),
            result: result.kind,
          });
          const next = takeQueued(lockRef.current, (qid) =>
            engine.board.arrows.some((a) => a.id === qid),
          );
          lockRef.current = next.lock;
          syncHud();
          if (next.startId) {
            paint();
            startWeaveRef.current(next.startId);
            return;
          }
          setBusy(false);
          if (canvas) canvas.dataset.busy = "false";
          paint();
        },
      );
    },
    [paint, syncHud],
  );
  startWeaveRef.current = startWeave;

  const onTap = (cssX: number, cssY: number) => {
    const engine = engineRef.current;
    const mapper = mapperRef.current;
    const renderer = rendererRef.current;
    if (!engine || !mapper || !renderer || engine.isWon || engine.isOutOfHearts) return;
    const arrows = toRender(engine.board.arrows, null, null, 0);
    const id = renderer.hitTest(mapper, arrows, cssX, cssY);
    const decision = acceptTap(lockRef.current, id);
    lockRef.current = decision.lock;
    if (decision.action === "queue") {
      paint();
      return;
    }
    if (decision.action === "start" && id) startWeave(id);
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
    const arrows = toRender(engine.board.arrows, null, null, 0);
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
    if (busy || won) return;
    engineRef.current?.undo();
    syncHud();
    paint();
  };

  const onReset = () => {
    if (busy) return;
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
  const progress = won ? 1 : cleared / startCount;
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
            disabled={busy || won}
            onClick={onUndo}
            onPointerDown={onUndoHoldStart}
            onPointerUp={onUndoHoldEnd}
            onPointerLeave={onUndoHoldEnd}
            onPointerCancel={onUndoHoldEnd}
          >
            <IconUndo />
          </button>
          <button type="button" className="sr-only" data-testid="btn-reset" onClick={onReset} disabled={busy}>
            Reset
          </button>
        </div>
        <div className="hearts" data-testid="hud-hearts" data-hearts={hearts}>
          {Array.from({ length: 3 }, (_, i) => (
            <Heart key={i} on={i < hearts} />
          ))}
        </div>
        <div className="hud-right">
          <button type="button" className="hint-pill" data-testid="btn-hint" onClick={onHint} disabled={busy}>
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
          data-busy={busy ? "true" : "false"}
          data-red={redIds.join(",")}
          data-piece-count={pieceCount}
          data-lines={lines}
          data-won={won ? "true" : "false"}
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

      {won ? (
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
