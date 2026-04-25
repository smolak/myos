import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// One-time migration: clear stale localStorage keys from the pre-Phase-13.1 era.
// Data is now stored in SQLite via the bun process.
const STALE_KEYS = [
  "todo:items",
  "rss-reader:state",
  "pomodoro:state",
  "weather:state",
  "clock:settings",
  "dashboard:pages",
];
for (const key of STALE_KEYS) {
  localStorage.removeItem(key);
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
