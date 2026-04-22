export interface ScriptStore {
	get<T>(key: string): T | undefined;
	set(key: string, value: unknown): Promise<void>;
}

export interface ScriptContext {
	on(event: string, handler: (payload: unknown) => Promise<void>): void;
	queries: Record<string, Record<string, (params: unknown) => Promise<unknown>>>;
	actions: Record<string, Record<string, (params: unknown) => Promise<unknown>>>;
	log(message: string): void;
	store: ScriptStore;
	match(value: string, patterns: string[]): boolean;
}
