import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseManager } from "./database-manager";
import { SettingsManager } from "./settings-manager";

describe("SettingsManager", () => {
	let dbManager: DatabaseManager;
	let settings: SettingsManager;
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "myos-settings-"));
		dbManager = new DatabaseManager(tmpDir);
		settings = new SettingsManager(dbManager.getCoreDatabase());
	});

	afterEach(async () => {
		dbManager.closeAll();
		await rm(tmpDir, { recursive: true, force: true });
	});

	describe("get", () => {
		test("returns defaultValue when key not set", () => {
			expect(settings.get("global", "theme", "system")).toBe("system");
		});

		test("returns persisted value after set", async () => {
			await settings.set("global", "theme", "dark");
			expect(settings.get("global", "theme", "system")).toBe("dark");
		});

		test("preserves number values", async () => {
			await settings.set("global", "pageSize", 25);
			expect(settings.get("global", "pageSize", 0)).toBe(25);
		});

		test("preserves boolean values", async () => {
			await settings.set("global", "enabled", true);
			expect(settings.get("global", "enabled", false)).toBe(true);
		});

		test("preserves object values", async () => {
			const obj = { a: 1, b: "two" };
			await settings.set("global", "config", obj);
			expect(settings.get("global", "config", {})).toEqual(obj);
		});
	});

	describe("set", () => {
		test("persists value across SettingsManager instances", async () => {
			await settings.set("global", "theme", "dark");
			const settings2 = new SettingsManager(dbManager.getCoreDatabase());
			expect(settings2.get("global", "theme", "system")).toBe("dark");
		});

		test("overwrites existing value", async () => {
			await settings.set("global", "theme", "dark");
			await settings.set("global", "theme", "light");
			expect(settings.get("global", "theme", "system")).toBe("light");
		});
	});

	describe("scope isolation", () => {
		test("global and feature scopes are independent", async () => {
			await settings.set("global", "theme", "dark");
			await settings.set("todo", "theme", "light");
			expect(settings.get("global", "theme", "system")).toBe("dark");
			expect(settings.get("todo", "theme", "system")).toBe("light");
		});

		test("unset key in one scope does not bleed from another", async () => {
			await settings.set("todo", "sort", "asc");
			expect(settings.get("rss-reader", "sort", "desc")).toBe("desc");
		});

		test("same key in different scopes returns correct values", async () => {
			await settings.set("global", "pageSize", 10);
			await settings.set("todo", "pageSize", 25);
			expect(settings.get("global", "pageSize", 0)).toBe(10);
			expect(settings.get("todo", "pageSize", 0)).toBe(25);
		});
	});

	describe("forScope", () => {
		test("returns scoped accessor bound to the given scope", async () => {
			const scoped = settings.forScope("todo");
			await scoped.set("sort", "asc");
			expect(scoped.get("sort", "desc")).toBe("asc");
		});

		test("scoped accessor is isolated from other scopes", async () => {
			const globalScoped = settings.forScope("global");
			const todoScoped = settings.forScope("todo");
			await globalScoped.set("theme", "dark");
			expect(todoScoped.get("theme", "system")).toBe("system");
		});
	});
});
