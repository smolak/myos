import { useEffect, useRef } from "react";
import type { Command } from "./command-registry";
import { commandRegistry } from "./command-registry";

// Registers a palette command for the lifetime of the component. The command
// is registered once; its action delegates through a ref so re-renders swap
// in the latest closure without churning the registry.
export function useRegisterCommand(command: Command): void {
  const latest = useRef(command);
  latest.current = command;

  useEffect(() => {
    return commandRegistry.register({
      ...latest.current,
      action: () => latest.current.action(),
    });
  }, []);
}
