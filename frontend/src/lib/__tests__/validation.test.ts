import { describe, it, expect } from "vitest";
import { ExtractedFields } from "../ocr";
import { getChecklistTemplate } from "../types";
import { validateExtractedFields, applyValidationResults, RULE_CITATIONS } from "../validation";

// ---------------------------------------------------------------------------
// Helper to find a specific rule result by ruleId
// ---------------------------------------------------------------------------

function findRule(results: ReturnType<typeof validateExtractedFields>, ruleId: string) {
  return results.find((r) => r.ruleId === ruleId);
}

function findByChecklist(results: ReturnType<typeof validateExtractedFields>, checklistItemId: string) {
  return results.filter((r) => r.checklistItemId === checklistItemId);
}

// ---------------------------------------------------------------------------
// Government Warning Validation
// ---------------------------------------------------------------------------

describe("Government Warning validation", () => {
  const fullWarning =
    "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

  it("passes with correct full warning", () => {
    const fields: ExtractedFields = { healthWarning: fullWarning };
    const results = validateExtractedFields(fields, "wine", "back");
    const hwResults = findByChecklist(results, "health_warning");
    expect(hwResults.every((r) => r.pass)).toBe(true);
  });

  it("fails when GOVERNMENT WARNING is not all caps", () => {
    const fields: ExtractedFields = {
      healthWarning: "Government Warning: (1) According to the Surgeon General...",
    };
    const results = validateExtractedFields(fields, "wine", "back");
    const capsRule = findRule(results, "health_warning_caps");
    expect(capsRule).toBeDefined();
    expect(capsRule!.pass).toBe(false);
  });

  it("fails when health warning is missing entirely", () => {
    const fields: ExtractedFields = {};
    const results = validateExtractedFields(fields, "wine", "back");
    const rule = findRule(results, "health_warning_present");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(false);
  });

  it("warns when statement (1) is missing", () => {
    const fields: ExtractedFields = {
      healthWarning:
        "GOVERNMENT WARNING: (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.",
    };
    const results = validateExtractedFields(fields, "wine", "back");
    const rule = findRule(results, "health_warning_part1");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(false);
  });

  it("warns when statement (2) is missing", () => {
    const fields: ExtractedFields = {
      healthWarning:
        "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects.",
    };
    const results = validateExtractedFields(fields, "wine", "back");
    const rule = findRule(results, "health_warning_part2");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ABV Format Validation
// ---------------------------------------------------------------------------

describe("ABV format validation", () => {
  it('passes "Alcohol 14% by volume"', () => {
    const fields: ExtractedFields = { alcoholContent: "Alcohol 14% by volume" };
    const results = validateExtractedFields(fields, "wine", "front");
    const rule = findRule(results, "abv_format_valid");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(true);
  });

  it('passes "13.5% Alc. By Vol."', () => {
    const fields: ExtractedFields = { alcoholContent: "13.5% Alc. By Vol." };
    const results = validateExtractedFields(fields, "wine", "front");
    const rule = findRule(results, "abv_format_valid");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(true);
  });

  it('passes "45% Alc./Vol. (90 Proof)" — sample label format', () => {
    const fields: ExtractedFields = { alcoholContent: "45% Alc./Vol. (90 Proof)" };
    const results = validateExtractedFields(fields, "spirits", "front");
    const rule = findRule(results, "abv_format_valid");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(true);
  });

  it('rejects "5% ABV" — ABV abbreviation not allowed', () => {
    const fields: ExtractedFields = { alcoholContent: "5% ABV" };
    const results = validateExtractedFields(fields, "beer", "front");
    const rule = findRule(results, "abv_no_abbreviation");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(false);
  });

  it("ABV optional for beer (malt beverages)", () => {
    const fields: ExtractedFields = {}; // no alcoholContent
    const results = validateExtractedFields(fields, "beer", "front");
    const rule = findRule(results, "abv_present");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(true); // optional = pass
    expect(rule!.severity).toBe("info");
  });

  it("ABV mandatory for wine", () => {
    const fields: ExtractedFields = {}; // no alcoholContent
    const results = validateExtractedFields(fields, "wine", "front");
    const rule = findRule(results, "abv_present");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(false);
    expect(rule!.severity).toBe("error");
  });

  it("ABV mandatory for spirits", () => {
    const fields: ExtractedFields = {};
    const results = validateExtractedFields(fields, "spirits", "front");
    const rule = findRule(results, "abv_present");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Net Contents Validation
// ---------------------------------------------------------------------------

describe("Net contents validation", () => {
  it("passes metric for wine", () => {
    const fields: ExtractedFields = { netContents: "750 mL" };
    const results = validateExtractedFields(fields, "wine", "front");
    const rule = findRule(results, "net_contents_valid");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(true);
  });

  it("passes American measure for beer", () => {
    const fields: ExtractedFields = { netContents: "12 FL OZ" };
    const results = validateExtractedFields(fields, "beer", "front");
    const rule = findRule(results, "net_contents_valid");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(true);
  });

  it("warns metric-only for beer (American measure required)", () => {
    const fields: ExtractedFields = { netContents: "355 mL" };
    const results = validateExtractedFields(fields, "beer", "front");
    const rule = findRule(results, "net_contents_metric_only");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(false);
  });

  it("passes American measure for beer with metric supplement", () => {
    const fields: ExtractedFields = { netContents: "12 FL OZ (355 mL)" };
    const results = validateExtractedFields(fields, "beer", "front");
    const rule = findRule(results, "net_contents_valid");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(true);
  });

  it("errors when net contents missing", () => {
    const fields: ExtractedFields = {};
    const results = validateExtractedFields(fields, "wine", "front");
    const rule = findRule(results, "net_contents_present");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Presence Rules
// ---------------------------------------------------------------------------

describe("Presence rules", () => {
  it("detects brand name present on front label", () => {
    const fields: ExtractedFields = { brandName: "OLD TOM DISTILLERY" };
    const results = validateExtractedFields(fields, "spirits", "front");
    const rule = findRule(results, "brand_name_present");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(true);
  });

  it("errors when brand name missing from front label", () => {
    const fields: ExtractedFields = {};
    const results = validateExtractedFields(fields, "spirits", "front");
    const rule = findRule(results, "brand_name_missing");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(false);
  });

  it("detects class/type present on front label", () => {
    const fields: ExtractedFields = { classType: "Kentucky Straight Bourbon Whiskey" };
    const results = validateExtractedFields(fields, "spirits", "front");
    const rule = findRule(results, "class_type_present");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(true);
  });

  it("detects name & address on back label", () => {
    const fields: ExtractedFields = { nameAddress: "Old Tom Distillery, Louisville, KY" };
    const results = validateExtractedFields(fields, "spirits", "back");
    const rule = findRule(results, "name_address_present");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Class/Type Designation Lookup
// ---------------------------------------------------------------------------

describe("Class/type designation lookup", () => {
  it("recognizes a valid spirits designation", () => {
    const fields: ExtractedFields = { classType: "Kentucky Straight Bourbon Whiskey" };
    const results = validateExtractedFields(fields, "spirits", "front");
    const rule = findRule(results, "class_type_recognized");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(true);
  });

  it("recognizes a valid wine designation", () => {
    const fields: ExtractedFields = { classType: "Cabernet Sauvignon" };
    const results = validateExtractedFields(fields, "wine", "front");
    const rule = findRule(results, "class_type_recognized");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(true);
  });

  it("recognizes a valid beer designation", () => {
    const fields: ExtractedFields = { classType: "India Pale Ale" };
    const results = validateExtractedFields(fields, "beer", "front");
    const rule = findRule(results, "class_type_recognized");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(true);
  });

  it("warns on unrecognized designation", () => {
    const fields: ExtractedFields = { classType: "Mystery Drink" };
    const results = validateExtractedFields(fields, "wine", "front");
    const rule = findRule(results, "class_type_unrecognized");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(false);
  });

  it("warns when designation matches wrong category", () => {
    // "Bourbon" is a spirits designation, but we said category is beer
    const fields: ExtractedFields = { classType: "Bourbon" };
    const results = validateExtractedFields(fields, "beer", "front");
    const rule = findRule(results, "class_type_wrong_category");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cross-field Rules
// ---------------------------------------------------------------------------

describe("Cross-field rules", () => {
  it("warns when varietal stated without appellation (wine)", () => {
    const fields: ExtractedFields = { varietal: "Pinot Noir" };
    const results = validateExtractedFields(fields, "wine", "front");
    const rule = findRule(results, "varietal_requires_appellation");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(false);
  });

  it("warns when vintage stated without appellation (wine)", () => {
    const fields: ExtractedFields = { vintageDate: "2019" };
    const results = validateExtractedFields(fields, "wine", "front");
    const rule = findRule(results, "vintage_requires_appellation");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(false);
  });

  it("no cross-field warning when appellation is present", () => {
    const fields: ExtractedFields = {
      varietal: "Pinot Noir",
      appellation: "Willamette Valley",
    };
    const results = validateExtractedFields(fields, "wine", "front");
    const rule = findRule(results, "varietal_requires_appellation");
    expect(rule).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Spirits-specific validation rules
// ---------------------------------------------------------------------------

describe("Spirits-specific validation", () => {
  it("proof/ABV consistency passes when correct (90 proof = 45%)", () => {
    const fields: ExtractedFields = {
      classType: "Bourbon",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
    };
    const results = validateExtractedFields(fields, "spirits", "front");
    const rule = findRule(results, "spirits_proof_abv_consistent");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(true);
  });

  it("proof/ABV mismatch when inconsistent (80 proof vs 45%)", () => {
    const fields: ExtractedFields = {
      classType: "Bourbon",
      alcoholContent: "45% Alc./Vol. (80 Proof)",
    };
    const results = validateExtractedFields(fields, "spirits", "front");
    const rule = findRule(results, "spirits_proof_abv_mismatch");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(false);
  });

  it("ABV range OK for typical spirits (40%)", () => {
    const fields: ExtractedFields = {
      classType: "Vodka",
      alcoholContent: "40% Alc./Vol.",
    };
    const results = validateExtractedFields(fields, "spirits", "front");
    const rule = findRule(results, "spirits_abv_range_ok");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(true);
  });

  it("ABV range warning for low spirits (10%)", () => {
    const fields: ExtractedFields = {
      classType: "Cocktail",
      alcoholContent: "10% Alc./Vol.",
    };
    const results = validateExtractedFields(fields, "spirits", "front");
    const rule = findRule(results, "spirits_abv_range_low");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(false);
  });

  it("straight whisky without age statement warns", () => {
    const fields: ExtractedFields = {
      classType: "Straight Bourbon Whiskey",
    };
    const results = validateExtractedFields(fields, "spirits", "front");
    const rule = findRule(results, "spirits_straight_age_note");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(false);
  });

  it("straight whisky with age statement passes", () => {
    const fields: ExtractedFields = {
      classType: "Straight Bourbon Whiskey",
      ageStatement: "Aged 6 years",
    };
    const results = validateExtractedFields(fields, "spirits", "front");
    const rule = findRule(results, "spirits_straight_age_ok");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(true);
  });

  it("non-straight spirits do not trigger age warning", () => {
    const fields: ExtractedFields = {
      classType: "Vodka",
    };
    const results = validateExtractedFields(fields, "spirits", "front");
    expect(findRule(results, "spirits_straight_age_note")).toBeUndefined();
    expect(findRule(results, "spirits_straight_age_ok")).toBeUndefined();
  });

  it("spirits rules do not fire for wine category", () => {
    const fields: ExtractedFields = {
      classType: "Straight Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
    };
    const results = validateExtractedFields(fields, "wine", "front");
    expect(findRule(results, "spirits_proof_abv_consistent")).toBeUndefined();
    expect(findRule(results, "spirits_abv_range_ok")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Wine-specific validation rules
// ---------------------------------------------------------------------------

describe("Wine-specific validation", () => {
  it("varietal 75% note fires when varietal present", () => {
    const fields: ExtractedFields = {
      varietal: "Pinot Noir",
      appellation: "Willamette Valley",
    };
    const results = validateExtractedFields(fields, "wine", "front");
    const rule = findRule(results, "wine_varietal_75_note");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(true);
    expect(rule!.message).toContain("75%");
    expect(rule!.message).toContain("85%");
  });

  it("varietal note does not fire when no varietal", () => {
    const fields: ExtractedFields = {
      classType: "Red Wine",
    };
    const results = validateExtractedFields(fields, "wine", "front");
    expect(findRule(results, "wine_varietal_75_note")).toBeUndefined();
  });

  it("wine ABV range OK for 14%", () => {
    const fields: ExtractedFields = {
      alcoholContent: "14% Alc. By Vol.",
    };
    const results = validateExtractedFields(fields, "wine", "front");
    const rule = findRule(results, "wine_abv_range_ok");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(true);
  });

  it("wine ABV range warns above 24%", () => {
    const fields: ExtractedFields = {
      alcoholContent: "28% Alc. By Vol.",
    };
    const results = validateExtractedFields(fields, "wine", "front");
    const rule = findRule(results, "wine_abv_range_high");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(false);
  });

  it("vintage year 2022 is plausible", () => {
    const fields: ExtractedFields = {
      vintageDate: "2022",
    };
    const results = validateExtractedFields(fields, "wine", "front");
    const rule = findRule(results, "wine_vintage_plausible");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(true);
  });

  it("vintage year 2099 is implausible (future)", () => {
    const fields: ExtractedFields = {
      vintageDate: "2099",
    };
    const results = validateExtractedFields(fields, "wine", "front");
    const rule = findRule(results, "wine_vintage_implausible");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(false);
    expect(rule!.suggestion).toContain("future");
  });

  it("vintage year 1850 is implausible (too old)", () => {
    const fields: ExtractedFields = {
      vintageDate: "1850",
    };
    const results = validateExtractedFields(fields, "wine", "front");
    const rule = findRule(results, "wine_vintage_implausible");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(false);
    expect(rule!.suggestion).toContain("before 1900");
  });

  it("wine rules do not fire for spirits category", () => {
    const fields: ExtractedFields = {
      varietal: "Pinot Noir",
      alcoholContent: "14% Alc. By Vol.",
      vintageDate: "2022",
    };
    const results = validateExtractedFields(fields, "spirits", "front");
    expect(findRule(results, "wine_varietal_75_note")).toBeUndefined();
    expect(findRule(results, "wine_abv_range_ok")).toBeUndefined();
    expect(findRule(results, "wine_vintage_plausible")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Beer-specific validation rules
// ---------------------------------------------------------------------------

describe("Beer-specific validation", () => {
  it("FMB composition note for hard seltzer", () => {
    const fields: ExtractedFields = {
      classType: "Hard Seltzer",
    };
    const results = validateExtractedFields(fields, "beer", "front");
    const rule = findRule(results, "beer_fmb_composition_note");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(true);
    expect(rule!.message).toContain("statement of composition");
  });

  it("FMB composition note for flavored malt beverage", () => {
    const fields: ExtractedFields = {
      classType: "Flavored Malt Beverage",
    };
    const results = validateExtractedFields(fields, "beer", "front");
    const rule = findRule(results, "beer_fmb_composition_note");
    expect(rule).toBeDefined();
  });

  it("no FMB note for regular beer", () => {
    const fields: ExtractedFields = {
      classType: "India Pale Ale",
    };
    const results = validateExtractedFields(fields, "beer", "front");
    expect(findRule(results, "beer_fmb_composition_note")).toBeUndefined();
  });

  it("beer ABV range OK for 5%", () => {
    const fields: ExtractedFields = {
      alcoholContent: "5% Alc. By Vol.",
    };
    const results = validateExtractedFields(fields, "beer", "front");
    const rule = findRule(results, "beer_abv_range_ok");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(true);
  });

  it("beer ABV range warns above 15%", () => {
    const fields: ExtractedFields = {
      alcoholContent: "18% Alc. By Vol.",
    };
    const results = validateExtractedFields(fields, "beer", "front");
    const rule = findRule(results, "beer_abv_range_high");
    expect(rule).toBeDefined();
    expect(rule!.pass).toBe(false);
  });

  it("beer rules do not fire for wine category", () => {
    const fields: ExtractedFields = {
      classType: "Hard Seltzer",
      alcoholContent: "5% Alc. By Vol.",
    };
    const results = validateExtractedFields(fields, "wine", "front");
    expect(findRule(results, "beer_fmb_composition_note")).toBeUndefined();
    expect(findRule(results, "beer_abv_range_ok")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Sample Label from PROJECT_DESCRIPTION.md (Line 93-99)
// ---------------------------------------------------------------------------

describe("Sample label from PROJECT_DESCRIPTION.md", () => {
  const sampleFields: ExtractedFields = {
    brandName: "OLD TOM DISTILLERY",
    classType: "Kentucky Straight Bourbon Whiskey",
    alcoholContent: "45% Alc./Vol. (90 Proof)",
    netContents: "750 mL",
    healthWarning:
      "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.",
    nameAddress: "Old Tom Distillery, Louisville, KY 40202",
  };

  it("all front label fields pass for spirits", () => {
    const results = validateExtractedFields(sampleFields, "spirits", "front");
    const brandRule = findRule(results, "brand_name_present");
    const classRule = findRule(results, "class_type_recognized");
    const abvRule = findRule(results, "abv_format_valid");
    const netRule = findRule(results, "net_contents_valid");

    expect(brandRule!.pass).toBe(true);
    expect(classRule!.pass).toBe(true);
    expect(abvRule!.pass).toBe(true);
    expect(netRule!.pass).toBe(true);
  });

  it("all back label fields pass for spirits", () => {
    const results = validateExtractedFields(sampleFields, "spirits", "back");
    const hwResults = findByChecklist(results, "health_warning");
    expect(hwResults.every((r) => r.pass)).toBe(true);

    const nameRule = findRule(results, "name_address_present");
    expect(nameRule!.pass).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Citations
// ---------------------------------------------------------------------------

describe("Citations", () => {
  it("every validation result has a citation", () => {
    // Run a comprehensive validation to produce many rules
    const fields: ExtractedFields = {
      brandName: "Test Brand",
      classType: "Lager",
      alcoholContent: "5% Alc. By Vol.",
      netContents: "12 FL OZ",
      healthWarning:
        "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.",
      nameAddress: "Test Brewery, Portland, OR",
      sulfiteDeclaration: "Contains Sulfites",
    };

    const frontResults = validateExtractedFields(fields, "beer", "front");
    const backResults = validateExtractedFields(fields, "beer", "back");
    const allResults = [...frontResults, ...backResults];

    for (const result of allResults) {
      expect(result.citation).toBeDefined();
      expect(result.citation!.chapter).toBeTruthy();
      expect(result.citation!.section).toBeTruthy();
      expect(result.citation!.summary).toBeTruthy();
    }
  });

  it("RULE_CITATIONS covers all common ruleIds", () => {
    const expectedRuleIds = [
      "health_warning_present",
      "health_warning_caps",
      "health_warning_part1",
      "health_warning_part2",
      "health_warning_complete",
      "abv_present",
      "abv_no_abbreviation",
      "abv_format_valid",
      "abv_format_unclear",
      "abv_no_percentage",
      "net_contents_present",
      "net_contents_valid",
      "net_contents_metric_only",
      "net_contents_no_unit",
      "brand_name_present",
      "brand_name_missing",
      "class_type_present",
      "class_type_missing",
      "class_type_recognized",
      "class_type_unrecognized",
      "class_type_wrong_category",
      "name_address_present",
      "name_address_missing",
      "sulfite_present",
      "age_statement_present",
      "varietal_requires_appellation",
      "vintage_requires_appellation",
      // Spirits-specific
      "spirits_proof_abv_consistent",
      "spirits_proof_abv_mismatch",
      "spirits_abv_range_ok",
      "spirits_abv_range_low",
      "spirits_straight_age_note",
      "spirits_straight_age_ok",
      // Wine-specific
      "wine_varietal_75_note",
      "wine_abv_range_ok",
      "wine_abv_range_high",
      "wine_vintage_plausible",
      "wine_vintage_implausible",
      // Beer-specific
      "beer_fmb_composition_note",
      "beer_abv_range_ok",
      "beer_abv_range_high",
    ];

    for (const ruleId of expectedRuleIds) {
      expect(RULE_CITATIONS[ruleId]).toBeDefined();
    }
  });

  it("citation has referenceUrl when present", () => {
    const citation = RULE_CITATIONS["health_warning_present"];
    expect(citation.referenceUrl).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// applyValidationResults populates validationResults
// ---------------------------------------------------------------------------

describe("applyValidationResults", () => {
  it("populates item.validationResults with matching results", () => {
    const checklist = getChecklistTemplate("front", "beer");
    const fields: ExtractedFields = { brandName: "Test Brand" };
    const results = validateExtractedFields(fields, "beer", "front");
    const updated = applyValidationResults(checklist, results);

    const brandItem = updated.find((i) => i.id === "brand_name");
    expect(brandItem).toBeDefined();
    expect(brandItem!.validationResults).toBeDefined();
    expect(brandItem!.validationResults!.length).toBeGreaterThan(0);
    expect(brandItem!.validationResults![0].citation).toBeDefined();
  });

  it("does not add validationResults to items with no matching rules", () => {
    const checklist = getChecklistTemplate("front", "beer");
    const results = validateExtractedFields({}, "beer", "front");
    const updated = applyValidationResults(checklist, results);

    // Image quality items have no validation rules
    const imageItem = updated.find((i) => i.id === "image_sharp");
    expect(imageItem).toBeDefined();
    expect(imageItem!.validationResults).toBeUndefined();
  });
});
