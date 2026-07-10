import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { EntryIcon } from "./EntryIcon";

const FAVICON_DATA_URL = "data:image/png;base64,AAAA";

describe("EntryIcon", () => {
  test("renders the cached favicon when the map has the link's hostname", () => {
    const { container } = render(
      <EntryIcon link="https://example.com/article" favicons={{ "example.com": FAVICON_DATA_URL }} />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", FAVICON_DATA_URL);
  });

  test("hides the favicon image from screen readers with an empty alt", () => {
    const { container } = render(
      <EntryIcon link="https://example.com/article" favicons={{ "example.com": FAVICON_DATA_URL }} />,
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("aria-hidden", "true");
    expect(img).toHaveAttribute("alt", "");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  test("renders a lettered placeholder when the hostname has no cached favicon", () => {
    render(<EntryIcon link="https://example.com/article" favicons={{}} />);
    expect(screen.getByText("E")).toBeInTheDocument();
  });

  test("hides the placeholder from screen readers", () => {
    render(<EntryIcon link="https://example.com/article" favicons={{}} />);
    expect(screen.getByText("E")).toHaveAttribute("aria-hidden", "true");
  });

  test("strips a leading www for the displayed letter", () => {
    render(<EntryIcon link="https://www.example.com/article" favicons={{}} />);
    expect(screen.getByText("E")).toBeInTheDocument();
  });

  test("renders distinct letters for different iconless hostnames", () => {
    const { container: a } = render(<EntryIcon link="https://alice.github.io/post" favicons={{}} />);
    const { container: b } = render(<EntryIcon link="https://bob.github.io/post" favicons={{}} />);
    expect(a.firstElementChild?.textContent).toBe("A");
    expect(b.firstElementChild?.textContent).toBe("B");
  });

  test("never reuses a favicon cached for a different subdomain", () => {
    const { container } = render(
      <EntryIcon link="https://bob.github.io/post" favicons={{ "alice.github.io": FAVICON_DATA_URL }} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  test("renders exactly one decorative slot whether or not a favicon is cached", () => {
    const { container: withIcon } = render(
      <EntryIcon link="https://example.com/a" favicons={{ "example.com": FAVICON_DATA_URL }} />,
    );
    const { container: withoutIcon } = render(<EntryIcon link="https://example.com/a" favicons={{}} />);
    for (const container of [withIcon, withoutIcon]) {
      expect(container.children).toHaveLength(1);
      expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    }
  });

  test("reserves a blank decorative slot for an unparseable link", () => {
    const { container } = render(<EntryIcon link="not a url" favicons={{}} />);
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.firstElementChild?.textContent).toBe("");
  });

  test("ignores prototype properties as hostname matches", () => {
    const { container } = render(<EntryIcon link="https://constructor/x" favicons={{}} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("C")).toBeInTheDocument();
  });
});
