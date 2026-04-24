export type ExecutionStatus = "pending" | "running" | "completed" | "failed";

export interface ScriptExecution {
  readonly id: string;
  readonly scriptId: string;
  readonly triggeredBy: string;
  readonly triggerPayload: string | null;
  readonly status: ExecutionStatus;
  readonly createdAt: string;
  readonly completedAt: string | null;
}

export interface ExecutionAction {
  readonly id: string;
  readonly executionId: string;
  readonly sequence: number;
  readonly featureId: string;
  readonly actionName: string;
  readonly params: string;
  readonly dependsOn: number | null;
  readonly outputKey: string | null;
  readonly status: ExecutionStatus;
  readonly result: string | null;
  readonly error: string | null;
  readonly retryCount: number;
  readonly correlationId: string | null;
  readonly maxRetries: number;
  readonly createdAt: string;
  readonly completedAt: string | null;
}
