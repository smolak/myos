import type { DashboardPage, LayoutItem } from "@core/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppOptions } from "./AppOptions";
import { CommandPalette } from "./CommandPalette";
import { commandRegistry } from "./command-registry";
import { DashboardGrid } from "./DashboardGrid";
import { DEFAULT_PAGES } from "./default-layout";
import { rpc } from "./electrobun";
import { FeatureCatalog } from "./FeatureCatalog";
import { FeatureProviders } from "./FeatureProviders";
import { FocusModeView } from "./FocusModeView";
import {
  buildFocusCommands,
  buildNavigationCommands,
  FEATURE_VIEWS,
  findFeatureView,
  MODAL_SIZE_CLASSES,
  resolveWidget,
} from "./feature-views";
import { registerHotkey } from "./hotkeys";
import { NotificationCenter } from "./NotificationCenter";
import { ThemeToggle } from "./ThemeToggle";
import { useAppOptions } from "./useAppOptions";
import { useNotifications } from "./useNotifications";
import { useRegisterCommand } from "./useRegisterCommand";
import { useTheme } from "./useTheme";
import { WidgetWindow } from "./WidgetWindow";

const LAYOUT_VERSION = 8;

function App() {
  const [pages, setPages] = useState<DashboardPage[]>(DEFAULT_PAGES);
  const [fullViewFeature, setFullViewFeature] = useState<string | null>(null);
  const [focusModeFeatureId, setFocusModeFeatureId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [appOptionsOpen, setAppOptionsOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const currentPage = pages[0] as DashboardPage;
  const { mode: themeMode, accentColor, setMode: setThemeMode, setAccentColor } = useTheme();
  const { notifications, unreadCount, markRead, clearAll } = useNotifications();
  useAppOptions();

  // Refs to avoid stale closures in hotkey handler
  const focusModeFeatureIdRef = useRef(focusModeFeatureId);
  focusModeFeatureIdRef.current = focusModeFeatureId;
  const fullViewFeatureRef = useRef(fullViewFeature);
  fullViewFeatureRef.current = fullViewFeature;

  // Save window bounds silently on unload so they can be restored on next open
  useEffect(() => {
    function saveWindowBounds() {
      void rpc.request["app:save-window-bounds"]({
        width: window.outerWidth,
        height: window.outerHeight,
        x: window.screenX,
        y: window.screenY,
      });
    }
    window.addEventListener("resize", saveWindowBounds);
    window.addEventListener("beforeunload", saveWindowBounds);
    return () => {
      window.removeEventListener("resize", saveWindowBounds);
      window.removeEventListener("beforeunload", saveWindowBounds);
    };
  }, []);

  useEffect(() => {
    void rpc.request["dashboard:get-layout"]({}).then((stored) => {
      if (stored.version === LAYOUT_VERSION && stored.pages.length > 0) {
        setPages(stored.pages);
      }
    });
    void rpc.request["focus:get-last"]({}).then(({ lastFocusedFeatureId }) => {
      if (lastFocusedFeatureId) {
        // Store for the hotkey to recall — don't auto-enter focus mode
        focusModeFeatureIdRef.current = lastFocusedFeatureId;
      }
    });
  }, []);

  const enterFocusMode = useCallback((featureId: string) => {
    setFocusModeFeatureId(featureId);
    setFullViewFeature(null);
    void rpc.request["focus:set-last"]({ featureId });
  }, []);

  const exitFocusMode = useCallback(() => {
    setFocusModeFeatureId(null);
  }, []);

  // Register global Cmd+K hotkey
  useEffect(() => {
    return registerHotkey("cmd+k", () => setPaletteOpen(true));
  }, []);

  // Cmd+Shift+F: enter focus mode for the open modal, or exit if already in focus mode
  useEffect(() => {
    return registerHotkey("cmd+shift+f", () => {
      if (focusModeFeatureIdRef.current) {
        setFocusModeFeatureId(null);
      } else if (fullViewFeatureRef.current) {
        enterFocusMode(fullViewFeatureRef.current);
      }
    });
  }, [enterFocusMode]);

  // Register app-level commands
  useRegisterCommand({
    id: "app:open-options",
    label: "Open App Options",
    description: "Appearance, data directory, and about",
    group: "App",
    keywords: ["settings", "options", "preferences", "appearance", "background", "theme"],
    action: () => setAppOptionsOpen(true),
  });

  // Navigation and focus-mode commands are generated from the feature view descriptors
  useEffect(() => {
    return commandRegistry.registerMany(buildNavigationCommands(FEATURE_VIEWS, setFullViewFeature));
  }, []);

  useEffect(() => {
    return commandRegistry.registerMany(buildFocusCommands(FEATURE_VIEWS, enterFocusMode));
  }, [enterFocusMode]);

  const handleLayoutChange = useCallback(
    (layout: LayoutItem[]): void => {
      setPages((prev) => {
        const updated = prev.map((p) => (p.id === currentPage.id ? { ...p, layout } : p));
        void rpc.request["dashboard:save-layout"]({ version: LAYOUT_VERSION, pages: updated });
        return updated;
      });
    },
    [currentPage.id],
  );

  const removeWidget = useCallback(
    (id: string): void => {
      setPages((prev) => {
        const updated = prev.map((p) =>
          p.id === currentPage.id ? { ...p, layout: p.layout.filter((l) => l.i !== id) } : p,
        );
        void rpc.request["dashboard:save-layout"]({ version: LAYOUT_VERSION, pages: updated });
        return updated;
      });
    },
    [currentPage.id],
  );

  const addWidget = useCallback(
    (featureId: string, widgetId: string, w: number, h: number): void => {
      const newItem: LayoutItem = {
        i: `${featureId}-${Date.now().toString(36)}`,
        x: 0,
        y: Number.POSITIVE_INFINITY,
        w,
        h,
        featureId,
        widgetId,
      };
      setPages((prev) => {
        const updated = prev.map((p) => (p.id === currentPage.id ? { ...p, layout: [...p.layout, newItem] } : p));
        void rpc.request["dashboard:save-layout"]({ version: LAYOUT_VERSION, pages: updated });
        return updated;
      });
    },
    [currentPage.id],
  );

  function getWidgetContent(item: LayoutItem, onOpenFullView: () => void) {
    const entry = resolveWidget(FEATURE_VIEWS, item.featureId, item.widgetId);
    if (entry) {
      return <entry.Widget onOpenFullView={onOpenFullView} />;
    }
    // Unrecognized featureId/widgetId in a stored layout degrades to a
    // harmless placeholder instead of crashing the dashboard
    return (
      <span className="text-xs text-zinc-500">
        {item.featureId}/{item.widgetId}
      </span>
    );
  }

  const fullViewDescriptor = fullViewFeature ? findFeatureView(FEATURE_VIEWS, fullViewFeature) : undefined;
  const FullViewComponent = fullViewDescriptor?.FullView;
  const fullViewModalSize = fullViewDescriptor?.modalSize;

  function renderWidget(item: LayoutItem) {
    const onOpenFullView = () => setFullViewFeature(item.featureId);
    return (
      <WidgetWindow featureId={item.featureId} onExpand={onOpenFullView} onClose={() => removeWidget(item.i)}>
        {getWidgetContent(item, onOpenFullView)}
      </WidgetWindow>
    );
  }

  return (
    <FeatureProviders descriptors={FEATURE_VIEWS}>
      <div
        className="flex flex-col h-screen text-zinc-100 os-desktop"
        style={{ background: "var(--user-bg, var(--bg-app))" }}
      >
        <header
          className="shrink-0 bg-zinc-900/80 px-5 py-3 backdrop-blur flex items-center justify-between relative z-10"
          style={{
            boxShadow: "var(--shadow-header)",
            borderBottom: "1px solid var(--border-color-subtle)",
          }}
        >
          <h1
            className="text-sm font-semibold tracking-tight select-none"
            style={{ color: "var(--accent-color)", letterSpacing: "-0.02em" }}
          >
            MyOS
          </h1>
          <div className="flex items-center gap-1.5">
            <ThemeToggle
              mode={themeMode}
              accentColor={accentColor}
              onModeChange={(m) => void setThemeMode(m)}
              onAccentChange={(c) => void setAccentColor(c)}
            />
            <NotificationCenter
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkRead={(id) => void markRead(id)}
              onClearAll={() => void clearAll()}
            />
            <button
              type="button"
              className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-600 rounded-md px-2.5 py-1 transition-colors"
              onClick={() => setCatalogOpen(true)}
              aria-label="Open feature catalog"
              title="Add features"
            >
              ⊞
            </button>
            <button
              type="button"
              className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-600 rounded-md px-2.5 py-1 transition-colors font-mono"
              onClick={() => setPaletteOpen(true)}
              aria-label="Open command palette"
            >
              ⌘K
            </button>
            <button
              type="button"
              className="text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-600 rounded-md px-2 py-1 transition-colors text-sm leading-none"
              onClick={() => setAppOptionsOpen(true)}
              aria-label="Open app options"
            >
              ⚙
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-5">
          <DashboardGrid
            page={currentPage}
            onLayoutChange={handleLayoutChange}
            renderWidget={renderWidget}
            onOpenCatalog={() => setCatalogOpen(true)}
          />
        </main>

        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          commands={commandRegistry.getAll()}
          onSearch={(query) => rpc.request["search:global"]({ query })}
          onNavigateToFeature={(featureId) => {
            setFullViewFeature(featureId);
          }}
        />

        {FullViewComponent && fullViewModalSize && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center">
            <div className={`w-full ${MODAL_SIZE_CLASSES[fullViewModalSize]} rounded-xl overflow-hidden shadow-2xl`}>
              <FullViewComponent onClose={() => setFullViewFeature(null)} />
            </div>
          </div>
        )}

        {catalogOpen && (
          <FeatureCatalog currentLayout={currentPage.layout} onAdd={addWidget} onClose={() => setCatalogOpen(false)} />
        )}

        {focusModeFeatureId && <FocusModeView featureId={focusModeFeatureId} onExit={exitFocusMode} />}

        {appOptionsOpen && <AppOptions onClose={() => setAppOptionsOpen(false)} />}
      </div>
    </FeatureProviders>
  );
}

export default App;
