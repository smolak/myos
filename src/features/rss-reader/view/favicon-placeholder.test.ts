import { describe, expect, test } from "vitest";
import { getHostnameFromLink, getPlaceholderColor, getPlaceholderInitial } from "./favicon-placeholder";

describe("getHostnameFromLink", () => {
  test("extracts the hostname from an absolute URL", () => {
    expect(getHostnameFromLink("https://example.com/article/1")).toBe("example.com");
  });

  test("keeps the exact hostname including subdomains", () => {
    expect(getHostnameFromLink("https://alice.github.io/post")).toBe("alice.github.io");
  });

  test("keeps a leading www in the hostname", () => {
    expect(getHostnameFromLink("https://www.example.com/x")).toBe("www.example.com");
  });

  test("lowercases the hostname", () => {
    expect(getHostnameFromLink("https://Example.COM/x")).toBe("example.com");
  });

  test("returns null for an unparseable link", () => {
    expect(getHostnameFromLink("not a url")).toBeNull();
  });

  test("returns null for an empty link", () => {
    expect(getHostnameFromLink("")).toBeNull();
  });
});

describe("getPlaceholderInitial", () => {
  test("uses the first letter of the hostname, uppercased", () => {
    expect(getPlaceholderInitial("example.com")).toBe("E");
  });

  test("strips a leading www for the displayed letter", () => {
    expect(getPlaceholderInitial("www.example.com")).toBe("E");
  });

  test("does not strip www when it is not a leading label", () => {
    expect(getPlaceholderInitial("wwwe.com")).toBe("W");
  });

  test("keeps a digit initial as-is", () => {
    expect(getPlaceholderInitial("9to5mac.com")).toBe("9");
  });

  test("gives subdomain-distinct hostnames their own initials", () => {
    expect(getPlaceholderInitial("alice.github.io")).toBe("A");
    expect(getPlaceholderInitial("bob.github.io")).toBe("B");
  });

  test("falls back to the full hostname when stripping www leaves nothing", () => {
    expect(getPlaceholderInitial("www.")).toBe("W");
  });
});

describe("getPlaceholderColor", () => {
  test("returns the same color for the same hostname", () => {
    expect(getPlaceholderColor("example.com")).toBe(getPlaceholderColor("example.com"));
  });

  test("returns different colors for different hostnames", () => {
    expect(getPlaceholderColor("example.com")).not.toBe(getPlaceholderColor("news.ycombinator.com"));
  });

  test("gives subdomain-distinct hostnames different colors", () => {
    expect(getPlaceholderColor("alice.github.io")).not.toBe(getPlaceholderColor("bob.github.io"));
  });

  test("treats a www-prefixed hostname as a distinct identity from the bare hostname", () => {
    expect(getPlaceholderColor("www.example.com")).not.toBe(getPlaceholderColor("example.com"));
  });

  test("produces a muted hsl color", () => {
    expect(getPlaceholderColor("example.com")).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
  });
});
