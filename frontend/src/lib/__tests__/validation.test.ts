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
