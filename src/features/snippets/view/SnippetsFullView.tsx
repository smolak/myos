import { useState } from "react";
import type { Snippet } from "../shared/types";
import { useSnippetsContext } from "./SnippetsContext";

interface Props {
  onClose?: () => void;
}

function SnippetItem({
  snippet,
  onToggleFavorite,
  onDelete,
  onCopy,
  onEdit,
}: {
  snippet: Snippet;
  onToggleFavorite: (id: string, isFavorite: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCopy: (id: string) => Promise<void>;
  onEdit: (snippet: Snippet) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await onCopy(snippet.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <li className="py-3 border-b border-zinc-800 last:border-0">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-200">{snippet.name}</p>
          <p className="text-xs text-zinc-500 mt-0.5 font-mono truncate">{snippet.template}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void onToggleFavorite(snippet.id, !snippet.isFavorite)}
            className={`text-xs transition-colors ${snippet.isFavorite ? "text-yellow-400 hover:text-zinc-400" : "text-zinc-600 hover:text-yellow-400"}`}
            aria-label={snippet.isFavorite ? `Unstar ${snippet.name}` : `Star ${snippet.name}`}
          >
            {snippet.isFavorite ? "★" : "☆"}
          </button>
          <button
            type="button"
            onClick={() => onEdit(snippet)}
            className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
            aria-label={`Edit ${snippet.name}`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className={`text-xs transition-colors ${copied ? "text-emerald-400" : "text-zinc-400 hover:text-zinc-200"}`}
            aria-label={`Copy ${snippet.name}`}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            type="button"
            onClick={() => void onDelete(snippet.id)}
            className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
            aria-label={`Delete ${snippet.name}`}
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

function AddSnippetForm({ onCreate }: { onCreate: (name: string, template: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [template, setTemplate] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const trimmedName = name.trim();
    const trimmedTemplate = template.trim();
    if (!trimmedName || !trimmedTemplate) return;
    setError(null);
    try {
      await onCreate(trimmedName, trimmedTemplate);
      setName("");
      setTemplate("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">New snippet</h3>
      <input
        type="text"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full bg-zinc-800 rounded px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200 placeholder-zinc-600"
        aria-label="Snippet name"
      />
      <textarea
        placeholder={"Template — use {{date}}, {{time}}, {{datetime}}, {{clipboard}}"}
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        rows={3}
        className="w-full bg-zinc-800 rounded px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200 placeholder-zinc-600 resize-none font-mono"
        aria-label="Snippet template"
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={!name.trim() || !template.trim()}
          className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 px-4 py-2 rounded text-sm transition-colors text-zinc-200"
        >
          Add
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function EditSnippetForm({
  snippet,
  onUpdate,
  onCancel,
}: {
  snippet: Snippet;
  onUpdate: (id: string, params: { name?: string; template?: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(snippet.name);
  const [template, setTemplate] = useState(snippet.template);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmedName = name.trim();
    const trimmedTemplate = template.trim();
    if (!trimmedName || !trimmedTemplate) return;
    setError(null);
    try {
      await onUpdate(snippet.id, { name: trimmedName, template: trimmedTemplate });
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-2 bg-zinc-900 border border-zinc-700 rounded-lg p-4">
      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Edit snippet</h3>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full bg-zinc-800 rounded px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200"
        aria-label="Snippet name"
      />
      <textarea
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        rows={3}
        className="w-full bg-zinc-800 rounded px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200 resize-none font-mono"
        aria-label="Snippet template"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors px-3 py-1.5"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!name.trim() || !template.trim()}
          className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 px-4 py-1.5 rounded text-sm transition-colors text-zinc-200"
        >
          Save
        </button>
      </div>
    </div>
  );
}

export function SnippetsFullView({ onClose }: Props) {
  const { snippets, create, update, remove, expand } = useSnippetsContext();
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);

  async function handleCopy(id: string) {
    const text = await expand(id);
    await navigator.clipboard.writeText(text);
  }

  async function handleToggleFavorite(id: string, isFavorite: boolean) {
    await update(id, { isFavorite });
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <h2 className="text-lg font-semibold">Snippets</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 text-sm"
            aria-label="Close"
          >
            Close
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {editingSnippet ? (
          <EditSnippetForm snippet={editingSnippet} onUpdate={update} onCancel={() => setEditingSnippet(null)} />
        ) : (
          <AddSnippetForm onCreate={create} />
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Your snippets</h3>
            <p className="text-xs text-zinc-600">
              Variables: <span className="font-mono">{"{{date}} {{time}} {{datetime}} {{clipboard}}"}</span>
            </p>
          </div>
          {snippets.length === 0 ? (
            <p className="text-zinc-600 text-sm text-center py-8">No snippets yet. Add one above.</p>
          ) : (
            <ul>
              {snippets.map((snippet) => (
                <SnippetItem
                  key={snippet.id}
                  snippet={snippet}
                  onToggleFavorite={handleToggleFavorite}
                  onDelete={remove}
                  onCopy={handleCopy}
                  onEdit={setEditingSnippet}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
