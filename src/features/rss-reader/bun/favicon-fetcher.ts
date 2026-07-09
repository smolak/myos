export type FetchFn = (url: URL | RequestInfo, init?: RequestInit) => Promise<Response>;

export interface FetchedFavicon {
  readonly iconData: Uint8Array | null;
  readonly contentType: string | null;
}

const NO_FAVICON: FetchedFavicon = { iconData: null, contentType: null };

export async function fetchFavicon(hostname: string, fetchFn: FetchFn = fetch): Promise<FetchedFavicon> {
  // http-only sites exist; without the fallback they would be cached as a permanent negative row
  for (const scheme of ["https", "http"] as const) {
    const icon = await fetchFaviconViaScheme(scheme, hostname, fetchFn);
    if (icon) return icon;
  }
  return NO_FAVICON;
}

async function fetchFaviconViaScheme(
  scheme: "https" | "http",
  hostname: string,
  fetchFn: FetchFn,
): Promise<FetchedFavicon | null> {
  const discoveredUrl = await discoverIconUrlFromSite(`${scheme}://${hostname}/`, fetchFn);
  if (discoveredUrl) {
    const icon = await downloadIcon(discoveredUrl, fetchFn);
    if (icon) return icon;
  }

  return downloadIcon(`${scheme}://${hostname}/favicon.ico`, fetchFn);
}

async function discoverIconUrlFromSite(rootUrl: string, fetchFn: FetchFn): Promise<string | null> {
  try {
    const response = await fetchFn(rootUrl);
    if (!response.ok) return null;
    return discoverIconUrl(await response.text(), rootUrl);
  } catch {
    return null;
  }
}

async function downloadIcon(url: string, fetchFn: FetchFn): Promise<FetchedFavicon | null> {
  try {
    const response = await fetchFn(url);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0) return null;
    return { iconData: bytes, contentType: response.headers.get("content-type") };
  } catch {
    return null;
  }
}

export function discoverIconUrl(html: string, baseUrl: string): string | null {
  const linkRe = /<link\s[^>]*>/gi;

  let m = linkRe.exec(html);
  while (m !== null) {
    const tag = m[0];
    const rel = attributeValue(tag, "rel");
    const href = attributeValue(tag, "href");
    const isIconRel = rel?.toLowerCase().split(/\s+/).some(isDisplayableIconToken);
    if (isIconRel && href) {
      return new URL(href, baseUrl).toString();
    }
    m = linkRe.exec(html);
  }

  return null;
}

function attributeValue(tag: string, name: "rel" | "href"): string | undefined {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i");
  const m = re.exec(tag);
  return m?.[1] ?? m?.[2] ?? m?.[3];
}

function isDisplayableIconToken(token: string): boolean {
  // mask-icon is a monochrome Safari pinned-tab template, not a favicon
  return token === "icon" || (token.endsWith("-icon") && token !== "mask-icon");
}
