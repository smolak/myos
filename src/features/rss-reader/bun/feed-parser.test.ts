import { describe, expect, test } from "bun:test";
import { parseFeed } from "../shared/feed-parser";

const RSS_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Blog</title>
    <description>A test blog</description>
    <item>
      <title>First Post</title>
      <link>https://example.com/post-1</link>
      <guid>https://example.com/post-1</guid>
      <description>Some description</description>
      <pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title><![CDATA[Second & Special Post]]></title>
      <link>https://example.com/post-2</link>
      <guid>post-2-unique-guid</guid>
      <description><![CDATA[<p>HTML description</p>]]></description>
      <pubDate>Tue, 02 Jan 2024 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Blog</title>
  <subtitle>An Atom blog</subtitle>
  <entry>
    <id>https://example.com/atom/1</id>
    <title>Atom Entry One</title>
    <link href="https://example.com/atom/1" rel="alternate"/>
    <summary>Summary text</summary>
    <published>2024-01-01T10:00:00Z</published>
  </entry>
  <entry>
    <id>urn:uuid:unique-2</id>
    <title><![CDATA[Atom &amp; Special Entry]]></title>
    <link href="https://example.com/atom/2"/>
    <summary>Another entry</summary>
    <updated>2024-01-02T10:00:00Z</updated>
  </entry>
</feed>`;

describe("parseFeed — RSS 2.0", () => {
  test("extracts feed title", () => {
    expect(parseFeed(RSS_FEED).title).toBe("Test Blog");
  });

  test("extracts feed description", () => {
    expect(parseFeed(RSS_FEED).description).toBe("A test blog");
  });

  test("extracts all items", () => {
    expect(parseFeed(RSS_FEED).entries).toHaveLength(2);
  });

  test("extracts plain text item fields", () => {
    const first = parseFeed(RSS_FEED).entries[0]!;
    expect(first.title).toBe("First Post");
    expect(first.link).toBe("https://example.com/post-1");
    expect(first.guid).toBe("https://example.com/post-1");
    expect(first.description).toBe("Some description");
  });

  test("extracts CDATA-wrapped title", () => {
    const second = parseFeed(RSS_FEED).entries[1]!;
    expect(second.title).toBe("Second & Special Post");
  });

  test("uses guid distinct from link when provided", () => {
    const second = parseFeed(RSS_FEED).entries[1]!;
    expect(second.guid).toBe("post-2-unique-guid");
  });

  test("parses pubDate to ISO string", () => {
    const first = parseFeed(RSS_FEED).entries[0]!;
    expect(first.publishedAt).toBe(new Date("Mon, 01 Jan 2024 10:00:00 GMT").toISOString());
  });
});

describe("parseFeed — Atom", () => {
  test("extracts feed title", () => {
    expect(parseFeed(ATOM_FEED).title).toBe("Atom Blog");
  });

  test("extracts feed description from subtitle", () => {
    expect(parseFeed(ATOM_FEED).description).toBe("An Atom blog");
  });

  test("extracts all entries", () => {
    expect(parseFeed(ATOM_FEED).entries).toHaveLength(2);
  });

  test("extracts entry fields", () => {
    const first = parseFeed(ATOM_FEED).entries[0]!;
    expect(first.title).toBe("Atom Entry One");
    expect(first.link).toBe("https://example.com/atom/1");
    expect(first.guid).toBe("https://example.com/atom/1");
    expect(first.description).toBe("Summary text");
  });

  test("parses published date to ISO string", () => {
    const first = parseFeed(ATOM_FEED).entries[0]!;
    expect(first.publishedAt).toBe("2024-01-01T10:00:00.000Z");
  });

  test("extracts CDATA title with entities", () => {
    const second = parseFeed(ATOM_FEED).entries[1]!;
    expect(second.title).toBe("Atom & Special Entry");
  });

  test("falls back to updated when published is missing", () => {
    const second = parseFeed(ATOM_FEED).entries[1]!;
    expect(second.publishedAt).toBe("2024-01-02T10:00:00.000Z");
  });
});

describe("parseFeed — edge cases", () => {
  test("falls back to link when guid is missing", () => {
    const xml = `<rss version="2.0"><channel><title>T</title>
      <item><title>I</title><link>https://x.com/1</link></item>
    </channel></rss>`;
    expect(parseFeed(xml).entries[0]?.guid).toBe("https://x.com/1");
  });

  test("null publishedAt when no date present", () => {
    const xml = `<rss version="2.0"><channel><title>T</title>
      <item><title>I</title><link>https://x.com/1</link><guid>g1</guid></item>
    </channel></rss>`;
    expect(parseFeed(xml).entries[0]?.publishedAt).toBeNull();
  });

  test("null description when missing", () => {
    const xml = `<rss version="2.0"><channel><title>T</title>
      <item><title>I</title><link>https://x.com/1</link><guid>g1</guid></item>
    </channel></rss>`;
    expect(parseFeed(xml).entries[0]?.description).toBeNull();
  });
});
