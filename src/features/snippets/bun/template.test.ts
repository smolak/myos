import { describe, expect, test } from "bun:test";
import { buildVars, expandTemplate } from "./template";

describe("buildVars", () => {
  test("formats date as YYYY-MM-DD", () => {
    const vars = buildVars(new Date("2026-04-27T14:05:00"));
    expect(vars.date).toBe("2026-04-27");
  });

  test("formats time as HH:MM with zero-padding", () => {
    const vars = buildVars(new Date("2026-04-27T09:05:00"));
    expect(vars.time).toBe("09:05");
  });

  test("datetime is date + space + time", () => {
    const vars = buildVars(new Date("2026-04-27T14:05:00"));
    expect(vars.datetime).toBe("2026-04-27 14:05");
  });

  test("clipboard defaults to empty string", () => {
    const vars = buildVars(new Date());
    expect(vars.clipboard).toBe("");
  });

  test("clipboard is passed through", () => {
    const vars = buildVars(new Date(), "hello world");
    expect(vars.clipboard).toBe("hello world");
  });
});

describe("expandTemplate", () => {
  const fixedDate = new Date("2026-04-27T14:05:00");

  test("replaces {{date}}", () => {
    const vars = buildVars(fixedDate);
    expect(expandTemplate("Today is {{date}}", vars)).toBe("Today is 2026-04-27");
  });

  test("replaces {{time}}", () => {
    const vars = buildVars(fixedDate);
    expect(expandTemplate("It is {{time}}", vars)).toBe("It is 14:05");
  });

  test("replaces {{datetime}}", () => {
    const vars = buildVars(fixedDate);
    expect(expandTemplate("Now: {{datetime}}", vars)).toBe("Now: 2026-04-27 14:05");
  });

  test("replaces {{clipboard}}", () => {
    const vars = buildVars(fixedDate, "copied text");
    expect(expandTemplate("From clipboard: {{clipboard}}", vars)).toBe("From clipboard: copied text");
  });

  test("replaces multiple occurrences of the same variable", () => {
    const vars = buildVars(fixedDate);
    expect(expandTemplate("{{date}} and {{date}}", vars)).toBe("2026-04-27 and 2026-04-27");
  });

  test("replaces multiple different variables", () => {
    const vars = buildVars(fixedDate, "clip");
    expect(expandTemplate("{{date}} {{time}} {{clipboard}}", vars)).toBe("2026-04-27 14:05 clip");
  });

  test("returns template unchanged when no variables present", () => {
    const vars = buildVars(fixedDate);
    expect(expandTemplate("no variables here", vars)).toBe("no variables here");
  });

  test("{{clipboard}} is empty string when not provided", () => {
    const vars = buildVars(fixedDate);
    expect(expandTemplate("clipboard=[{{clipboard}}]", vars)).toBe("clipboard=[]");
  });

  test("unknown placeholders are left as-is", () => {
    const vars = buildVars(fixedDate);
    expect(expandTemplate("{{unknown}} remains", vars)).toBe("{{unknown}} remains");
  });
});
