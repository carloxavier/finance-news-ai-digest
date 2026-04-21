import { describe, it, expect } from "vitest";
import { buildGrokUrl } from "../grokUrl";

describe("buildGrokUrl", () => {
  it("starts with the Grok base + q param", () => {
    const url = buildGrokUrl("Rates up", "abc-123");
    expect(url.startsWith("https://grok.com/?q=")).toBe(true);
  });

  it("includes the headline verbatim in the decoded prompt", () => {
    const url = buildGrokUrl("NVIDIA beats earnings — AI demand 'insatiable'", "a1");
    const prompt = decodeURIComponent(url.split("?q=")[1]);
    expect(prompt).toContain(`Headline: "NVIDIA beats earnings — AI demand 'insatiable'"`);
  });

  it("includes the canonical finnopolis article URL", () => {
    const url = buildGrokUrl("h", "85586a31-fd75-4a24-b407-0db4ed5cac78");
    const prompt = decodeURIComponent(url.split("?q=")[1]);
    expect(prompt).toContain("URL: https://finnopolis.com/article/85586a31-fd75-4a24-b407-0db4ed5cac78");
  });

  it("URL-encodes special characters so the link is browser-safe", () => {
    const url = buildGrokUrl("S&P 500 up 2% after Fed", "a1");
    // Raw header chars (`&`, `%`, `"`, `\n`) must be encoded in the href.
    const rawQuery = url.split("?q=")[1];
    expect(rawQuery).not.toContain("\n");
    expect(rawQuery).not.toContain('"');
    expect(rawQuery).toContain("%0A"); // newline encoded
    expect(rawQuery).toContain("%22"); // quote encoded
    expect(rawQuery.includes("S%26P") || rawQuery.includes("S%2526P")).toBe(true);
  });

  it("asks for the three-bullet retail-investor framing", () => {
    const url = buildGrokUrl("h", "a1");
    const prompt = decodeURIComponent(url.split("?q=")[1]);
    expect(prompt).toContain("retail investor");
    expect(prompt).toContain("core takeaway");
    expect(prompt).toContain("tickers/sectors affected");
    expect(prompt).toContain("what to watch next");
  });
});
