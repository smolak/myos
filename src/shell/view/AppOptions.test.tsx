import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockGetOptions = vi.fn();
const mockUpdateOptions = vi.fn();
const mockGetDataDir = vi.fn();
const mockOpenInFinder = vi.fn();
const mockPickDataDir = vi.fn();
const mockSaveDataDir = vi.fn();
const mockGetVersion = vi.fn();

vi.mock("./electrobun", () => ({
  rpc: {
    request: {
      "app:get-options": (...args: unknown[]) => mockGetOptions(...args),
      "app:update-options": (...args: unknown[]) => mockUpdateOptions(...args),
      "app:get-data-dir": (...args: unknown[]) => mockGetDataDir(...args),
      "app:open-in-finder": (...args: unknown[]) => mockOpenInFinder(...args),
      "app:pick-data-dir": (...args: unknown[]) => mockPickDataDir(...args),
      "app:save-data-dir": (...args: unknown[]) => mockSaveDataDir(...args),
      "app:get-version": (...args: unknown[]) => mockGetVersion(...args),
    },
  },
}));

const { AppOptions } = await import("./AppOptions");

// Renders AppOptions and waits for all three async effects (background, dataDir, version) to settle.
async function renderAndSettle(onClose: () => void) {
  render(<AppOptions onClose={onClose} />);
  await waitFor(() => {
    expect(mockGetOptions).toHaveBeenCalled();
    expect(mockGetDataDir).toHaveBeenCalled();
    expect(mockGetVersion).toHaveBeenCalled();
  });
}

describe("AppOptions", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    mockGetOptions.mockResolvedValue({ background: null });
    mockUpdateOptions.mockResolvedValue({ success: true });
    mockGetDataDir.mockResolvedValue({ path: "/Users/test/.local/share/myos/data" });
    mockOpenInFinder.mockResolvedValue({ success: true });
    mockPickDataDir.mockResolvedValue({ path: null });
    mockSaveDataDir.mockResolvedValue({ success: true });
    mockGetVersion.mockResolvedValue({ version: "0.0.1", name: "myos" });
    document.body.style.background = "";
  });

  afterEach(() => {
    vi.clearAllMocks();
    onClose.mockClear();
  });

  test("renders three navigation sections", async () => {
    await renderAndSettle(onClose);
    expect(screen.getByRole("button", { name: /appearance/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /data/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /about/i })).toBeInTheDocument();
  });

  test("shows Appearance section by default", async () => {
    await renderAndSettle(onClose);
    expect(screen.getByText(/background/i)).toBeInTheDocument();
  });

  test("clicking Data nav shows data content", async () => {
    await renderAndSettle(onClose);
    fireEvent.click(screen.getByRole("button", { name: /^data$/i }));
    expect(screen.getByText(/database files/i)).toBeInTheDocument();
  });

  test("Data section shows current DB path", async () => {
    await renderAndSettle(onClose);
    fireEvent.click(screen.getByRole("button", { name: /^data$/i }));
    await waitFor(() => expect(screen.getByText("/Users/test/.local/share/myos/data")).toBeInTheDocument());
  });

  test("Data section Open in Finder button calls RPC", async () => {
    await renderAndSettle(onClose);
    fireEvent.click(screen.getByRole("button", { name: /^data$/i }));
    await waitFor(() => screen.getByText("/Users/test/.local/share/myos/data"));
    fireEvent.click(screen.getByRole("button", { name: /open in finder/i }));
    await waitFor(() => expect(mockOpenInFinder).toHaveBeenCalledWith({ path: "/Users/test/.local/share/myos/data" }));
  });

  test("Data section Change button calls pick-data-dir RPC", async () => {
    await renderAndSettle(onClose);
    fireEvent.click(screen.getByRole("button", { name: /^data$/i }));
    await waitFor(() => screen.getByText("/Users/test/.local/share/myos/data"));
    fireEvent.click(screen.getByRole("button", { name: /change/i }));
    await waitFor(() => expect(mockPickDataDir).toHaveBeenCalled());
  });

  test("Data section shows restart notice when new path is selected", async () => {
    mockPickDataDir.mockResolvedValue({ path: "/Users/test/newdir" });
    await renderAndSettle(onClose);
    fireEvent.click(screen.getByRole("button", { name: /^data$/i }));
    await waitFor(() => screen.getByText("/Users/test/.local/share/myos/data"));
    fireEvent.click(screen.getByRole("button", { name: /change/i }));
    await waitFor(() => expect(screen.getByText(/changes take effect on next launch/i)).toBeInTheDocument());
  });

  test("Data section persists new path via app:save-data-dir RPC", async () => {
    mockPickDataDir.mockResolvedValue({ path: "/Users/test/newdir" });
    await renderAndSettle(onClose);
    fireEvent.click(screen.getByRole("button", { name: /^data$/i }));
    await waitFor(() => screen.getByText("/Users/test/.local/share/myos/data"));
    fireEvent.click(screen.getByRole("button", { name: /change/i }));
    await waitFor(() => expect(mockSaveDataDir).toHaveBeenCalledWith({ path: "/Users/test/newdir" }));
  });

  test("clicking About nav shows about content", async () => {
    await renderAndSettle(onClose);
    fireEvent.click(screen.getByRole("button", { name: /about/i }));
    await waitFor(() => expect(screen.getByText(/0\.0\.1/)).toBeInTheDocument());
  });

  test("About section shows app version and name", async () => {
    await renderAndSettle(onClose);
    fireEvent.click(screen.getByRole("button", { name: /about/i }));
    await waitFor(() => {
      expect(screen.getByText(/0\.0\.1/)).toBeInTheDocument();
      expect(screen.getAllByText(/myos/i).length).toBeGreaterThan(0);
    });
  });

  test("About section shows backup note", async () => {
    await renderAndSettle(onClose);
    fireEvent.click(screen.getByRole("button", { name: /about/i }));
    await waitFor(() => expect(screen.getByText(/back up this folder/i)).toBeInTheDocument());
  });

  test("Close button calls onClose", async () => {
    await renderAndSettle(onClose);
    // Use exact name to avoid matching the backdrop's aria-label "Close app options"
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  test("clicking backdrop calls onClose", async () => {
    await renderAndSettle(onClose);
    fireEvent.click(screen.getByTestId("app-options-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });
});
