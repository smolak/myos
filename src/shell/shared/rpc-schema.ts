import type { ElectrobunRPCSchema } from "electrobun/bun";

export interface AppRPCSchema extends ElectrobunRPCSchema {
	bun: {
		requests: {
			"fetch-feed": { params: { url: string }; response: string };
		};
		messages: Record<never, never>;
	};
	webview: {
		requests: Record<never, never>;
		messages: Record<never, never>;
	};
}
