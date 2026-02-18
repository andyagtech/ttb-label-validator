import { describe, it, expect } from "vitest";
import { inferCategory, verifyCategoryMatch } from "../categoryMatch";

describe("inferCategory", () => {
  // ── Beer ──────────────────────────────────────────────────────────────
  it("detects IPA from classType", () => {
    const r = inferCategory({ classType: "India Pale Ale" });
    expect(r.category).toBe("beer");
    expect(r.subcategory).toBe("India Pale Ale");
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("detects IPA abbreviation", () => {
    const r = inferCategory({ classType: "IPA" });
    expect(r.category).toBe("beer");
    expect(r.subcategory).toBe("India Pale Ale");
  });

  it("detects hazy IPA", () => {
    const r = inferCategory({ classType: "Hazy Pale Ale" });
    expect(r.category).toBe("beer");
    expect(r.subcategory).toBe("Hazy IPA");
  });

  it("detects lager", () => {
    const r = inferCategory({ classType: "Lager" });
    expect(r.category).toBe("beer");
    expect(r.subcategory).toBe("Lager");
  });

  it("detects stout", () => {
    const r = inferCategory({ classType: "Stout" });
    expect(r.category).toBe("beer");
  });

  it("detects ale from raw text", () => {
    const r = inferCategory({ rawText: "BREWED WITH PALE ALE MALT" });
    expect(r.category).toBe("beer");
    expect(r.confidence).toBeLessThanOrEqual(0.7);
  });

  it("detects hard seltzer as beer/malt", () => {
    const r = inferCategory({ classType: "Hard Seltzer" });
    expect(r.category).toBe("beer");
    expect(r.subcategory).toBe("Hard Seltzer");
  });

  it("detects pilsner", () => {
    const r = inferCategory({ classType: "Pilsner" });
    expect(r.category).toBe("beer");
    expect(r.subcategory).toBe("Pilsner");
  });

  // ── Wine ──────────────────────────────────────────────────────────────
  it("detects chardonnay from classType", () => {
    const r = inferCategory({ classType: "Chardonnay" });
    expect(r.category).toBe("wine");
    expect(r.subcategory).toBe("Chardonnay");
  });

  it("detects chardonnay from varietal field", () => {
    const r = inferCategory({ varietal: "Chardonnay" });
    expect(r.category).toBe("wine");
    expect(r.subcategory).toBe("Chardonnay");
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("detects cabernet sauvignon", () => {
    const r = inferCategory({ classType: "Cabernet Sauvignon" });
    expect(r.category).toBe("wine");
    expect(r.subcategory).toBe("Cabernet Sauvignon");
  });

  it("detects pinot noir", () => {
    const r = inferCategory({ varietal: "Pinot Noir" });
    expect(r.category).toBe("wine");
    expect(r.subcategory).toBe("Pinot Noir");
  });

  it("detects wine from appellation", () => {
    const r = inferCategory({ appellation: "Napa Valley" });
    expect(r.category).toBe("wine");
    expect(r.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("detects bourgogne as wine", () => {
    const r = inferCategory({ rawText: "BOURGOGNE APPELLATION CONTROLEE" });
    expect(r.category).toBe("wine");
  });

  it("detects table wine", () => {
    const r = inferCategory({ classType: "Table White Wine" });
    expect(r.category).toBe("wine");
  });

  it("detects rosé", () => {
    const r = inferCategory({ classType: "Rosé" });
    expect(r.category).toBe("wine");
    expect(r.subcategory).toBe("Rosé");
  });

  it("detects mead as wine", () => {
    const r = inferCategory({ rawText: "HONEY MEAD SEMI-SWEET" });
    expect(r.category).toBe("wine");
    expect(r.subcategory).toBe("Mead");
  });

  // ── Spirits ───────────────────────────────────────────────────────────
  it("detects bourbon", () => {
    const r = inferCategory({ classType: "Bourbon" });
    expect(r.category).toBe("spirits");
    expect(r.subcategory).toBe("Bourbon");
  });

  it("detects straight bourbon whiskey", () => {
    const r = inferCategory({ classType: "Straight Bourbon Whiskey" });
    expect(r.category).toBe("spirits");
    expect(r.subcategory).toBe("Straight Bourbon");
  });

  it("detects vodka", () => {
    const r = inferCategory({ classType: "Vodka" });
    expect(r.category).toBe("spirits");
    expect(r.subcategory).toBe("Vodka");
  });

  it("detects tequila", () => {
    const r = inferCategory({ classType: "Tequila" });
    expect(r.category).toBe("spirits");
    expect(r.subcategory).toBe("Tequila");
  });

  it("detects grappa", () => {
    const r = inferCategory({ classType: "Grappa" });
    expect(r.category).toBe("spirits");
    expect(r.subcategory).toBe("Grappa");
  });

  it("detects rum from classType", () => {
    const r = inferCategory({ classType: "Caribbean Rum" });
    expect(r.category).toBe("spirits");
    expect(r.subcategory).toBe("Rum");
  });

  it("detects spirits from age statement", () => {
    const r = inferCategory({ ageStatement: "Aged 12 Years" });
    expect(r.category).toBe("spirits");
    expect(r.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("detects sake as spirits", () => {
    const r = inferCategory({ classType: "Sake" });
    expect(r.category).toBe("spirits");
    expect(r.subcategory).toBe("Sake");
  });

  it("detects cocktail as spirits", () => {
    const r = inferCategory({ classType: "Ready to Drink Cocktail" });
    expect(r.category).toBe("spirits");
  });

  it("detects proof as spirits indicator", () => {
    const r = inferCategory({ rawText: "80 PROOF PREMIUM SPIRITS" });
    expect(r.category).toBe("spirits");
  });

  // ── Edge cases ────────────────────────────────────────────────────────
  it("returns null when no category can be inferred", () => {
    const r = inferCategory({ rawText: "HELLO WORLD 2024" });
    expect(r.category).toBeNull();
    expect(r.confidence).toBe(0);
  });

  it("returns null for empty fields", () => {
    const r = inferCategory({});
    expect(r.category).toBeNull();
  });

  it("classType takes priority over raw text", () => {
    const r = inferCategory({ classType: "IPA", rawText: "BOURBON WHISKEY" });
    expect(r.category).toBe("beer");
  });
});

describe("verifyCategoryMatch", () => {
  it("returns match when categories agree", () => {
    const inferred = inferCategory({ classType: "IPA" });
    const result = verifyCategoryMatch("beer", inferred);
    expect(result.match).toBe(true);
    expect(result.verdict).toBe("match");
    expect(result.severity).toBe("success");
  });

  it("returns mismatch when categories disagree", () => {
    const inferred = inferCategory({ classType: "Chardonnay" });
    const result = verifyCategoryMatch("beer", inferred);
    expect(result.match).toBe(false);
    expect(result.verdict).toBe("mismatch");
    expect(result.severity).toBe("error");
    expect(result.message).toContain("mismatch");
  });

  it("returns unknown when no category inferred", () => {
    const inferred = inferCategory({});
    const result = verifyCategoryMatch("beer", inferred);
    expect(result.verdict).toBe("unknown");
    expect(result.severity).toBe("info");
  });

  it("match message includes subcategory", () => {
    const inferred = inferCategory({ classType: "Straight Bourbon Whiskey" });
    const result = verifyCategoryMatch("spirits", inferred);
    expect(result.match).toBe(true);
    expect(result.message).toContain("Straight Bourbon");
  });

  it("mismatch message is descriptive", () => {
    const inferred = inferCategory({ classType: "Pinot Noir" });
    const result = verifyCategoryMatch("spirits", inferred);
    expect(result.match).toBe(false);
    expect(result.message).toContain("Spirits");
    expect(result.message).toContain("Wine");
  });
});
