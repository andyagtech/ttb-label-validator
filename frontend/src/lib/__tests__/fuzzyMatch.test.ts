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

  it("strips diacritics/accents", () => {
    expect(normalize("Moét")).toBe("moet");
    expect(normalize("Côtes de Provence")).toBe("cotes de provence");
    expect(normalize("Gewürztraminer")).toBe("gewurztraminer");
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
    expect(result.score).toBe(95);
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

  // --- New: diacritic/accent matching ---
  it("matches values with different accents (Moet vs Moét)", () => {
    const result = compareFields("Moet Hennessy", "Moét Hennessy");
    expect(result.verdict).toBe("exact");
    expect(result.score).toBe(100);
  });

  // --- New: prefix-stripping containment ---
  it("matches 'France' vs 'Product of France'", () => {
    const result = compareFields("France", "Product of France");
    expect(result.verdict).toBe("match");
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it("matches 'Mexico' vs 'Product of Mexico'", () => {
    const result = compareFields("Mexico", "Product of Mexico");
    expect(result.verdict).toBe("match");
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  // --- New: token overlap matching for addresses ---
  it("matches addresses with minor OCR word drops", () => {
    // OCR dropped 'New' from 'New York'
    const result = compareFields(
      "Imported by Moet Hennessy USA, Inc., New York, NY 10153",
      "Imported by Moét Hennessy USA, Inc, York, NY 10153",
    );
    expect(result.verdict).toBe("match");
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("matches brand name case-insensitively (HENNESSY vs Hennessy)", () => {
    const result = compareFields("HENNESSY", "Hennessy");
    expect(result.verdict).toBe("exact");
    expect(result.score).toBe(100);
  });

  it("matches 'Product of France' submitted vs 'France' detected", () => {
    const result = compareFields("Product of France", "France");
    expect(result.verdict).toBe("match");
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it("matches country with 'Imported from' prefix", () => {
    const result = compareFields("France", "Imported from France");
    expect(result.verdict).toBe("match");
    expect(result.score).toBeGreaterThanOrEqual(90);
  });
});
