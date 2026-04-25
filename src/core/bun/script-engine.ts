import type { Database } from "bun:sqlite";
import { AsyncLocalStorage } from "node:async_hooks";
import type { ScriptContext } from "@core/types";
import { nanoid } from "nanoid";
import type { ActionQueue } from "./action-queue";
import type { EventBus } from "./event-bus";

interface ScriptRow {
  id: string;
  name: string;
  code: string;
}

interface ExecutionState {
  id: string;
  sequence: number;
}

export class ScriptEngine {
  private readonly executionStorage = new AsyncLocalStorage<ExecutionState>();

  constructor(
    private readonly coreDb: Database,
    private readonly eventBus: EventBus,
    private readonly actionQueue: ActionQueue,
  ) {}

  start(): void {
    const scripts = this.coreDb.query<ScriptRow, []>("SELECT id, name, code FROM scripts WHERE enabled = 1").all();

    for (const script of scripts) {
      this.initializeScript(script);
    }
  }

  private initializeScript(script: ScriptRow): void {
    let scriptFn: (ctx: ScriptContext) => void;
    try {
      scriptFn = evalScript(script.code);
    } catch (_err) {
      return;
    }

    const registeredHandlers: Array<{
      event: string;
      handler: (payload: unknown) => Promise<void>;
    }> = [];

    const ctx: ScriptContext = {
      on(event: string, handler: (payload: unknown) => Promise<void>): void {
        registeredHandlers.push({ event, handler });
      },
      queries: buildQueriesProxy(this.actionQueue),
      actions: this.buildActionsProxy(),
      log: (_msg: string) => {},
      store: this.buildStore(script.id),
      match: matchPatterns,
    };

    try {
      scriptFn(ctx);
    } catch (_err) {
      return;
    }

    for (const { event, handler } of registeredHandlers) {
      this.eventBus.subscribe(event, (payload) => this.runHandler(script.id, script.name, event, payload, handler));
    }
  }

  private async runHandler(
    scriptId: string,
    _scriptName: string,
    eventName: string,
    payload: unknown,
    handler: (payload: unknown) => Promise<void>,
  ): Promise<void> {
    const executionId = nanoid();
    const now = new Date().toISOString();

    this.coreDb
      .query(
        "INSERT INTO script_executions (id, script_id, triggered_by, trigger_payload, status, created_at) VALUES (?, ?, ?, ?, 'running', ?)",
      )
      .run(executionId, scriptId, eventName, payload !== undefined ? JSON.stringify(payload) : null, now);

    const state: ExecutionState = { id: executionId, sequence: 0 };

    try {
      await this.executionStorage.run(state, () => handler(payload));
      this.coreDb
        .query("UPDATE script_executions SET status = 'completed', completed_at = ? WHERE id = ?")
        .run(new Date().toISOString(), executionId);
    } catch (_err) {
      this.coreDb
        .query("UPDATE script_executions SET status = 'failed', completed_at = ? WHERE id = ?")
        .run(new Date().toISOString(), executionId);
    }
  }

  private buildActionsProxy(): Record<string, Record<string, (params: unknown) => Promise<unknown>>> {
    const { coreDb, actionQueue, executionStorage } = this;

    return new Proxy({} as Record<string, Record<string, (params: unknown) => Promise<unknown>>>, {
      get(_target, featureId: string) {
        return new Proxy({} as Record<string, (params: unknown) => Promise<unknown>>, {
          get(_target, actionName: string) {
            return async (params: unknown): Promise<unknown> => {
              const exec = executionStorage.getStore();
              if (!exec) throw new Error("ctx.actions called outside of script execution context");

              const seq = ++exec.sequence;
              actionQueue.enqueue(exec.id, [{ sequence: seq, featureId, actionName, params }]);
              await actionQueue.processExecution(exec.id);

              const row = coreDb
                .query<{ result: string | null; status: string; error: string | null }, [string, number]>(
                  "SELECT result, status, error FROM execution_actions WHERE execution_id = ? AND sequence = ?",
                )
                .get(exec.id, seq);

              if (row?.status === "failed") {
                throw new Error(row.error ?? `Action ${featureId}:${actionName} failed`);
              }

              return row?.result !== null && row?.result !== undefined ? JSON.parse(row.result) : undefined;
            };
          },
        });
      },
    });
  }

  private buildStore(scriptId: string): ScriptContext["store"] {
    const { coreDb } = this;
    return {
      get<T>(key: string): T | undefined {
        const row = coreDb
          .query<{ value: string | null }, [string, string]>(
            "SELECT value FROM script_store WHERE script_id = ? AND key = ?",
          )
          .get(scriptId, key);
        if (!row || row.value === null) return undefined;
        return JSON.parse(row.value) as T;
      },
      async set(key: string, value: unknown): Promise<void> {
        coreDb
          .query(
            "INSERT INTO script_store (script_id, key, value, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (script_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
          )
          .run(scriptId, key, JSON.stringify(value), new Date().toISOString());
      },
    };
  }
}

function buildQueriesProxy(
  actionQueue: ActionQueue,
): Record<string, Record<string, (params: unknown) => Promise<unknown>>> {
  return new Proxy({} as Record<string, Record<string, (params: unknown) => Promise<unknown>>>, {
    get(_target, featureId: string) {
      return new Proxy({} as Record<string, (params: unknown) => Promise<unknown>>, {
        get(_target, queryName: string) {
          return (params: unknown) => actionQueue.executeQuery(featureId, queryName, params);
        },
      });
    },
  });
}

function evalScript(code: string): (ctx: ScriptContext) => void {
  // Scripts are stored as the function body receiving `ctx` as the sole parameter.
  // Using new Function prevents scripts from accessing module scope (network, fs, etc.).
  // eslint-disable-next-line no-new-func
  return new Function("ctx", code) as (ctx: ScriptContext) => void;
}

function matchPatterns(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const regexStr = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${regexStr}$`).test(value);
  });
}
