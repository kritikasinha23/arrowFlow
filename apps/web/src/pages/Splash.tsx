import { BrandMark } from "../chrome/icons";

export function Splash() {
  return (
    <main className="splash" data-testid="splash">
      <div className="brand">
        <BrandMark />
        <h1 className="wordmark">ArrowFlow</h1>
      </div>
    </main>
  );
}
