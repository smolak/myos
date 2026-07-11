# RSS Reader

Subscribes to RSS/Atom feeds, collects their entries, and tracks what the user has read.

## Language

**Feed**:
A subscribed RSS/Atom source, identified by its feed URL, that is periodically fetched for new entries.
_Avoid_: Subscription, channel, source

**Entry**:
A single item published by a Feed, carrying a link to the article it announces.
_Avoid_: Article, item, post

**Favicon**:
The icon of the website an Entry's link points to, identified by the link's exact hostname.
_Avoid_: Site icon, page icon, and especially feed icon — a Favicon belongs to a link's host, never to the Feed.

**Ingest**:
The periodic pipeline that fetches all Feeds, stores new Entries, announces them, and acquires Favicons for the Entries' hostnames. Fetching is one step of an Ingest; "fetch" alone refers to the read-only Query sense defined in the Core language.
_Avoid_: Sync, poll, refresh (as names for the whole pipeline)
