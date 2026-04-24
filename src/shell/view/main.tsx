import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { rpc } from "./electrobun";
import { overrideFetchXml } from "@features/rss-reader/view/useRssReader";

overrideFetchXml((url) => rpc.request["fetch-feed"]({ url }));

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
