import { describe, it, expect } from "vitest";
import { inferCategory, verifyCategoryMatch } from "../categoryMatch";

describe("inferCategory", () => {
  // ── Beer ──────────────────────────────────────────────────────────────
  it("detects IPA from classType", () => {
    const r = inferCategory({ classType: "India Pale Ale" });
    expect(r.category).toBe("beer");
    expect(r.subcategory).toBe("ALE");
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("detects IPA abbreviation", () => {
    const r = inferCategory({ classType: "IPA" });
    expect(r.category).toBe("beer");
    expect(r.subcategory).toBe("ALE");
  });

  it("detects hazy IPA", () => {
    const r = inferCategory({ classType: "Hazy Pale Ale" });
    expect(r.category).toBe("beer");
    expect(r.subcategory).toBe("ALE");
  });

  it("detects lager", () => {
    const r = inferCategory({ classType: "Lager" });
    expect(r.category).toBe("beer");
    expect(r.subcategory).toBe("BEER");
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
    expect(r.subcategory).toBe("MALT BEVERAGES SPECIALITIES - FLAVORED");
  });

  it("detects pilsner", () => {
    const r = inferCategory({ classType: "Pilsner" });
    expect(r.category).toBe("beer");
    expect(r.subcategory).toBe("BEER");
  });

  // ── Wine ──────────────────────────────────────────────────────────────
  it("detects chardonnay from classType", () => {
    const r = inferCategory({ classType: "Chardonnay" });
    expect(r.category).toBe("wine");
    expect(r.subcategory).toBe("TABLE WHITE WINE");
  });

  it("detects chardonnay from varietal field", () => {
    const r = inferCategory({ varietal: "Chardonnay" });
    expect(r.category).toBe("wine");
    expect(r.subcategory).toBe("TABLE WHITE WINE");
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("detects cabernet sauvignon", () => {
    const r = inferCategory({ classType: "Cabernet Sauvignon" });
    expect(r.category).toBe("wine");
    expect(r.subcategory).toBe("TABLE RED WINE");
  });

  it("detects pinot noir", () => {
    const r = inferCategory({ varietal: "Pinot Noir" });
    expect(r.category).toBe("wine");
    expect(r.subcategory).toBe("TABLE RED WINE");
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
    expect(r.subcategory).toBe("ROSE WINE");
  });

  it("detects mead as wine", () => {
    const r = inferCategory({ rawText: "HONEY MEAD SEMI-SWEET" });
    expect(r.category).toBe("wine");
    expect(r.subcategory).toBe("HONEY BASED TABLE WINE");
  });

  // ── Spirits ───────────────────────────────────────────────────────────
  it("detects bourbon", () => {
    const r = inferCategory({ classType: "Bourbon" });
    expect(r.category).toBe("spirits");
    expect(r.subcategory).toBe("STRAIGHT BOURBON WHISKY");
  });

  it("detects straight bourbon whiskey", () => {
    const r = inferCategory({ classType: "Straight Bourbon Whiskey" });
    expect(r.category).toBe("spirits");
    expect(r.subcategory).toBe("STRAIGHT BOURBON WHISKY");
  });

  it("detects vodka", () => {
    const r = inferCategory({ classType: "Vodka" });
    expect(r.category).toBe("spirits");
    expect(r.subcategory).toBe("VODKA");
  });

  it("detects tequila", () => {
    const r = inferCategory({ classType: "Tequila" });
    expect(r.category).toBe("spirits");
    expect(r.subcategory).toBe("TEQUILA");
  });

  it("detects grappa", () => {
    const r = inferCategory({ classType: "Grappa" });
    expect(r.category).toBe("spirits");
    expect(r.subcategory).toBe("BRANDY");
  });

  it("detects rum from classType", () => {
    const r = inferCategory({ classType: "Caribbean Rum" });
    expect(r.category).toBe("spirits");
    expect(r.subcategory).toBe("RUM");
  });

  it("detects spirits from age statement", () => {
    const r = inferCategory({ ageStatement: "Aged 12 Years" });
    expect(r.category).toBe("spirits");
    expect(r.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("detects sake as spirits", () => {
    const r = inferCategory({ classType: "Sake" });
    expect(r.category).toBe("spirits");
    expect(r.subcategory).toBe("SAKE");
  });

  it("detects cocktail as spirits", () => {
    const r = inferCategory({ classType: "Ready to Drink Cocktail" });
    expect(r.category).toBe("spirits");
  });

  it("detects proof as spirits indicator", () => {
    const r = inferCategory({ rawText: "80 PROOF PREMIUM SPIRITS" });
    expect(r.category).toBe("spirits");
  });

  // ── New beer styles ────────────────────────────────────────────────────
  it("detects wine cooler as beer/malt", () => {
    const r = inferCategory({ classType: "Wine Cooler" });
    expect(r.category).toBe("beer");
    expect(r.subcategory).toBe("MALT BEVERAGES SPECIALITIES - FLAVORED");
  });

  it("detects lambic", () => {
    const r = inferCategory({ classType: "Lambic" });
    expect(r.category).toBe("beer");
    expect(r.subcategory).toBe("ALE");
  });

  it("detects gueuze", () => {
    const r = inferCategory({ classType: "Gueuze" });
    expect(r.category).toBe("beer");
    expect(r.subcategory).toBe("ALE");
  });

  it("detects schwarzbier", () => {
    const r = inferCategory({ classType: "Schwarzbier" });
    expect(r.category).toBe("beer");
  });

  it("detects vienna lager", () => {
    const r = inferCategory({ classType: "Vienna Lager" });
    expect(r.category).toBe("beer");
    expect(r.subcategory).toBe("BEER");
  });

  it("detects imperial stout", () => {
    const r = inferCategory({ classType: "Imperial Stout" });
    expect(r.category).toBe("beer");
    expect(r.subcategory).toBe("STOUT");
  });

  it("detects red ale", () => {
    const r = inferCategory({ classType: "Irish Red Ale" });
    expect(r.category).toBe("beer");
    expect(r.subcategory).toBe("ALE");
  });

  it("detects ESB", () => {
    const r = inferCategory({ classType: "ESB" });
    expect(r.category).toBe("beer");
    expect(r.subcategory).toBe("ALE");
  });

  it("detects shandy", () => {
    const r = inferCategory({ classType: "Shandy" });
    expect(r.category).toBe("beer");
  });

  // ── New wine terms ─────────────────────────────────────────────────────
  it("detects ice wine", () => {
    const r = inferCategory({ classType: "Ice Wine" });
    expect(r.category).toBe("wine");
    expect(r.subcategory).toBe("DESSERT WINE");
  });

  it("detects cava", () => {
    const r = inferCategory({ classType: "Cava" });
    expect(r.category).toBe("wine");
    expect(r.subcategory).toBe("SPARKLING WINE/CHAMPAGNE");
  });

  it("detects late harvest", () => {
    const r = inferCategory({ classType: "Late Harvest Riesling" });
    expect(r.category).toBe("wine");
  });

  it("detects pinot blanc as wine", () => {
    const r = inferCategory({ varietal: "Pinot Blanc" });
    expect(r.category).toBe("wine");
    expect(r.subcategory).toBe("TABLE WHITE WINE");
  });

  it("detects nebbiolo as wine", () => {
    const r = inferCategory({ classType: "Nebbiolo" });
    expect(r.category).toBe("wine");
    expect(r.subcategory).toBe("TABLE RED WINE");
  });

  it("detects grüner veltliner as wine", () => {
    const r = inferCategory({ varietal: "Grüner Veltliner" });
    expect(r.category).toBe("wine");
    expect(r.subcategory).toBe("TABLE WHITE WINE");
  });

  it("detects albariño as wine", () => {
    const r = inferCategory({ varietal: "Albariño" });
    expect(r.category).toBe("wine");
    expect(r.subcategory).toBe("TABLE WHITE WINE");
  });

  it("detects gamay as wine", () => {
    const r = inferCategory({ varietal: "Gamay" });
    expect(r.category).toBe("wine");
    expect(r.subcategory).toBe("TABLE RED WINE");
  });

  it("detects petite sirah as wine", () => {
    const r = inferCategory({ classType: "Petite Sirah" });
    expect(r.category).toBe("wine");
    expect(r.subcategory).toBe("TABLE RED WINE");
  });

  // ── New spirits terms ──────────────────────────────────────────────────
  it("detects tennessee whiskey", () => {
    const r = inferCategory({ classType: "Tennessee Whiskey" });
    expect(r.category).toBe("spirits");
    expect(r.subcategory).toBe("WHISKY SPECIALTIES");
  });

  it("detects armagnac", () => {
    const r = inferCategory({ classType: "Armagnac" });
    expect(r.category).toBe("spirits");
    expect(r.subcategory).toBe("BRANDY");
  });

  it("detects calvados", () => {
    const r = inferCategory({ classType: "Calvados" });
    expect(r.category).toBe("spirits");
    expect(r.subcategory).toBe("BRANDY");
  });

  it("detects genever", () => {
    const r = inferCategory({ classType: "Genever" });
    expect(r.category).toBe("spirits");
    expect(r.subcategory).toBe("GIN");
  });

  it("detects irish cream", () => {
    const r = inferCategory({ classType: "Irish Cream" });
    expect(r.category).toBe("spirits");
    expect(r.subcategory).toBe("LIQUEUR");
  });

  it("detects schnapps", () => {
    const r = inferCategory({ classType: "Schnapps" });
    expect(r.category).toBe("spirits");
    expect(r.subcategory).toBe("LIQUEUR");
  });

  it("detects moonshine", () => {
    const r = inferCategory({ classType: "Moonshine" });
    expect(r.category).toBe("spirits");
    expect(r.subcategory).toBe("WHISKY SPECIALTIES");
  });

  it("detects baijiu", () => {
    const r = inferCategory({ classType: "Baijiu" });
    expect(r.category).toBe("spirits");
    expect(r.subcategory).toBe("OTHER SPECIALTIES & PROPRIETARIES");
  });

  it("detects aperitif", () => {
    const r = inferCategory({ classType: "Aperitif" });
    expect(r.category).toBe("spirits");
    expect(r.subcategory).toBe("LIQUEUR");
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
    expect(result.message).toContain("STRAIGHT BOURBON WHISKY");
  });

  it("mismatch message is descriptive", () => {
    const inferred = inferCategory({ classType: "Pinot Noir" });
    const result = verifyCategoryMatch("spirits", inferred);
    expect(result.match).toBe(false);
    expect(result.message).toContain("Spirits");
    expect(result.message).toContain("Wine");
  });
});
