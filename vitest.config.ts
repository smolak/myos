import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "jsdom",
		include: [
			"src/shell/view/**/*.test.{ts,tsx}",
			"src/features/**/view/**/*.test.{ts,tsx}",
			"src/core/ui/**/*.test.{ts,tsx}",
		],
		globals: true,
		passWithNoTests: true,
	},
	resolve: {
		alias: {
			"@core": path.resolve(__dirname, "src/core"),
			"@shell": path.resolve(__dirname, "src/shell"),
			"@features": path.resolve(__dirname, "src/features"),
		},
	},
});
