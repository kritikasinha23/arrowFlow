import { Link } from "react-router-dom";
import { TabBar } from "../chrome/TabBar";
import { CHAPTERS, levelNumber, listLevelIds } from "../levels-shim";
import { useSession } from "../session";
import { campaignBests, getLastLevel, getStars, readProgress } from "../storage";

export function Collection() {
  const ids = listLevelIds();
  const starred = ids.filter((id) => getStars(id) > 0).length;
  const current = getLastLevel();
  const session = useSession();
  const rank = session.profile?.league?.rank;
  const localBests = campaignBests();
  const remote = session.profile?.bests?.campaign ?? [];
  const bests =
    localBests.length > 0
      ? localBests.map((row) => ({ boardId: row.boardId, score: row.score, moves: row.moves }))
      : remote;
  const progress = readProgress();
  const daily = session.profile?.bests?.daily;
  const localDaily = Object.values(progress.daily)[0];
  const dailyScore = daily?.score ?? localDaily?.score;

  return (
    <main className="shell app-page collection">
      <h1>Collection</h1>
      <p className="lede">Campaign stars, personal bests, and this week’s league place.</p>
      <div className="stat-row">
        <div className="stat-card">
          <strong data-testid="collection-starred">{starred}</strong>
          <span>Starred</span>
        </div>
        <div className="stat-card">
          <strong data-testid="collection-rank">{typeof rank === "number" ? `#${rank}` : "Unranked"}</strong>
          <span>League</span>
        </div>
        <div className="stat-card">
          <strong>{ids.length}</strong>
          <span>Boards</span>
        </div>
      </div>
      <Link className="play-btn" to="/levels" data-testid="collection-campaign">
        Campaign
      </Link>
      <p className="hint-copy">
        Level {levelNumber(current)} · {CHAPTERS.length} chapters
        {dailyScore != null ? ` · Challenge ${dailyScore}` : ""}
      </p>
      {bests.length > 0 ? (
        <ol className="standings" data-testid="collection-bests">
          {bests.map((row) => (
            <li key={row.boardId}>
              <span>{levelNumber(row.boardId)}</span>
              <span>Best {row.score}</span>
              <span>{row.moves} moves</span>
            </li>
          ))}
        </ol>
      ) : null}
      <TabBar />
    </main>
  );
}
