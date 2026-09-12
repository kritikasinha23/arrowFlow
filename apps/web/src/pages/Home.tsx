import { Link } from "react-router-dom";
import { TabBar } from "../chrome/TabBar";
import { BrandMark, IconFlame, IconPin, IconShield, IconTrophy } from "../chrome/icons";
import { levelNumber } from "../levels-shim";
import { useSession } from "../session";
import { formatEndsIn, isoWeek } from "../../../../packages/engine/src/season.ts";
import { getLastLevel, isDailyCompleted, utcStamp } from "../storage";

function prettyDate(now = new Date()): string {
  return now.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export function Home() {
  const level = getLastLevel();
  const session = useSession();
  const week = isoWeek();
  const dailyDone = isDailyCompleted(utcStamp());
  const rank = session.profile?.league?.rank;
  const rankLabel = typeof rank === "number" ? `#${rank}` : "Unranked";

  return (
    <main className="shell home app-page">
      <div className="streak-chip" data-testid="home-streak">
        <IconFlame />
        <span>{session.streak}</span>
      </div>

      <div className="home-cards">
        <Link className="home-card" to="/league" data-testid="home-card-leagues">
          <span className="home-card-kicker">Leagues</span>
          <span className="home-card-meta">{week.weekLabel}</span>
          <IconShield className="home-card-art" />
          <span className="home-card-foot">
            <IconPin />
            {rankLabel}
          </span>
        </Link>
        <Link className="home-card" to="/daily" data-testid="home-card-challenge">
          <span className="home-card-kicker">Challenge</span>
          <span className="home-card-meta">{prettyDate()}</span>
          <IconTrophy className="home-card-art" />
          <span className="home-card-foot muted">{dailyDone ? "Completed" : "Play"}</span>
        </Link>
      </div>

      <div className="home-hero">
        <div className="brand">
          <BrandMark />
          <h1 className="wordmark">ArrowFlow</h1>
        </div>
        <p className="home-name" data-testid="home-name">
          {session.displayName}
        </p>
        <p className="level-num" data-testid="home-level">
          Level {levelNumber(level)}
        </p>
        <p className="home-week">{formatEndsIn(week.closesAt)}</p>
      </div>

      <Link className="play-btn play-btn-lg" to={`/play/${level}?mode=campaign`} data-testid="home-play">
        Play
      </Link>

      <TabBar />
    </main>
  );
}
