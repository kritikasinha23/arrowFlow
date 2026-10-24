import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TabBar } from "../chrome/TabBar";
import { IconTrophy } from "../chrome/icons";
import { getDaily, getDailyScores, type DailyBoard, type DailyScores } from "../api";
import { getDailyLevelId, levelNumber } from "../levels-shim";
import { useSession } from "../session";
import { isDailyCompleted, utcStamp } from "../storage";

export function Daily() {
  const session = useSession();
  const stamp = utcStamp();
  const done = isDailyCompleted(stamp);
  const label = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const [board, setBoard] = useState<DailyBoard | null>(null);
  const [scores, setScores] = useState<DailyScores | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!session.ready) return;
    let cancelled = false;
    Promise.all([getDaily(stamp), getDailyScores(stamp, session.token)])
      .then(([daily, table]) => {
        if (cancelled) return;
        setBoard(daily);
        setScores(table);
        setOffline(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Offline-first: same seeded daily id the API would pick from packed catalog.
        setBoard({ boardId: getDailyLevelId(new Date()), date: stamp });
        setScores(null);
        setOffline(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session.ready, session.token, stamp]);

  return (
    <main className="shell app-page mode-page">
      <h1>Challenge</h1>
      <IconTrophy className="mode-art" />
      <p className="lede" data-testid="daily-date">
        {label}
      </p>
      {board ? (
        <>
          <p className="level-num">Level {levelNumber(board.boardId)}</p>
          <Link className="play-btn" to={`/play/${board.boardId}?mode=daily`} data-testid="daily-play">
            {done ? "Replay" : "Play"}
          </Link>
          {offline ? (
            <p className="hint-copy" data-testid="daily-offline">
              Offline challenge — scores sync when ArrowFlow is reachable.
            </p>
          ) : scores?.me ? (
            <p className="hint-copy">Your best · #{scores.me.rank} · {scores.me.score}</p>
          ) : (
            <p className="hint-copy">{done ? "Completed" : "One shared board for today."}</p>
          )}
          {scores && scores.top.length > 0 ? (
            <ol className="standings" data-testid="daily-scores">
              {scores.top.map((row) => (
                <li key={row.userId}>
                  <span>{row.rank}</span>
                  <span>{row.displayName}</span>
                  <span>{row.score}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </>
      ) : (
        <p className="hint-copy">Loading today’s board…</p>
      )}
      <TabBar />
    </main>
  );
}
