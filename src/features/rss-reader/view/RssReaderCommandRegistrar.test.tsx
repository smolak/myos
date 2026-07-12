import { commandRegistry } from "@shell/view/command-registry";
import { act, render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { RssFeed } from "../shared/types";
import { RssReaderCommandRegistrar } from "./RssReaderCommandRegistrar";
import { RssReaderProvider } from "./RssReaderContext";
import { makeFeed } from "./test-fixtures";

vi.mock("@shell/view/electrobun", () => ({
  rpc: {
    addMessageListener: vi.fn(),
    removeMessageListener: vi.fn(),
    request: {
      "rss:get-feeds": vi.fn().mockResolvedValue([]),
      "rss:get-entries": vi.fn().mockResolvedValue([]),
      "rss:get-favicons": vi.fn().mockResolvedValue({}),
      "rss:fetch-feeds": vi.fn().mockResolvedValue({ fetched: 0, newEntries: 0 }),
    },
  },
}));

// Renders the registrar inside its provider, then invokes the palette
// command, returning the rpc mock with startup fetch calls already cleared
async function renderAndInvokeRefreshFeedsCommand(feeds: RssFeed[]) {
  const { rpc } = await import("@shell/view/electrobun");
  vi.mocked(rpc.request["rss:get-feeds"]).mockResolvedValue(feeds);

  await act(async () => {
    render(
      <RssReaderProvider>
        <RssReaderCommandRegistrar />
      </RssReaderProvider>,
    );
  });
  vi.mocked(rpc.request["rss:fetch-feeds"]).mockClear();

  const command = commandRegistry.getAll().find((c) => c.id === "rss:refresh-feeds");
  expect(command).toBeDefined();
  await act(async () => {
    command?.action();
  });
  return rpc;
}

describe("RssReaderCommandRegistrar", () => {
  test("registers a Refresh RSS Feeds command in the command registry", async () => {
    await act(async () => {
      render(
        <RssReaderProvider>
          <RssReaderCommandRegistrar />
        </RssReaderProvider>,
      );
    });

    const command = commandRegistry.getAll().find((c) => c.id === "rss:refresh-feeds");
    expect(command).toBeDefined();
    expect(command?.label).toBe("Refresh RSS Feeds");
  });

  test("unregisters the command on unmount", async () => {
    let view: ReturnType<typeof render> | undefined;
    await act(async () => {
      view = render(
        <RssReaderProvider>
          <RssReaderCommandRegistrar />
        </RssReaderProvider>,
      );
    });

    view?.unmount();

    expect(commandRegistry.getAll().find((c) => c.id === "rss:refresh-feeds")).toBeUndefined();
  });

  test("triggers a feed fetch when the command is invoked", async () => {
    const rpc = await renderAndInvokeRefreshFeedsCommand([makeFeed()]);

    expect(rpc.request["rss:fetch-feeds"]).toHaveBeenCalledTimes(1);
  });

  test("does not fetch feeds when no feeds are configured", async () => {
    const rpc = await renderAndInvokeRefreshFeedsCommand([]);

    expect(rpc.request["rss:fetch-feeds"]).not.toHaveBeenCalled();
  });
});
