import { useEffect, useState } from "react";
import { TabBar } from "../chrome/TabBar";
import { DISPLAY_NAME_MAX } from "../../../../packages/engine/src/names.ts";
import { useSession } from "../session";
import { getLinesMode, getMuted, setLinesMode, setMuted } from "../storage";
import type { LinesMode } from "@arrowflow/renderer";

export function Settings() {
  const session = useSession();
  const [name, setName] = useState(session.displayName);
  const [lines, setLines] = useState<LinesMode>(getLinesMode);
  const [mute, setMute] = useState(getMuted);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setName(session.displayName);
  }, [session.displayName]);

  return (
    <main className="shell app-page settings">
      <h1>Settings</h1>
      <label className="field">
        <span>Display name</span>
        <input
          data-testid="settings-name"
          value={name}
          maxLength={DISPLAY_NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            void session.rename(name).then((saved) => {
              if (saved) {
                setName(saved);
                setNote(session.online ? "Name saved." : "Saved on this device. Will sync when ArrowFlow is reachable.");
              } else {
                setNote("Use 2–20 letters, numbers, or spaces.");
              }
            });
          }}
        />
      </label>
      {note ? <p className="hint-copy">{note}</p> : null}
      <label className="field row">
        <span>Hash rays</span>
        <input
          type="checkbox"
          data-testid="settings-lines"
          checked={lines !== "off"}
          onChange={(e) => {
            const next: LinesMode = e.target.checked ? "on" : "off";
            setLines(next);
            setLinesMode(next);
          }}
        />
      </label>
      <label className="field row">
        <span>Mute</span>
        <input
          type="checkbox"
          data-testid="settings-mute"
          checked={mute}
          onChange={(e) => {
            setMute(e.target.checked);
            setMuted(e.target.checked);
          }}
        />
      </label>
      <TabBar />
    </main>
  );
}
