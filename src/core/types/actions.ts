export type ExecutionStatus = "pending" | "running" | "completed" | "failed";

export interface ScriptExecution {
	id: string;
	scriptId: string;
	triggeredBy: string;
	triggerPayload: string | null;
	status: ExecutionStatus;
	createdAt: string;
	completedAt: string | null;
}

export interface ExecutionAction {
	id: string;
	executionId: string;
	sequence: number;
	featureId: string;
	actionName: string;
	params: string;
	dependsOn: number | null;
	outputKey: string | null;
	status: ExecutionStatus;
	result: string | null;
	error: string | null;
	retryCount: number;
	createdAt: string;
	completedAt: string | null;
}
