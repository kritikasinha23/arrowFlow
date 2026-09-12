import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TabBar } from "../chrome/TabBar";
import { IconShield } from "../chrome/icons";
import { getLeague, getStandings, type LeagueCurrent, type StandingRow } from "../api";
import { levelNumber } from "../levels-shim";
import { useSession } from "../session";

export function League() {
  const session = useSession();
  const [league, setLeague] = useState<LeagueCurrent | null>(null);
  const [rows, setRows] = useState<StandingRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session.ready) return;
    if (!session.token) {
      setError("Can't reach ArrowFlow right now");
      return;
    }
    let cancelled = false;
    Promise.all([getLeague(session.token), getStandings(session.token)])
      .then(([current, standings]) => {
        if (cancelled) return;
        setLeague(current);
        setRows(standings.entries);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Can't reach ArrowFlow right now");
      });
    return () => {
      cancelled = true;
    };
  }, [session.ready, session.token]);

  const rankLabel =
    league && typeof league.rank === "number" ? `#${league.rank}` : "Unranked";

  return (
    <main className="shell app-page mode-page">
      <h1>Leagues</h1>
      <IconShield className="mode-art" />
      {error ? (
        <p className="lede" data-testid="league-note">
          {error}
        </p>
      ) : league ? (
        <>
          <p className="lede" data-testid="league-note">
            {league.weekLabel} · {league.endsIn}
          </p>
          <p className="level-num">Level {levelNumber(league.boardId)}</p>
          <p className="hint-copy" data-testid="league-rank">
            {rankLabel} · {league.memberCount} in this group
          </p>
          <Link className="play-btn" to={`/play/${league.boardId}?mode=league`} data-testid="league-play">
            Play
          </Link>
          <ol className="standings" data-testid="league-standings">
            {rows.map((row) => (
              <li key={row.userId} className={row.me ? "me" : undefined}>
                <span>{row.rank == null ? "—" : row.rank}</span>
                <span>{row.displayName}</span>
                <span>{row.score == null ? "Unranked" : row.score}</span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="lede" data-testid="league-note">
          Opening this week’s group…
        </p>
      )}
      <TabBar />
    </main>
  );
}
