import {
	BrowserWindow,
	type ElectrobunEvent,
	Tray,
	Updater,
	Utils,
} from "electrobun/bun";

const APP_TITLE = "MyOS";
const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

async function getDashboardUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		} catch {
			console.log(
				"Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
			);
		}
	}
	return "views://dashboard/index.html";
}

const WINDOW_FRAME = {
	width: 900,
	height: 700,
	x: 200,
	y: 200,
} as const;

let mainWindow: BrowserWindow | null = null;

function attachCloseHandler(win: BrowserWindow) {
	win.on("close", () => {
		mainWindow = null;
	});
}

function createMainWindow(url: string): BrowserWindow {
	const win = new BrowserWindow({
		title: APP_TITLE,
		url,
		frame: WINDOW_FRAME,
	});
	// attachCloseHandler(win);
	mainWindow = win;
	return win;
}

// async function showDashboard() {
// 	const url = await getDashboardUrl();
// 	if (mainWindow) {
// 		const existing = BrowserWindow.getById(mainWindow.id);
// 		if (existing) {
// 			existing.show();
// 			if (existing.isMinimized()) {
// 				existing.unminimize();
// 			}
// 			return;
// 		}
// 		mainWindow = null;
// 	}
// 	createMainWindow(url);
// }

// function hideDashboard() {
// 	if (!mainWindow) return;
// 	const win = BrowserWindow.getById(mainWindow.id);
// 	if (win) {
// 		win.minimize();
// 	}
// }

const initialUrl = await getDashboardUrl();
createMainWindow(initialUrl);

// const tray = new Tray({
// 	title: APP_TITLE,
// 	template: true,
// });

// tray.setMenu([
// 	{ type: "normal", label: "Show", action: "show" },
// 	{ type: "normal", label: "Hide", action: "hide" },
// 	{ type: "divider" },
// 	{ type: "normal", label: "Quit", action: "quit" },
// ]);

// tray.on("tray-clicked", (raw) => {
// 	const event = raw as ElectrobunEvent<
// 		{ id: number; action: string; data?: unknown },
// 		{ allow: boolean }
// 	>;

// 	switch (event.data.action) {
// 		case "show":
// 			void showDashboard();
// 			break;
// 		case "hide":
// 			hideDashboard();
// 			break;
// 		case "quit":
// 			Utils.quit();
// 			break;
// 		default:
// 			break;
// 	}
// });

console.log(`${APP_TITLE} started — tray app with dashboard shell`);
