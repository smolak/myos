import { commandRegistry } from "@shell/view/command-registry";
import { useEffect } from "react";
import { useSnippetsContext } from "./SnippetsContext";

export function SnippetsCommandRegistrar() {
  const { snippets, expand } = useSnippetsContext();

  useEffect(() => {
    if (snippets.length === 0) return;
    return commandRegistry.registerMany(
      snippets.map((s) => ({
        id: `snippets:expand:${s.id}`,
        label: `Expand Snippet: ${s.name}`,
        description: s.template.length > 60 ? `${s.template.slice(0, 60)}…` : s.template,
        group: "Snippets",
        keywords: ["snippet", "template", "expand", "copy"],
        action: () => {
          void expand(s.id).then((text) => navigator.clipboard.writeText(text));
        },
      })),
    );
  }, [snippets, expand]);

  return null;
}
