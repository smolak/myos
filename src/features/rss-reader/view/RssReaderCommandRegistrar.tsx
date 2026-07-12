import { useRegisterCommand } from "@shell/view/useRegisterCommand";
import { useRssReaderContext } from "./RssReaderContext";

export function RssReaderCommandRegistrar() {
  const { refresh } = useRssReaderContext();

  useRegisterCommand({
    id: "rss:refresh-feeds",
    label: "Refresh RSS Feeds",
    description: "Fetch new entries from all configured feeds",
    group: "RSS Reader",
    keywords: ["rss", "feed", "refresh", "ingest", "fetch", "update", "reload"],
    action: () => {
      void refresh();
    },
  });

  return null;
}
