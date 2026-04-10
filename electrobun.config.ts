import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "MyOS",
		identifier: "dev.myos.app",
		version: "0.0.1",
	},
	runtime: {
		exitOnLastWindowClosed: false,
	},
	build: {
		bun: {
			entrypoint: "src/shell/bun/main.ts",
		},
		copy: {
			"dist/index.html": "views/dashboard/index.html",
			"dist/assets": "views/dashboard/assets",
		},
		watchIgnore: ["dist/**"],
		mac: {
			bundleCEF: false,
		},
		linux: {
			bundleCEF: false,
		},
		win: {
			bundleCEF: false,
		},
	},
} satisfies ElectrobunConfig;
