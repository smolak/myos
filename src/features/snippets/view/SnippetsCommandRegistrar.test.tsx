import { commandRegistry } from "@shell/view/command-registry";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Snippet } from "../shared/types";
import { SnippetsCommandRegistrar } from "./SnippetsCommandRegistrar";
import { SnippetsProvider } from "./SnippetsContext";

vi.mock("@shell/view/electrobun", () => ({
  rpc: {
    request: {
      "snippets:get-all": vi.fn().mockResolvedValue([]),
      "snippets:expand": vi.fn().mockResolvedValue({ text: "expanded text" }),
    },
  },
}));

function makeSnippet(overrides: Partial<Snippet> = {}): Snippet {
  return {
    id: "s1",
    name: "Greeting",
    template: "Hello there!",
    isFavorite: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

async function renderWithSnippets(snippets: Snippet[]) {
  const { rpc } = await import("@shell/view/electrobun");
  vi.mocked(rpc.request["snippets:get-all"]).mockResolvedValue(snippets);

  await act(async () => {
    render(
      <SnippetsProvider>
        <SnippetsCommandRegistrar />
      </SnippetsProvider>,
    );
  });
  return rpc;
}

describe("SnippetsCommandRegistrar", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  test("registers one Expand Snippet command per snippet", async () => {
    await renderWithSnippets([makeSnippet(), makeSnippet({ id: "s2", name: "Sign-off" })]);

    const commands = commandRegistry.getAll().filter((c) => c.id.startsWith("snippets:expand:"));
    expect(commands).toHaveLength(2);
    expect(commands.map((c) => c.label)).toEqual(["Expand Snippet: Greeting", "Expand Snippet: Sign-off"]);
  });

  test("registers no expand commands when there are no snippets", async () => {
    await renderWithSnippets([]);

    expect(commandRegistry.getAll().filter((c) => c.id.startsWith("snippets:expand:"))).toHaveLength(0);
  });

  test("truncates long templates in the command description", async () => {
    const longTemplate = "x".repeat(80);
    await renderWithSnippets([makeSnippet({ template: longTemplate })]);

    const command = commandRegistry.getAll().find((c) => c.id === "snippets:expand:s1");
    expect(command?.description).toEqual(`${"x".repeat(60)}…`);
  });

  test("expands the snippet and copies the result to the clipboard when invoked", async () => {
    const rpc = await renderWithSnippets([makeSnippet()]);

    const command = commandRegistry.getAll().find((c) => c.id === "snippets:expand:s1");
    expect(command).toBeDefined();
    await act(async () => {
      command?.action();
    });

    expect(rpc.request["snippets:expand"]).toHaveBeenCalledWith(expect.objectContaining({ id: "s1" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("expanded text");
  });
});
