import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [react()],
	root: "src/shell/view",
	build: {
		outDir: "../../../dist",
		emptyOutDir: true,
	},
	server: {
		port: 5173,
		strictPort: true,
	},
	resolve: {
		alias: {
			"@core": path.resolve(__dirname, "src/core"),
			"@shell": path.resolve(__dirname, "src/shell"),
			"@features": path.resolve(__dirname, "src/features"),
		},
	},
});
