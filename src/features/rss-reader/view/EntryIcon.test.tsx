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

  test("favicon image is decorative: hidden from screen readers with empty alt", () => {
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

  test("placeholder is decorative: hidden from screen readers", () => {
    render(<EntryIcon link="https://example.com/article" favicons={{}} />);
    expect(screen.getByText("E")).toHaveAttribute("aria-hidden", "true");
  });

  test("placeholder strips a leading www for the displayed letter", () => {
    render(<EntryIcon link="https://www.example.com/article" favicons={{}} />);
    expect(screen.getByText("E")).toBeInTheDocument();
  });

  test("different iconless hostnames produce distinct letters and colors", () => {
    const { container: a } = render(<EntryIcon link="https://alice.github.io/post" favicons={{}} />);
    const { container: b } = render(<EntryIcon link="https://bob.github.io/post" favicons={{}} />);
    const spanA = a.firstElementChild as HTMLElement;
    const spanB = b.firstElementChild as HTMLElement;
    expect(spanA.textContent).toBe("A");
    expect(spanB.textContent).toBe("B");
    expect(spanA.style.backgroundColor).not.toBe(spanB.style.backgroundColor);
  });

  test("exact-hostname identity: favicon for one subdomain never leaks to another", () => {
    const { container } = render(
      <EntryIcon link="https://bob.github.io/post" favicons={{ "alice.github.io": FAVICON_DATA_URL }} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  test("favicon and placeholder reserve identical 16px space", () => {
    const { container: withIcon } = render(
      <EntryIcon link="https://example.com/a" favicons={{ "example.com": FAVICON_DATA_URL }} />,
    );
    const { container: withoutIcon } = render(<EntryIcon link="https://example.com/a" favicons={{}} />);
    for (const el of [withIcon.firstElementChild, withoutIcon.firstElementChild]) {
      expect(el?.className).toContain("w-4");
      expect(el?.className).toContain("h-4");
      expect(el?.className).toContain("shrink-0");
    }
  });

  test("unparseable link still reserves the icon space with a blank decorative slot", () => {
    const { container } = render(<EntryIcon link="not a url" favicons={{}} />);
    const slot = container.firstElementChild as HTMLElement;
    expect(slot).not.toBeNull();
    expect(slot.getAttribute("aria-hidden")).toBe("true");
    expect(slot.className).toContain("w-4");
    expect(slot.className).toContain("h-4");
    expect(slot.textContent).toBe("");
  });
});
