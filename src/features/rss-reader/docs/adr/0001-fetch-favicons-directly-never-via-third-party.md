# Fetch favicons directly from each site, never via a third-party favicon service

Entry favicons are fetched bun-side from the link's own host (HTML `<link rel="icon">` discovery, falling back to `/favicon.ico`), with a locally generated placeholder when a site yields nothing. Favicon services (Google `s2/favicons`, DuckDuckGo icons) were rejected despite being a one-line integration: they would ship the hostname of every article the reader receives — effectively the user's entire reading list — to a third party, which is incompatible with MyOS being privacy-first.

## Consequences

- Direct fetching still reveals the user's IP to each article's host for entries never clicked. Accepted: it is the same class of traffic as fetching the feed itself, and no single party observes the whole reading list.
- We own icon discovery and its failure modes (missing icons, odd formats) instead of outsourcing them.
