import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { rpc } from "./electrobun";
import { overrideFetchXml } from "@features/rss-reader/view/useRssReader";
import { overrideFetchJson } from "@features/weather/view/useWeather";

overrideFetchXml((url) => rpc.request["fetch-feed"]({ url }));
overrideFetchJson((url) => rpc.request["fetch-json"]({ url }));

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
