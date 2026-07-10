import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { FaviconMap } from "../shared/types";
import { EntryIcon } from "./EntryIcon";

const mocks = vi.hoisted(() => {
  const state: { favicons: FaviconMap } = { favicons: {} };
  return { state };
});

vi.mock("./RssReaderContext", () => ({
  useRssReaderContext: () => ({ favicons: mocks.state.favicons }),
}));

const FAVICON_DATA_URL = "data:image/png;base64,AAAA";

describe("EntryIcon", () => {
  beforeEach(() => {
    mocks.state.favicons = {};
  });

  test("renders the cached favicon when the map has the link's hostname", () => {
    mocks.state.favicons = { "example.com": FAVICON_DATA_URL };
    const { container } = render(<EntryIcon link="https://example.com/article" />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", FAVICON_DATA_URL);
  });

  test("hides the favicon image from screen readers with an empty alt", () => {
    mocks.state.favicons = { "example.com": FAVICON_DATA_URL };
    const { container } = render(<EntryIcon link="https://example.com/article" />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("aria-hidden", "true");
    expect(img).toHaveAttribute("alt", "");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  test("renders a lettered placeholder when the hostname has no cached favicon", () => {
    render(<EntryIcon link="https://example.com/article" />);
    expect(screen.getByText("E")).toBeInTheDocument();
  });

  test("hides the placeholder from screen readers", () => {
    render(<EntryIcon link="https://example.com/article" />);
    expect(screen.getByText("E")).toHaveAttribute("aria-hidden", "true");
  });

  test("strips a leading www for the displayed letter", () => {
    render(<EntryIcon link="https://www.example.com/article" />);
    expect(screen.getByText("E")).toBeInTheDocument();
  });

  test("renders distinct letters for different iconless hostnames", () => {
    const { container: a } = render(<EntryIcon link="https://alice.github.io/post" />);
    const { container: b } = render(<EntryIcon link="https://bob.github.io/post" />);
    expect(a.firstElementChild?.textContent).toBe("A");
    expect(b.firstElementChild?.textContent).toBe("B");
  });

  test("never reuses a favicon cached for a different subdomain", () => {
    mocks.state.favicons = { "alice.github.io": FAVICON_DATA_URL };
    const { container } = render(<EntryIcon link="https://bob.github.io/post" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  test("renders exactly one decorative slot whether or not a favicon is cached", () => {
    mocks.state.favicons = { "example.com": FAVICON_DATA_URL };
    const { container: withIcon } = render(<EntryIcon link="https://example.com/a" />);
    mocks.state.favicons = {};
    const { container: withoutIcon } = render(<EntryIcon link="https://example.com/a" />);
    for (const container of [withIcon, withoutIcon]) {
      expect(container.children).toHaveLength(1);
      expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    }
  });

  test("reserves a blank decorative slot for an unparseable link", () => {
    const { container } = render(<EntryIcon link="not a url" />);
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.firstElementChild?.textContent).toBe("");
  });

  test("ignores prototype properties as hostname matches", () => {
    const { container } = render(<EntryIcon link="https://constructor/x" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("C")).toBeInTheDocument();
  });
});
