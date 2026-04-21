import type { FeatureDefinition } from "@core/types";
import type { TodoEvents, TodoActions, TodoQueries } from "../shared/types";
import { todoMigrations } from "./migrations";
import { createTodo, updateTodo, completeTodo, deleteTodo } from "./actions";
import { findTodos, getTodoById } from "./queries";

export const todoFeature: FeatureDefinition<TodoEvents, TodoActions, TodoQueries> = {
	id: "todo",
	name: "Todo",
	version: "1.0.0",
	migrations: todoMigrations,

	manifest: {
		events: {
			"todo:item-created": {
				description: "A new todo item was created",
				payload: { id: "string", title: "string" },
			},
			"todo:item-updated": {
				description: "A todo item's title was updated",
				payload: { id: "string", title: "string" },
			},
			"todo:item-completed": {
				description: "A todo item was marked as complete",
				payload: { id: "string", completedAt: "string" },
			},
			"todo:item-deleted": {
				description: "A todo item was deleted",
				payload: { id: "string" },
			},
		},
		actions: {
			create: {
				description: "Create a new todo item",
				params: { title: "string", description: "string?" },
				result: { id: "string" },
			},
			update: {
				description: "Update a todo item's title or description",
				params: { id: "string", title: "string?", description: "string?" },
				result: { success: "boolean" },
			},
			complete: {
				description: "Mark a todo item as complete",
				params: { id: "string" },
				result: { success: "boolean" },
			},
			delete: {
				description: "Delete a todo item",
				params: { id: "string" },
				result: { success: "boolean" },
			},
		},
		queries: {
			find: {
				description: "Find todos with optional filters",
				params: { completed: "boolean?", limit: "number?" },
				result: "TodoItem[]",
			},
			"get-by-id": {
				description: "Get a single todo by ID",
				params: { id: "string" },
				result: "TodoItem | null",
			},
		},
		permissions: [],
		scheduledTasks: [],
		widgets: [
			{
				id: "task-list",
				name: "Todo List",
				sizes: ["wide"],
				description: "Shows active todos",
			},
		],
		commands: [
			{
				id: "create-todo",
				label: "Create Todo",
				description: "Create a new todo item",
			},
		],
	},

	async install(_ctx) {},

	async activate(ctx) {
		ctx.actions.handle("create", async (params, _meta) => {
			const result = await createTodo(ctx.db, params);
			ctx.events.emit("todo:item-created", { id: result.id, title: params.title });
			return result;
		});

		ctx.actions.handle("update", async (params, _meta) => {
			const result = await updateTodo(ctx.db, params);
			if (result.success && params.title !== undefined) {
				ctx.events.emit("todo:item-updated", { id: params.id, title: params.title });
			}
			return result;
		});

		ctx.actions.handle("complete", async (params, _meta) => {
			const result = await completeTodo(ctx.db, params);
			if (result.success) {
				ctx.events.emit("todo:item-completed", {
					id: params.id,
					completedAt: new Date().toISOString(),
				});
			}
			return result;
		});

		ctx.actions.handle("delete", async (params, _meta) => {
			const result = await deleteTodo(ctx.db, params);
			ctx.events.emit("todo:item-deleted", { id: params.id });
			return result;
		});

		ctx.queries.handle("find", async (params) => {
			return findTodos(ctx.db, params);
		});

		ctx.queries.handle("get-by-id", async (params) => {
			return getTodoById(ctx.db, params);
		});
	},

	async deactivate() {},

	async uninstall(_ctx) {},
};
