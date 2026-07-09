import { describe, expect, test } from "bun:test";
import { discoverIconUrl, fetchFavicon } from "./favicon-fetcher";

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const ICO_BYTES = new Uint8Array([0x00, 0x00, 0x01, 0x00]);

type FetchFn = (url: URL | RequestInfo, init?: RequestInit) => Promise<Response>;

function urlOf(input: URL | RequestInfo): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

describe("discoverIconUrl", () => {
  test("finds an absolute icon href in a link tag", () => {
    const html = `<html><head><link rel="icon" href="https://cdn.site-a.com/icon.png"></head></html>`;
    expect(discoverIconUrl(html, "https://site-a.com/")).toBe("https://cdn.site-a.com/icon.png");
  });

  test("resolves a relative href against the base URL", () => {
    const html = `<link rel="icon" href="/assets/favicon.svg">`;
    expect(discoverIconUrl(html, "https://site-a.com/")).toBe("https://site-a.com/assets/favicon.svg");
  });

  test("ignores link tags whose rel is not an icon", () => {
    const html = `<link rel="stylesheet" href="/main.css"><link rel="alternate" href="/feed.xml">`;
    expect(discoverIconUrl(html, "https://site-a.com/")).toBeNull();
  });

  test("accepts rel variants like 'shortcut icon' and 'apple-touch-icon' in any case", () => {
    const shortcut = `<link rel="SHORTCUT ICON" href="/fav.ico">`;
    expect(discoverIconUrl(shortcut, "https://site-a.com/")).toBe("https://site-a.com/fav.ico");

    const appleTouch = `<link rel="apple-touch-icon" href="/touch.png">`;
    expect(discoverIconUrl(appleTouch, "https://site-a.com/")).toBe("https://site-a.com/touch.png");
  });

  test("returns null when the page has no icon links", () => {
    expect(discoverIconUrl("<html><head><title>Hi</title></head></html>", "https://site-a.com/")).toBeNull();
  });
});

describe("fetchFavicon", () => {
  test("downloads the icon discovered in the site's root HTML", async () => {
    const fetchFn: FetchFn = async (input) => {
      const url = urlOf(input);
      if (url === "https://site-a.com/") {
        return new Response(`<link rel="icon" href="/assets/icon.png">`, {
          headers: { "content-type": "text/html" },
        });
      }
      if (url === "https://site-a.com/assets/icon.png") {
        return new Response(PNG_BYTES, { headers: { "content-type": "image/png" } });
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await fetchFavicon("site-a.com", fetchFn);

    expect(result.contentType).toBe("image/png");
    expect(result.iconData).toEqual(PNG_BYTES);
  });

  test("falls back to /favicon.ico when the HTML declares no icon", async () => {
    const fetchFn: FetchFn = async (input) => {
      const url = urlOf(input);
      if (url === "https://site-b.com/") {
        return new Response("<html><head></head></html>", { headers: { "content-type": "text/html" } });
      }
      if (url === "https://site-b.com/favicon.ico") {
        return new Response(ICO_BYTES, { headers: { "content-type": "image/x-icon" } });
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await fetchFavicon("site-b.com", fetchFn);

    expect(result.contentType).toBe("image/x-icon");
    expect(result.iconData).toEqual(ICO_BYTES);
  });

  test("returns a null icon when the host is unreachable", async () => {
    const fetchFn: FetchFn = async () => {
      throw new Error("Network down");
    };

    const result = await fetchFavicon("dead-host.com", fetchFn);

    expect(result).toEqual({ iconData: null, contentType: null });
  });

  test("falls back to /favicon.ico when the discovered icon fails to download", async () => {
    const fetchFn: FetchFn = async (input) => {
      const url = urlOf(input);
      if (url === "https://site-c.com/") {
        return new Response(`<link rel="icon" href="/gone.png">`, { headers: { "content-type": "text/html" } });
      }
      if (url === "https://site-c.com/favicon.ico") {
        return new Response(ICO_BYTES, { headers: { "content-type": "image/x-icon" } });
      }
      return new Response("Not Found", { status: 404 });
    };

    const result = await fetchFavicon("site-c.com", fetchFn);

    expect(result.contentType).toBe("image/x-icon");
    expect(result.iconData).toEqual(ICO_BYTES);
  });

  test("returns a null icon when even /favicon.ico is missing", async () => {
    const fetchFn: FetchFn = async (input) => {
      const url = urlOf(input);
      if (url === "https://site-d.com/") {
        return new Response("<html></html>", { headers: { "content-type": "text/html" } });
      }
      return new Response("Not Found", { status: 404 });
    };

    const result = await fetchFavicon("site-d.com", fetchFn);

    expect(result).toEqual({ iconData: null, contentType: null });
  });
});
