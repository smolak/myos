export interface ParsedEntry {
  readonly guid: string;
  readonly title: string;
  readonly link: string;
  readonly description: string | null;
  readonly publishedAt: string | null;
}

export interface ParsedFeed {
  readonly title: string;
  readonly description: string | null;
  readonly entries: ParsedEntry[];
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function getText(xml: string, tag: string): string | null {
  const cdataRe = new RegExp(`<${tag}(?:\\s[^>]*)?>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, "i");
  const cdataM = cdataRe.exec(xml);
  if (cdataM) return decodeEntities(cdataM[1]?.trim()) || null;

  const plainRe = new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)<\\/${tag}>`, "i");
  const plainM = plainRe.exec(xml);
  if (plainM) return decodeEntities(plainM[1]?.trim()) || null;

  return null;
}

function getAttr(xml: string, tag: string, attr: string): string | null {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, "i");
  const m = re.exec(xml);
  return m ? (m[1] ?? null) : null;
}

function splitBlocks(xml: string, tag: string): string[] {
  const blocks: string[] = [];
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi");
  let m = re.exec(xml);
  while (m !== null) {
    blocks.push(m[0]);
    m = re.exec(xml);
  }
  return blocks;
}

function toIso(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseRss(xml: string): ParsedFeed {
  const channelM = /<channel>([\s\S]*?)<\/channel>/i.exec(xml);
  const channelXml = channelM ? (channelM[1] ?? xml) : xml;

  const itemStart = channelXml.indexOf("<item");
  const channelHeader = itemStart > -1 ? channelXml.slice(0, itemStart) : channelXml;

  const title = getText(channelHeader, "title") ?? "Untitled Feed";
  const description = getText(channelHeader, "description");

  const entries: ParsedEntry[] = splitBlocks(channelXml, "item").map((item) => {
    const entryTitle = getText(item, "title") ?? "Untitled";
    const link = getText(item, "link") ?? "";
    const guid = getText(item, "guid") ?? link;
    const desc = getText(item, "description");
    const publishedAt = toIso(getText(item, "pubDate"));
    return { guid, title: entryTitle, link, description: desc, publishedAt };
  });

  return { title, description, entries };
}

function parseAtom(xml: string): ParsedFeed {
  const entryStart = xml.indexOf("<entry");
  const feedHeader = entryStart > -1 ? xml.slice(0, entryStart) : xml;

  const title = getText(feedHeader, "title") ?? "Untitled Feed";
  const description = getText(feedHeader, "subtitle") ?? getText(feedHeader, "description");

  const entries: ParsedEntry[] = splitBlocks(xml, "entry").map((entry) => {
    const entryTitle = getText(entry, "title") ?? "Untitled";
    const linkHref = getAttr(entry, "link", "href") ?? "";
    const link = linkHref || (getText(entry, "link") ?? "");
    const guid = getText(entry, "id") ?? link;
    const desc = getText(entry, "summary") ?? getText(entry, "content");
    const publishedAt = toIso(getText(entry, "published") ?? getText(entry, "updated"));
    return { guid, title: entryTitle, link, description: desc, publishedAt };
  });

  return { title, description, entries };
}

export function parseFeed(xml: string): ParsedFeed {
  const trimmed = xml.trim();
  if (/<feed[\s>]/i.test(trimmed)) {
    return parseAtom(trimmed);
  }
  return parseRss(trimmed);
}
