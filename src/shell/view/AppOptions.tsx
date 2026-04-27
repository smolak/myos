import { useCallback, useEffect, useState } from "react";
import { rpc } from "./electrobun";
import type { BackgroundStyle } from "./useAppOptions";
import { GRADIENT_PRESETS, useAppOptions } from "./useAppOptions";

type Section = "appearance" | "data" | "about";

function AppearanceSection({
  background,
  setBackground,
}: {
  background: BackgroundStyle | null;
  setBackground: (bg: BackgroundStyle | null) => Promise<void>;
}) {
  const solidColor = background?.type === "solid" ? background.color : "#09090b";

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold text-zinc-100">Appearance</h2>

      <div className="space-y-3">
        <p className="text-sm text-zinc-400">Background</p>

        <div className="flex items-center gap-3">
          <label className="text-sm text-zinc-300" htmlFor="bg-color-picker">
            Solid color
          </label>
          <input
            id="bg-color-picker"
            type="color"
            value={solidColor}
            onChange={(e) => void setBackground({ type: "solid", color: e.target.value })}
            className="h-8 w-16 cursor-pointer rounded border border-zinc-700 bg-transparent"
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm text-zinc-400">Gradient presets</p>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(GRADIENT_PRESETS).map(([preset, gradient]) => {
              const active = background?.type === "gradient" && background.preset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => void setBackground({ type: "gradient", preset })}
                  className={`h-14 rounded-lg border-2 transition-colors ${
                    active ? "border-indigo-500" : "border-zinc-700 hover:border-zinc-500"
                  }`}
                  style={{ background: gradient }}
                  aria-label={preset}
                  aria-pressed={active}
                  title={preset
                    .split("-")
                    .map((w) => w[0].toUpperCase() + w.slice(1))
                    .join(" ")}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function DataSection({
  dataDir,
  onOpenInFinder,
}: {
  dataDir: string;
  onOpenInFinder: (path: string) => Promise<void>;
}) {
  const [pendingDir, setPendingDir] = useState<string | null>(null);

  async function handlePickDir() {
    const { path } = await rpc.request["app:pick-data-dir"]({});
    if (path) {
      await rpc.request["app:save-data-dir"]({ path });
      setPendingDir(path);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold text-zinc-100">Data</h2>

      <div className="space-y-3">
        <p className="text-sm text-zinc-400">Database files</p>
        <p className="break-all rounded bg-zinc-800 px-3 py-2 font-mono text-xs text-zinc-300">{dataDir}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handlePickDir()}
            className="rounded border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Change…
          </button>
          <button
            type="button"
            onClick={() => void onOpenInFinder(dataDir)}
            className="rounded border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Open in Finder
          </button>
        </div>

        {pendingDir && (
          <div className="rounded border border-amber-700/50 bg-amber-950/30 px-4 py-3 space-y-1">
            <p className="text-sm font-medium text-amber-300">Changes take effect on next launch.</p>
            <p className="text-xs text-amber-400/80">
              New path: <span className="font-mono">{pendingDir}</span>
            </p>
            <p className="text-xs text-amber-400/80">Copy your existing data files to the new location.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AboutSection({
  version,
  dataDir,
  onOpenInFinder,
}: {
  version: { version: string; name: string } | null;
  dataDir: string;
  onOpenInFinder: (path: string) => Promise<void>;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold text-zinc-100">About</h2>

      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-2xl font-bold text-zinc-100" style={{ color: "var(--accent-color)" }}>
            MyOS
          </p>
          {version && (
            <p className="text-sm text-zinc-400">
              {version.name} v{version.version}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm text-zinc-400">Data directory</p>
          <p className="break-all rounded bg-zinc-800 px-3 py-2 font-mono text-xs text-zinc-300">{dataDir}</p>
          <button
            type="button"
            onClick={() => void onOpenInFinder(dataDir)}
            className="rounded border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Open in Finder
          </button>
        </div>

        <p className="text-xs text-zinc-500">Back up this folder to preserve your data.</p>
      </div>
    </div>
  );
}

export function AppOptions({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState<Section>("appearance");
  const { background, setBackground } = useAppOptions();
  const [dataDir, setDataDir] = useState<string>("");
  const [version, setVersion] = useState<{ version: string; name: string } | null>(null);

  useEffect(() => {
    void rpc.request["app:get-data-dir"]({}).then(({ path }) => setDataDir(path));
    void rpc.request["app:get-version"]({}).then(setVersion);
  }, []);

  const handleOpenInFinder = useCallback(async (path: string) => {
    await rpc.request["app:open-in-finder"]({ path });
  }, []);

  const navItems: { id: Section; label: string }[] = [
    { id: "appearance", label: "Appearance" },
    { id: "data", label: "Data" },
    { id: "about", label: "About" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        data-testid="app-options-backdrop"
        type="button"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-label="Close app options"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="App Options"
        className="relative w-180 h-130 rounded-xl overflow-hidden shadow-2xl bg-zinc-900 flex"
      >
        {/* Sidebar */}
        <nav className="w-48 shrink-0 border-r border-zinc-800 p-4 flex flex-col gap-1">
          <p className="px-2 mb-2 text-xs uppercase tracking-wider text-zinc-500">Options</p>
          {navItems.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`text-left px-3 py-2 rounded text-sm transition-colors ${
                section === id ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              {label}
            </button>
          ))}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="text-left px-3 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors rounded hover:bg-zinc-800"
          >
            Close
          </button>
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {section === "appearance" && <AppearanceSection background={background} setBackground={setBackground} />}
          {section === "data" && <DataSection dataDir={dataDir} onOpenInFinder={handleOpenInFinder} />}
          {section === "about" && (
            <AboutSection version={version} dataDir={dataDir} onOpenInFinder={handleOpenInFinder} />
          )}
        </div>
      </div>
    </div>
  );
}
