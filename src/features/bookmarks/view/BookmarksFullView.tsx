import { useState } from "react";
import type { Bookmark } from "../shared/types";
import { useBookmarksContext } from "./BookmarksContext";

interface EditState {
  title: string;
  url: string;
  description: string;
  folder: string;
  tagsInput: string;
}

interface Props {
  onClose?: () => void;
}

function domain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function AddBookmarkForm({
  onCreate,
}: {
  onCreate: (title: string, url: string, description?: string, folder?: string, tags?: string[]) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [folder, setFolder] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();
    if (!trimmedTitle || !trimmedUrl) return;
    setError(null);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await onCreate(
        trimmedTitle,
        trimmedUrl,
        description.trim() || undefined,
        folder.trim() || undefined,
        tags.length > 0 ? tags : undefined,
      );
      setTitle("");
      setUrl("");
      setDescription("");
      setFolder("");
      setTagsInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") void handleAdd();
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">New bookmark</h3>
      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full bg-zinc-800 rounded px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200 placeholder-zinc-600"
        aria-label="Bookmark title"
      />
      <input
        type="url"
        placeholder="URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full bg-zinc-800 rounded px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200 placeholder-zinc-600"
        aria-label="Bookmark URL"
      />
      <input
        type="text"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full bg-zinc-800 rounded px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200 placeholder-zinc-600"
        aria-label="Description"
      />
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Folder (optional)"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          className="flex-1 bg-zinc-800 rounded px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200 placeholder-zinc-600"
          aria-label="Folder"
        />
        <input
          type="text"
          placeholder="Tags (comma-separated)"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          className="flex-1 bg-zinc-800 rounded px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200 placeholder-zinc-600"
          aria-label="Tags"
        />
      </div>
      <button
        type="button"
        onClick={() => void handleAdd()}
        disabled={!title.trim() || !url.trim()}
        className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 px-4 py-2 rounded text-sm transition-colors text-zinc-200 w-full"
      >
        Add bookmark
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function TagBadge({ tag }: { tag: string }) {
  return <span className="inline-block text-xs bg-zinc-800 text-zinc-400 rounded px-1.5 py-0.5">{tag}</span>;
}

function BookmarkItem({
  bookmark,
  onDelete,
  onUpdate,
  onOpen,
}: {
  bookmark: Bookmark;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (
    id: string,
    fields: { title?: string; url?: string; description?: string; folder?: string; tags?: string[] },
  ) => Promise<void>;
  onOpen: (url: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<EditState>({
    title: bookmark.title,
    url: bookmark.url,
    description: bookmark.description ?? "",
    folder: bookmark.folder ?? "",
    tagsInput: bookmark.tags.join(", "),
  });

  async function handleSave() {
    const tags = edit.tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    await onUpdate(bookmark.id, {
      title: edit.title,
      url: edit.url,
      description: edit.description || undefined,
      folder: edit.folder || undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="py-3 border-b border-zinc-800 last:border-0 space-y-2">
        <input
          type="text"
          value={edit.title}
          onChange={(e) => setEdit((s) => ({ ...s, title: e.target.value }))}
          className="w-full bg-zinc-800 rounded px-3 py-1.5 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200"
          aria-label="Edit title"
        />
        <input
          type="url"
          value={edit.url}
          onChange={(e) => setEdit((s) => ({ ...s, url: e.target.value }))}
          className="w-full bg-zinc-800 rounded px-3 py-1.5 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200"
          aria-label="Edit URL"
        />
        <input
          type="text"
          value={edit.description}
          onChange={(e) => setEdit((s) => ({ ...s, description: e.target.value }))}
          placeholder="Description (optional)"
          className="w-full bg-zinc-800 rounded px-3 py-1.5 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200 placeholder-zinc-600"
          aria-label="Edit description"
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={edit.folder}
            onChange={(e) => setEdit((s) => ({ ...s, folder: e.target.value }))}
            placeholder="Folder (optional)"
            className="flex-1 bg-zinc-800 rounded px-3 py-1.5 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200 placeholder-zinc-600"
            aria-label="Edit folder"
          />
          <input
            type="text"
            value={edit.tagsInput}
            onChange={(e) => setEdit((s) => ({ ...s, tagsInput: e.target.value }))}
            placeholder="Tags (comma-separated)"
            className="flex-1 bg-zinc-800 rounded px-3 py-1.5 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200 placeholder-zinc-600"
            aria-label="Edit tags"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!edit.title.trim() || !edit.url.trim()}
            className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 px-3 py-1 rounded text-xs transition-colors text-zinc-200"
            aria-label="Save"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1"
            aria-label="Cancel"
          >
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="py-3 border-b border-zinc-800 last:border-0">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => onOpen(bookmark.url)}
            className="text-sm text-zinc-200 truncate block text-left hover:text-white hover:underline transition-colors w-full"
            aria-label={`Open ${bookmark.title}`}
          >
            {bookmark.title}
          </button>
          <p className="text-xs text-zinc-500 truncate">{domain(bookmark.url)}</p>
          {bookmark.description && <p className="text-xs text-zinc-600 mt-0.5 truncate">{bookmark.description}</p>}
          <div className="flex flex-wrap gap-1 mt-1">
            {bookmark.folder && (
              <span className="inline-block text-xs bg-zinc-800 text-indigo-400 rounded px-1.5 py-0.5">
                {bookmark.folder}
              </span>
            )}
            {bookmark.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
            aria-label={`Edit ${bookmark.title}`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => void onDelete(bookmark.id)}
            className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
            aria-label={`Delete ${bookmark.title}`}
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}

function BookmarksList({
  bookmarks,
  searchQuery,
  activeTag,
  activeFolder,
  remove,
  update,
  openUrl,
}: {
  bookmarks: readonly Bookmark[];
  searchQuery: string;
  activeTag: string;
  activeFolder: string;
  remove: (id: string) => Promise<void>;
  update: (
    id: string,
    fields: { title?: string; url?: string; description?: string; folder?: string; tags?: string[] },
  ) => Promise<void>;
  openUrl: (url: string) => void;
}) {
  const filtered = bookmarks.filter((b) => {
    if (activeFolder && b.folder !== activeFolder) return false;
    if (activeTag && !b.tags.includes(activeTag)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        b.title.toLowerCase().includes(q) ||
        b.url.toLowerCase().includes(q) ||
        (b.description?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  if (filtered.length === 0) {
    return (
      <p className="text-zinc-600 text-sm text-center py-8">
        {bookmarks.length === 0 ? "No bookmarks yet. Add one above." : "No bookmarks match the current filter."}
      </p>
    );
  }

  return (
    <ul>
      {filtered.map((b) => (
        <BookmarkItem key={b.id} bookmark={b} onDelete={remove} onUpdate={update} onOpen={openUrl} />
      ))}
    </ul>
  );
}

export function BookmarksFullView({ onClose }: Props) {
  const { bookmarks, create, update, remove, openUrl } = useBookmarksContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [activeFolder, setActiveFolder] = useState("");

  const allTags = Array.from(new Set(bookmarks.flatMap((b) => b.tags))).sort();
  const allFolders = Array.from(new Set(bookmarks.map((b) => b.folder).filter(Boolean) as string[])).sort();

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <h2 className="text-lg font-semibold">Bookmarks</h2>
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
        <AddBookmarkForm onCreate={create} />

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Search bookmarks…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-800 rounded px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200 placeholder-zinc-600"
            aria-label="Search bookmarks"
          />

          {(allFolders.length > 0 || allTags.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {allFolders.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setActiveFolder((prev) => (prev === f ? "" : f))}
                  className={`text-xs rounded px-2 py-1 transition-colors ${
                    activeFolder === f ? "bg-indigo-600 text-white" : "bg-zinc-800 text-indigo-400 hover:bg-zinc-700"
                  }`}
                >
                  {f}
                </button>
              ))}
              {allTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveTag((prev) => (prev === t ? "" : t))}
                  className={`text-xs rounded px-2 py-1 transition-colors ${
                    activeTag === t ? "bg-zinc-500 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}

          <div>
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
              {bookmarks.length} bookmark{bookmarks.length !== 1 ? "s" : ""}
            </h3>
            <BookmarksList
              bookmarks={bookmarks}
              searchQuery={searchQuery}
              activeTag={activeTag}
              activeFolder={activeFolder}
              remove={remove}
              update={update}
              openUrl={openUrl}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
