import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { Collection } from "./pages/Collection";
import { Daily } from "./pages/Daily";
import { Home } from "./pages/Home";
import { League } from "./pages/League";
import { Levels } from "./pages/Levels";
import { Play } from "./pages/Play";
import { Settings } from "./pages/Settings";
import { Splash } from "./pages/Splash";

function SplashOrHome() {
  const [params] = useSearchParams();
  const skip = params.get("skipSplash") === "1";
  const [showHome, setShowHome] = useState(skip);

  useEffect(() => {
    if (skip) return;
    const timer = window.setTimeout(() => setShowHome(true), 500);
    return () => window.clearTimeout(timer);
  }, [skip]);

  if (!showHome) return <Splash />;
  return <Home />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<SplashOrHome />} />
      <Route path="/home" element={<Home />} />
      <Route path="/play/:levelId?" element={<Play />} />
      <Route path="/levels" element={<Levels />} />
      <Route path="/campaign" element={<Levels />} />
      <Route path="/daily" element={<Daily />} />
      <Route path="/challenge" element={<Daily />} />
      <Route path="/league" element={<League />} />
      <Route path="/collection" element={<Collection />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
