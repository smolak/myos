import type { Database } from "bun:sqlite";
import { nanoid } from "nanoid";
import type { ActionMeta } from "@core/types";

type ActionHandler = (params: unknown, meta: ActionMeta) => Promise<unknown>;
type QueryHandler = (params: unknown) => Promise<unknown>;

export interface EnqueueInput {
  sequence: number;
  featureId: string;
  actionName: string;
  params: unknown;
  dependsOn?: number;
  outputKey?: string;
  correlationId?: string;
  maxRetries?: number;
}

interface ActionRow {
  id: string;
  execution_id: string;
  sequence: number;
  feature_id: string;
  action_name: string;
  params: string;
  depends_on: number | null;
  output_key: string | null;
  status: string;
  result: string | null;
  error: string | null;
  retry_count: number;
  correlation_id: string | null;
  max_retries: number;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_BACKOFF_MS = 1000;

export class ActionQueue {
  private readonly actionHandlers = new Map<string, ActionHandler>();
  private readonly queryHandlers = new Map<string, QueryHandler>();

  constructor(
    private readonly db: Database,
    private readonly baseBackoffMs = DEFAULT_BASE_BACKOFF_MS,
  ) {}

  registerHandler(featureId: string, actionName: string, handler: ActionHandler): void {
    this.actionHandlers.set(`${featureId}:${actionName}`, handler);
  }

  registerQueryHandler(featureId: string, queryName: string, handler: QueryHandler): void {
    this.queryHandlers.set(`${featureId}:${queryName}`, handler);
  }

  enqueue(executionId: string, actions: EnqueueInput[]): void {
    const now = new Date().toISOString();
    const insert = this.db.prepare(`
      INSERT INTO execution_actions
        (id, execution_id, sequence, feature_id, action_name, params, depends_on, output_key,
         correlation_id, max_retries, status, retry_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)
    `);

    const insertAll = this.db.transaction(() => {
      for (const action of actions) {
        insert.run(
          nanoid(),
          executionId,
          action.sequence,
          action.featureId,
          action.actionName,
          JSON.stringify(action.params),
          action.dependsOn ?? null,
          action.outputKey ?? null,
          action.correlationId ?? null,
          action.maxRetries ?? DEFAULT_MAX_RETRIES,
          now,
        );
      }
    });

    insertAll();
  }

  async processExecution(executionId: string): Promise<void> {
    // Reset 'running' to 'pending' to recover from a crashed prior run
    this.db
      .query("UPDATE execution_actions SET status = 'pending' WHERE execution_id = ? AND status = 'running'")
      .run(executionId);

    // Build output cache from already-completed actions
    const outputCache = new Map<string, unknown>();
    const completed = this.db
      .query<ActionRow, [string]>(
        "SELECT * FROM execution_actions WHERE execution_id = ? AND status = 'completed' ORDER BY sequence",
      )
      .all(executionId);

    for (const action of completed) {
      if (action.output_key && action.result) {
        outputCache.set(action.output_key, JSON.parse(action.result));
      }
    }

    // Process pending actions in sequence order
    const pending = this.db
      .query<ActionRow, [string]>(
        "SELECT * FROM execution_actions WHERE execution_id = ? AND status = 'pending' ORDER BY sequence",
      )
      .all(executionId);

    for (const action of pending) {
      if (action.depends_on !== null) {
        const dep = this.db
          .query<{ status: string }, [string, number]>(
            "SELECT status FROM execution_actions WHERE execution_id = ? AND sequence = ?",
          )
          .get(executionId, action.depends_on);

        if (dep?.status === "failed") {
          this.markFailed(action.id, `Dependency (sequence ${action.depends_on}) failed`);
          continue;
        }
        if (dep?.status !== "completed") {
          continue;
        }
      }

      await this.executeAction(action, outputCache);
    }
  }

  async executeQuery(featureId: string, queryName: string, params: unknown): Promise<unknown> {
    const handler = this.queryHandlers.get(`${featureId}:${queryName}`);
    if (!handler) {
      throw new Error(`No query handler registered for ${featureId}:${queryName}`);
    }
    return handler(params);
  }

  async dispatchAction(featureId: string, actionName: string, params: unknown): Promise<unknown> {
    const handler = this.actionHandlers.get(`${featureId}:${actionName}`);
    if (!handler) {
      throw new Error(`No action handler registered for ${featureId}:${actionName}`);
    }
    const meta: ActionMeta = {
      executionId: nanoid(),
      correlationId: nanoid(),
      retriedCount: 0,
    };
    return handler(params, meta);
  }

  async resumePending(): Promise<void> {
    const pendingExecutions = this.db
      .query<{ execution_id: string }, []>(
        "SELECT DISTINCT execution_id FROM execution_actions WHERE status IN ('pending', 'running')",
      )
      .all();

    for (const { execution_id } of pendingExecutions) {
      await this.processExecution(execution_id);
    }
  }

  private async executeAction(action: ActionRow, outputCache: Map<string, unknown>): Promise<void> {
    const handlerKey = `${action.feature_id}:${action.action_name}`;
    const handler = this.actionHandlers.get(handlerKey);

    if (!handler) {
      this.markFailed(action.id, `No handler registered for ${handlerKey}`);
      return;
    }

    // Check idempotency via correlationId
    if (action.correlation_id) {
      const cached = this.db
        .query<{ result: string | null }, [string, string]>(
          "SELECT result FROM execution_actions WHERE correlation_id = ? AND status = 'completed' AND id != ?",
        )
        .get(action.correlation_id, action.id);

      if (cached) {
        const result = cached.result !== null ? JSON.parse(cached.result) : null;
        this.completeAction(action.id, result);
        if (action.output_key) outputCache.set(action.output_key, result);
        return;
      }
    }

    this.db.query("UPDATE execution_actions SET status = 'running' WHERE id = ?").run(action.id);

    const resolvedParams = resolveRefs(JSON.parse(action.params), outputCache);
    let currentRetryCount = action.retry_count;

    while (true) {
      const meta: ActionMeta = {
        executionId: action.execution_id,
        correlationId: action.correlation_id ?? action.id,
        retriedCount: currentRetryCount,
      };

      try {
        const result = await handler(resolvedParams, meta);
        this.completeAction(action.id, result);
        if (action.output_key) outputCache.set(action.output_key, result);
        return;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        currentRetryCount++;

        this.db
          .query("UPDATE execution_actions SET retry_count = ?, error = ? WHERE id = ?")
          .run(currentRetryCount, error.message, action.id);

        if (currentRetryCount >= action.max_retries) {
          this.markFailed(action.id, error.message);
          return;
        }

        // Set pending for crash resilience during backoff sleep
        this.db.query("UPDATE execution_actions SET status = 'pending' WHERE id = ?").run(action.id);
        await Bun.sleep(this.baseBackoffMs * Math.pow(2, currentRetryCount - 1));
        this.db.query("UPDATE execution_actions SET status = 'running' WHERE id = ?").run(action.id);
      }
    }
  }

  private completeAction(id: string, result: unknown): void {
    this.db
      .query("UPDATE execution_actions SET status = 'completed', result = ?, completed_at = ? WHERE id = ?")
      .run(result !== undefined ? JSON.stringify(result) : null, new Date().toISOString(), id);
  }

  private markFailed(id: string, error: string): void {
    this.db
      .query("UPDATE execution_actions SET status = 'failed', error = ?, completed_at = ? WHERE id = ?")
      .run(error, new Date().toISOString(), id);
  }
}

function resolveRefs(value: unknown, outputCache: Map<string, unknown>): unknown {
  if (value === null || value === undefined || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => resolveRefs(item, outputCache));

  const obj = value as Record<string, unknown>;
  if ("$ref" in obj && typeof obj["$ref"] === "string" && Object.keys(obj).length === 1) {
    const key = obj["$ref"];
    return outputCache.has(key) ? outputCache.get(key) : obj;
  }

  const resolved: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    resolved[k] = resolveRefs(v, outputCache);
  }
  return resolved;
}
