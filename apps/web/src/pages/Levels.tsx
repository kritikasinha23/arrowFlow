import { Link } from "react-router-dom";
import { TabBar } from "../chrome/TabBar";
import { CHAPTERS, levelNumber } from "../levels-shim";
import { getLastLevel, getStars, isLevelUnlocked } from "../storage";

export function Levels() {
  const current = getLastLevel();

  return (
    <main className="shell app-page levels">
      <h1>Campaign</h1>
      <p className="lede">Clear a board to unlock the next.</p>
      {CHAPTERS.map((chapter) => (
        <section key={chapter.id} className="chapter" data-testid={`chapter-${chapter.id}`}>
          <h2>{chapter.title}</h2>
          <div className="level-grid" data-testid={`grid-${chapter.id}`}>
            {chapter.levelIds.map((id) => {
              const stars = getStars(id);
              const unlocked = isLevelUnlocked(id);
              const classes = ["level-cell"];
              if (id === current) classes.push("current");
              if (stars > 0) classes.push("starred");
              if (!unlocked) classes.push("locked");
              if (!unlocked) {
                return (
                  <span
                    key={id}
                    className={classes.join(" ")}
                    data-testid={`level-${id}`}
                    data-stars={stars}
                    data-locked="true"
                    aria-disabled="true"
                  >
                    {levelNumber(id)}
                  </span>
                );
              }
              return (
                <Link
                  key={id}
                  className={classes.join(" ")}
                  to={`/play/${id}?mode=campaign`}
                  data-testid={`level-${id}`}
                  data-stars={stars}
                  data-locked="false"
                >
                  {levelNumber(id)}
                  {stars > 0 ? <span className="star-mark">{stars}</span> : null}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
      <TabBar />
    </main>
  );
}
