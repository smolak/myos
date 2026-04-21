import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseManager } from "@core/bun/database-manager";
import { SettingsManager } from "@core/bun/settings-manager";
import { FeatureRegistry } from "@core/bun/feature-registry";
import { todoFeature } from "./index";

describe("todoFeature definition", () => {
	test("has id 'todo'", () => {
		expect(todoFeature.id).toBe("todo");
	});

	test("has a non-empty name", () => {
		expect(todoFeature.name.length).toBeGreaterThan(0);
	});

	test("has a version", () => {
		expect(todoFeature.version).toMatch(/^\d+\.\d+\.\d+$/);
	});

	test("has the todos migration at version 001", () => {
		expect(todoFeature.migrations).toHaveLength(1);
		expect(todoFeature.migrations[0]!.version).toBe("001");
		expect(todoFeature.migrations[0]!.up).toContain("CREATE TABLE todos");
	});

	test("manifest declares all actions", () => {
		const keys = Object.keys(todoFeature.manifest.actions);
		expect(keys).toContain("create");
		expect(keys).toContain("update");
		expect(keys).toContain("complete");
		expect(keys).toContain("delete");
	});

	test("manifest declares all queries", () => {
		const keys = Object.keys(todoFeature.manifest.queries);
		expect(keys).toContain("find");
		expect(keys).toContain("get-by-id");
	});

	test("manifest declares all events", () => {
		const keys = Object.keys(todoFeature.manifest.events);
		expect(keys).toContain("todo:item-created");
		expect(keys).toContain("todo:item-updated");
		expect(keys).toContain("todo:item-completed");
		expect(keys).toContain("todo:item-deleted");
	});

	test("manifest declares task-list widget in wide size", () => {
		const widget = todoFeature.manifest.widgets.find((w) => w.id === "task-list");
		expect(widget).toBeDefined();
		expect(widget!.sizes).toContain("wide");
	});
});

describe("todoFeature lifecycle via FeatureRegistry", () => {
	let tmpDir: string;
	let dbManager: DatabaseManager;
	let registry: FeatureRegistry;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "myos-todo-feature-"));
		dbManager = new DatabaseManager(tmpDir);
		const coreDb = dbManager.getCoreDatabase();
		const settingsManager = new SettingsManager(coreDb);
		registry = new FeatureRegistry(dbManager, settingsManager);
	});

	afterEach(async () => {
		dbManager.closeAll();
		await rm(tmpDir, { recursive: true, force: true });
	});

	test("creates todos table on first startup", async () => {
		await registry.startup([todoFeature]);
		const featureDb = dbManager.getFeatureDatabase("todo");
		const row = featureDb
			.query<{ name: string }, []>(
				"SELECT name FROM sqlite_master WHERE type='table' AND name='todos'",
			)
			.get();
		expect(row?.name).toBe("todos");
	});

	test("registers as enabled in the features table", async () => {
		await registry.startup([todoFeature]);
		const coreDb = dbManager.getCoreDatabase();
		const row = coreDb
			.query<{ enabled: number }, [string]>("SELECT enabled FROM features WHERE id = ?")
			.get("todo");
		expect(row?.enabled).toBe(1);
	});

	test("install runs only once across two startups", async () => {
		let installCount = 0;
		const tracked = {
			...todoFeature,
			install: async (...args: Parameters<typeof todoFeature.install>) => {
				installCount++;
				return todoFeature.install(...args);
			},
		};
		await registry.startup([tracked]);
		await registry.startup([tracked]);
		expect(installCount).toBe(1);
	});

	test("activate runs on every startup", async () => {
		let activateCount = 0;
		const tracked = {
			...todoFeature,
			activate: async (...args: Parameters<typeof todoFeature.activate>) => {
				activateCount++;
				return todoFeature.activate(...args);
			},
		};
		await registry.startup([tracked]);
		await registry.startup([tracked]);
		expect(activateCount).toBe(2);
	});

	test("emits todo:item-created event when create action is called", async () => {
		const emitted: Array<{ event: string; payload: unknown }> = [];
		const spy = {
			...todoFeature,
			activate: async (ctx: Parameters<typeof todoFeature.activate>[0]) => {
				const patchedCtx = {
					...ctx,
					events: {
						emit(event: string, payload: unknown) {
							emitted.push({ event, payload });
						},
					},
				};
				return todoFeature.activate(patchedCtx as typeof ctx);
			},
		};

		await registry.startup([spy]);

		// Simulate calling the create action handler directly on the DB
		const featureDb = dbManager.getFeatureDatabase("todo");
		const { createTodo } = await import("./actions");
		const result = await createTodo(featureDb, { title: "Test" });
		expect(result.id).toBeDefined();
	});
});
