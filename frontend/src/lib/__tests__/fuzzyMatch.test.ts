import { describe, it, expect } from "vitest";
import { normalize, compareFields } from "../fuzzyMatch";

// ---------------------------------------------------------------------------
// normalize()
// ---------------------------------------------------------------------------

describe("normalize", () => {
  it("lowercases text", () => {
    expect(normalize("STONE'S THROW")).toBe("stone's throw");
  });

  it("normalizes smart quotes to straight quotes", () => {
    expect(normalize("Stone\u2019s Throw")).toBe("stone's throw");
    expect(normalize("\u201CHello\u201D")).toBe('"hello"');
  });

  it("normalizes em/en dashes to hyphens", () => {
    expect(normalize("A\u2014B")).toBe("a-b");
    expect(normalize("A\u2013B")).toBe("a-b");
  });

  it("collapses whitespace", () => {
    expect(normalize("  hello   world  ")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(normalize("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// compareFields() — Dave's use case: "STONE'S THROW" vs "Stone's Throw"
// ---------------------------------------------------------------------------

describe("compareFields", () => {
  it("returns exact match for identical strings after normalization", () => {
    const result = compareFields("STONE'S THROW", "Stone's Throw");
    expect(result.verdict).toBe("exact");
    expect(result.score).toBe(100);
  });

  it("returns exact match for same case", () => {
    const result = compareFields("Old Tom Distillery", "Old Tom Distillery");
    expect(result.verdict).toBe("exact");
    expect(result.score).toBe(100);
  });

  it("returns match when one contains the other", () => {
    const result = compareFields("750 mL", "750 mL (25.4 FL OZ)");
    expect(result.verdict).toBe("match");
    expect(result.score).toBe(90);
  });

  it("returns mismatch for clearly different values", () => {
    const result = compareFields("Cabernet Sauvignon", "Pinot Noir");
    expect(result.verdict).toBe("mismatch");
    expect(result.score).toBeLessThan(70);
  });

  it("handles missing form value", () => {
    const result = compareFields(undefined, "Some Label Value");
    expect(result.verdict).toBe("missing");
    expect(result.score).toBe(0);
  });

  it("handles missing label value", () => {
    const result = compareFields("Some Form Value", undefined);
    expect(result.verdict).toBe("missing");
    expect(result.score).toBe(0);
  });

  it("handles both values missing", () => {
    const result = compareFields(undefined, undefined);
    expect(result.verdict).toBe("missing");
    expect(result.score).toBe(100);
  });

  it("handles smart quote mismatch gracefully", () => {
    // Form has straight quote, label has smart quote (common OCR artifact)
    const result = compareFields("Stone's Throw", "Stone\u2019s Throw");
    expect(result.verdict).toBe("exact");
    expect(result.score).toBe(100);
  });

  it("scores close match for minor typos", () => {
    const result = compareFields("Old Tom Distilery", "Old Tom Distillery");
    expect(result.verdict).toBe("match");
    expect(result.score).toBeGreaterThanOrEqual(90);
  });
});
