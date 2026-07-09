export type FetchFn = (url: URL | RequestInfo, init?: RequestInit) => Promise<Response>;

export interface FetchedFavicon {
  readonly iconData: Uint8Array | null;
  readonly contentType: string | null;
}

const NO_FAVICON: FetchedFavicon = { iconData: null, contentType: null };

export async function fetchFavicon(hostname: string, fetchFn: FetchFn = fetch): Promise<FetchedFavicon> {
  const rootUrl = `https://${hostname}/`;
  const fallbackUrl = `https://${hostname}/favicon.ico`;

  const discoveredUrl = await discoverIconUrlFromSite(rootUrl, fetchFn);
  if (discoveredUrl) {
    const icon = await downloadIcon(discoveredUrl, fetchFn);
    if (icon) return icon;
  }

  return (await downloadIcon(fallbackUrl, fetchFn)) ?? NO_FAVICON;
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
  const relRe = /\brel\s*=\s*"([^"]*)"/i;
  const hrefRe = /\bhref\s*=\s*"([^"]*)"/i;

  let m = linkRe.exec(html);
  while (m !== null) {
    const tag = m[0];
    const rel = relRe.exec(tag)?.[1];
    const href = hrefRe.exec(tag)?.[1];
    const isIconRel = rel
      ?.toLowerCase()
      .split(/\s+/)
      .some((token) => token === "icon" || token.endsWith("-icon"));
    if (isIconRel && href) {
      return new URL(href, baseUrl).toString();
    }
    m = linkRe.exec(html);
  }

  return null;
}
