import { describe, expect, test } from "vitest";
import { hostnameFromLink, placeholderColor, placeholderInitial } from "./favicon-placeholder";

describe("hostnameFromLink", () => {
  test("extracts the hostname from an absolute URL", () => {
    expect(hostnameFromLink("https://example.com/article/1")).toBe("example.com");
  });

  test("keeps the exact hostname including subdomains", () => {
    expect(hostnameFromLink("https://alice.github.io/post")).toBe("alice.github.io");
  });

  test("keeps a leading www in the hostname", () => {
    expect(hostnameFromLink("https://www.example.com/x")).toBe("www.example.com");
  });

  test("lowercases the hostname", () => {
    expect(hostnameFromLink("https://Example.COM/x")).toBe("example.com");
  });

  test("returns null for an unparseable link", () => {
    expect(hostnameFromLink("not a url")).toBeNull();
  });

  test("returns null for an empty link", () => {
    expect(hostnameFromLink("")).toBeNull();
  });
});

describe("placeholderInitial", () => {
  test("uses the first letter of the hostname, uppercased", () => {
    expect(placeholderInitial("example.com")).toBe("E");
  });

  test("strips a leading www for the displayed letter", () => {
    expect(placeholderInitial("www.example.com")).toBe("E");
  });

  test("does not strip www when it is not a leading label", () => {
    expect(placeholderInitial("wwwe.com")).toBe("W");
  });

  test("keeps a digit initial as-is", () => {
    expect(placeholderInitial("9to5mac.com")).toBe("9");
  });

  test("subdomain-distinct hostnames get their own initials", () => {
    expect(placeholderInitial("alice.github.io")).toBe("A");
    expect(placeholderInitial("bob.github.io")).toBe("B");
  });

  test("falls back to the full hostname when stripping www leaves nothing", () => {
    expect(placeholderInitial("www.")).toBe("W");
  });
});

describe("placeholderColor", () => {
  test("returns the same color for the same hostname", () => {
    expect(placeholderColor("example.com")).toBe(placeholderColor("example.com"));
  });

  test("returns different colors for different hostnames", () => {
    expect(placeholderColor("example.com")).not.toBe(placeholderColor("news.ycombinator.com"));
  });

  test("subdomain-distinct hostnames get different colors", () => {
    expect(placeholderColor("alice.github.io")).not.toBe(placeholderColor("bob.github.io"));
  });

  test("www-prefixed hostname is a distinct identity from the bare hostname", () => {
    expect(placeholderColor("www.example.com")).not.toBe(placeholderColor("example.com"));
  });

  test("produces a muted hsl color", () => {
    expect(placeholderColor("example.com")).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
  });
});
