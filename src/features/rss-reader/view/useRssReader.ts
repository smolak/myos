import { useState, useCallback } from "react";
import { nanoid } from "nanoid";
import { parseFeed } from "../shared/feed-parser";

type FetchXmlFn = (url: string) => Promise<string>;

let _fetchXml: FetchXmlFn = async (url) => {
	const response = await fetch(url);
	return response.text();
};

export function overrideFetchXml(fn: FetchXmlFn): void {
	_fetchXml = fn;
}

export interface StoredFeed {
	readonly id: string;
	readonly url: string;
	readonly title: string;
	readonly fetchIntervalMinutes: number;
	readonly lastFetchedAt: string | null;
}

export interface StoredEntry {
	readonly id: string;
	readonly feedId: string;
	readonly guid: string;
	readonly title: string;
	readonly link: string;
	readonly description: string | null;
	readonly publishedAt: string | null;
	readonly isRead: boolean;
	readonly createdAt: string;
}

interface StoredRssState {
	feeds: StoredFeed[];
	entries: StoredEntry[];
}

const STORAGE_KEY = "rss-reader:state";

function loadState(): StoredRssState {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) return JSON.parse(stored) as StoredRssState;
	} catch {
		// ignore corrupt storage
	}
	return { feeds: [], entries: [] };
}

function persist(state: StoredRssState): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export interface UseRssReaderReturn {
	readonly feeds: readonly StoredFeed[];
	readonly entries: readonly StoredEntry[];
	readonly unreadCount: number;
	readonly isLoading: boolean;
	addFeed(url: string): Promise<void>;
	deleteFeed(id: string): void;
	markRead(id: string): void;
	markUnread(id: string): void;
	refresh(): Promise<void>;
}

export function useRssReader(): UseRssReaderReturn {
	const [state, setState] = useState<StoredRssState>(loadState);
	const [isLoading, setIsLoading] = useState(false);

	const mutate = useCallback((updater: (prev: StoredRssState) => StoredRssState) => {
		setState((prev) => {
			const next = updater(prev);
			persist(next);
			return next;
		});
	}, []);

	const fetchFeedEntries = useCallback(
		async (feed: StoredFeed): Promise<StoredEntry[]> => {
			const xml = await _fetchXml(feed.url);
			const parsed = parseFeed(xml);

			return parsed.entries.map((entry) => ({
				id: nanoid(),
				feedId: feed.id,
				guid: entry.guid,
				title: entry.title,
				link: entry.link,
				description: entry.description,
				publishedAt: entry.publishedAt,
				isRead: false,
				createdAt: new Date().toISOString(),
			}));
		},
		[],
	);

	const addFeed = useCallback(
		async (url: string) => {
			const existing = state.feeds.find((f) => f.url === url);
			if (existing) return;

			const feed: StoredFeed = {
				id: nanoid(),
				url,
				title: url,
				fetchIntervalMinutes: 30,
				lastFetchedAt: null,
			};

			setIsLoading(true);
			let fetchedEntries: StoredEntry[];
			try {
				fetchedEntries = await fetchFeedEntries(feed);
			} finally {
				setIsLoading(false);
			}

			const now = new Date().toISOString();
			const updatedFeed: StoredFeed = { ...feed, lastFetchedAt: now };

			mutate((prev) => {
				const existingGuids = new Set(prev.entries.map((e) => `${e.feedId}:${e.guid}`));
				const newEntries = fetchedEntries.filter(
					(e) => !existingGuids.has(`${e.feedId}:${e.guid}`),
				);
				return {
					feeds: [...prev.feeds, updatedFeed],
					entries: [...newEntries, ...prev.entries],
				};
			});
		},
		[state.feeds, fetchFeedEntries, mutate],
	);

	const deleteFeed = useCallback(
		(id: string) => {
			mutate((prev) => ({
				feeds: prev.feeds.filter((f) => f.id !== id),
				entries: prev.entries.filter((e) => e.feedId !== id),
			}));
		},
		[mutate],
	);

	const markRead = useCallback(
		(id: string) => {
			mutate((prev) => ({
				...prev,
				entries: prev.entries.map((e) => (e.id === id ? { ...e, isRead: true } : e)),
			}));
		},
		[mutate],
	);

	const markUnread = useCallback(
		(id: string) => {
			mutate((prev) => ({
				...prev,
				entries: prev.entries.map((e) => (e.id === id ? { ...e, isRead: false } : e)),
			}));
		},
		[mutate],
	);

	const refresh = useCallback(async () => {
		if (state.feeds.length === 0) return;
		setIsLoading(true);
		try {
			for (const feed of state.feeds) {
				try {
					const fetchedEntries = await fetchFeedEntries(feed);
					const now = new Date().toISOString();
					mutate((prev) => {
						const existingGuids = new Set(prev.entries.map((e) => `${e.feedId}:${e.guid}`));
						const newEntries = fetchedEntries.filter(
							(e) => !existingGuids.has(`${e.feedId}:${e.guid}`),
						);
						return {
							feeds: prev.feeds.map((f) =>
								f.id === feed.id ? { ...f, lastFetchedAt: now } : f,
							),
							entries: [...newEntries, ...prev.entries],
						};
					});
				} catch {
					// Continue with other feeds on error
				}
			}
		} finally {
			setIsLoading(false);
		}
	}, [state.feeds, fetchFeedEntries, mutate]);

	const unreadCount = state.entries.filter((e) => !e.isRead).length;

	return {
		feeds: state.feeds,
		entries: state.entries,
		unreadCount,
		isLoading,
		addFeed,
		deleteFeed,
		markRead,
		markUnread,
		refresh,
	};
}
