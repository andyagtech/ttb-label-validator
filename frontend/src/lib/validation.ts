/**
 * TTB Label Validation Rules Engine
 *
 * Three categories of rules:
 *   1. Presence rules — are required fields present?
 *   2. Format rules — do extracted values match TTB formatting requirements?
 *   3. Cross-field rules — conditional logic across multiple fields
 *
 * Each rule returns ValidationResult[] which map to checklist items.
 */

import { ExtractedFields } from "./ocr";
import { BeverageCategory, ChecklistItem } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Severity = "error" | "warning" | "info";

export interface Citation {
  chapter: string;
  section: string;
  summary: string;
  referenceUrl?: string;
}

export interface ValidationResult {
  ruleId: string;
  checklistItemId: string;
  severity: Severity;
  message: string;
  suggestion?: string;
  /** true = field is present and valid */
  pass: boolean;
  citation?: Citation;
}

// ---------------------------------------------------------------------------
// Rule → Citation map
// ---------------------------------------------------------------------------

export const RULE_CITATIONS: Record<string, Citation> = {
  // Health warning rules — 27 CFR Part 16
  health_warning_present: {
    chapter: "1",
    section: "Item 10",
    summary: "Health warning is mandatory on all alcohol beverages >= 0.5% ABV per 27 CFR Part 16.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-16",
  },
  health_warning_caps: {
    chapter: "1",
    section: "Item 10",
    summary: '"GOVERNMENT WARNING:" must appear in ALL CAPS and bold type per 27 CFR Part 16.',
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-16",
  },
  health_warning_part1: {
    chapter: "3",
    section: "§16.21",
    summary: "Statement (1) re: Surgeon General / pregnancy / birth defects is prescribed text.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-16",
  },
  health_warning_part2: {
    chapter: "3",
    section: "§16.21",
    summary: "Statement (2) re: impaired driving / machinery / health problems is prescribed text.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-16",
  },
  health_warning_complete: {
    chapter: "1",
    section: "Item 10",
    summary: "Both prescribed statements present per 27 CFR Part 16.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-16",
  },

  // ABV rules — 27 CFR 4.36 (wine), 7.71 (beer), 5.37 (spirits)
  abv_present: {
    chapter: "1",
    section: "Item 5",
    summary: "Alcohol content must be stated for wine and spirits; optional for malt beverages per 27 CFR 7.71.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7",
  },
  abv_no_abbreviation: {
    chapter: "1",
    section: "Item 5",
    summary: '"ABV" is not an accepted abbreviation. Must use "Alcohol __% by volume" or "Alc. By Vol."',
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7",
  },
  abv_format_valid: {
    chapter: "1",
    section: "Item 5",
    summary: "Alcohol content in an acceptable format per 27 CFR 7.71.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7",
  },
  abv_format_unclear: {
    chapter: "1",
    section: "Item 5",
    summary: "Percentage found but format may not match acceptable TTB formats per 27 CFR 7.71.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7",
  },
  abv_no_percentage: {
    chapter: "1",
    section: "Item 5",
    summary: "Alcohol content statement must include a percentage per 27 CFR 7.71.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7",
  },

  // Net contents — 27 CFR 7.28
  net_contents_present: {
    chapter: "1",
    section: "Item 4",
    summary: "Net contents statement is mandatory per 27 CFR 7.28.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7",
  },
  net_contents_valid: {
    chapter: "5",
    section: "§7.28",
    summary: "Net contents in acceptable format per 27 CFR 7.28.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7",
  },
  net_contents_metric_only: {
    chapter: "5",
    section: "§7.28",
    summary: "Malt beverages must include American measure (FL OZ, PINT, QUART, GALLON). Metric alone is insufficient.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7",
  },
  net_contents_no_unit: {
    chapter: "5",
    section: "§7.28",
    summary: "Net contents must include a recognized unit of measure per 27 CFR 7.28.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7",
  },

  // Brand name — 27 CFR Part 7
  brand_name_present: {
    chapter: "1",
    section: "Item 1",
    summary: "Brand name must appear on the front of the container per 27 CFR Part 7.",
    referenceUrl: "https://www.ttb.gov/alfd/certificate-of-label-aproval-cola",
  },
  brand_name_missing: {
    chapter: "1",
    section: "Item 1",
    summary: "Brand name is mandatory on the front label per 27 CFR Part 7.",
    referenceUrl: "https://www.ttb.gov/alfd/certificate-of-label-aproval-cola",
  },

  // Class/type — 27 CFR Part 7, Ch. 4
  class_type_present: {
    chapter: "1",
    section: "Item 2",
    summary: "Class/type designation must appear on the front of the container per 27 CFR Part 7.",
    referenceUrl: "https://www.ttb.gov/alfd/certificate-of-label-aproval-cola",
  },
  class_type_missing: {
    chapter: "1",
    section: "Item 2",
    summary: "Class/type designation is mandatory on the front label per 27 CFR Part 7.",
    referenceUrl: "https://www.ttb.gov/alfd/certificate-of-label-aproval-cola",
  },
  class_type_recognized: {
    chapter: "4",
    section: "Class & Type",
    summary: "Designation matches a recognized TTB class/type per Beverage Alcohol Manual.",
    referenceUrl: "https://www.ttb.gov/alfd/certificate-of-label-aproval-cola",
  },
  class_type_unrecognized: {
    chapter: "4",
    section: "Class & Type",
    summary: "Designation not in the standard TTB list — verify against TTB guidelines.",
    referenceUrl: "https://www.ttb.gov/alfd/certificate-of-label-aproval-cola",
  },
  class_type_wrong_category: {
    chapter: "4",
    section: "Class & Type",
    summary: "Designation appears to belong to a different beverage category.",
    referenceUrl: "https://www.ttb.gov/alfd/certificate-of-label-aproval-cola",
  },

  // Name & address — 27 CFR Part 7
  name_address_present: {
    chapter: "1",
    section: "Item 3",
    summary: "Name and address of producer/bottler/importer is required per 27 CFR Part 7.",
    referenceUrl: "https://www.ttb.gov/alfd/certificate-of-label-aproval-cola",
  },
  name_address_missing: {
    chapter: "1",
    section: "Item 3",
    summary: "Name and address is mandatory per 27 CFR Part 7.",
    referenceUrl: "https://www.ttb.gov/alfd/certificate-of-label-aproval-cola",
  },

  // Sulfite — 27 CFR Part 7
  sulfite_present: {
    chapter: "1",
    section: "Item 8",
    summary: "Sulfite declaration found. Required if product contains 10+ ppm sulfur dioxide.",
    referenceUrl: "https://www.ttb.gov/alfd/certificate-of-label-aproval-cola",
  },

  // Age statement — spirits
  age_statement_present: {
    chapter: "1",
    section: "Spirits",
    summary: "Age statement found. Required for certain spirits types.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5?toc=1",
  },

  // Sulfite — wine (mandatory)
  sulfite_wine_missing: {
    chapter: "1",
    section: "§4.32(e)",
    summary: "Sulfite declaration is mandatory for wine (virtually all wines contain ≥ 10 ppm SO₂) per 27 CFR §4.32(e).",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-4",
  },

  // Color ingredient disclosures
  color_ingredients_present: {
    chapter: "1",
    section: "§7.62",
    summary: "Color ingredient disclosures found. Required if coloring materials are added.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7",
  },

  // Commodity statement — spirits
  commodity_statement_present: {
    chapter: "1",
    section: "§5.63",
    summary: "Commodity statement found. Required for certain spirits containers.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5",
  },

  // Aspartame declaration — beer
  aspartame_declaration_present: {
    chapter: "1",
    section: "§7.63",
    summary: "Aspartame declaration found. Required for malt beverages containing aspartame.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7",
  },

  // Spirits-specific rules — 27 CFR Part 5
  spirits_proof_abv_consistent: {
    chapter: "5",
    section: "§5.37(b)",
    summary: "Proof and ABV% are consistent (proof ≈ 2 × ABV) per 27 CFR §5.37.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5/subpart-F/section-5.37",
  },
  spirits_proof_abv_mismatch: {
    chapter: "5",
    section: "§5.37(b)",
    summary: "Proof must equal twice the ABV percentage per 27 CFR §5.37(b).",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5/subpart-F/section-5.37",
  },
  spirits_abv_range_ok: {
    chapter: "5",
    section: "§5.37",
    summary: "ABV is within expected spirits range (>15%) per 27 CFR §5.37.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5/subpart-F/section-5.37",
  },
  spirits_abv_range_low: {
    chapter: "5",
    section: "§5.37",
    summary: "ABV appears low for spirits. Verify category is correct or if this is a ready-to-drink product.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5/subpart-F/section-5.37",
  },
  spirits_straight_age_note: {
    chapter: "5",
    section: "§5.74",
    summary: "Straight whisky aged less than 4 years must carry an age statement per 27 CFR §5.74.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5/subpart-F/section-5.74",
  },
  spirits_straight_age_ok: {
    chapter: "5",
    section: "§5.74",
    summary: "Age statement found on straight whisky label per 27 CFR §5.74.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5/subpart-F/section-5.74",
  },

  // Wine-specific rules — 27 CFR Part 4
  wine_varietal_75_note: {
    chapter: "4",
    section: "§4.23(a)",
    summary: "Varietal wine must contain at least 75% of the named grape (85% for AVA-designated) per 27 CFR §4.23.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-4/subpart-D/section-4.23",
  },
  wine_abv_range_ok: {
    chapter: "4",
    section: "§4.36",
    summary: "ABV is within expected wine range per 27 CFR §4.36.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-4/subpart-D/section-4.36",
  },
  wine_abv_range_high: {
    chapter: "4",
    section: "§4.36",
    summary: "ABV appears high for wine (>24%). Verify product category — may be a fortified wine or spirits.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-4/subpart-D/section-4.36",
  },
  wine_vintage_plausible: {
    chapter: "4",
    section: "§4.27",
    summary: "Vintage year is within a plausible range per 27 CFR §4.27.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-4/subpart-D/section-4.27",
  },
  wine_vintage_implausible: {
    chapter: "4",
    section: "§4.27",
    summary: "Vintage year appears implausible — verify it is correct per 27 CFR §4.27.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-4/subpart-D/section-4.27",
  },

  // Beer-specific rules — 27 CFR Part 7
  beer_fmb_composition_note: {
    chapter: "7",
    section: "§7.24a",
    summary: "Flavored malt beverages may require a statement of composition per TTB Ruling 2004-1.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7",
  },
  beer_abv_range_ok: {
    chapter: "7",
    section: "§7.71",
    summary: "ABV is within expected malt beverage range per 27 CFR §7.71.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7/subpart-E/section-7.71",
  },
  beer_abv_range_high: {
    chapter: "7",
    section: "§7.71",
    summary: "ABV appears high for a malt beverage (>15%). Verify product category is correct.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7/subpart-E/section-7.71",
  },

  // Cross-field rules — wine
  varietal_requires_appellation: {
    chapter: "1",
    section: "Wine",
    summary: "When a grape variety is stated, an appellation of origin must also appear per TTB regulations.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-4",
  },
  vintage_requires_appellation: {
    chapter: "1",
    section: "Wine",
    summary: "When a vintage year is stated, an appellation of origin must also appear per TTB regulations.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-4",
  },
};

export function citationFor(ruleId: string): Citation | undefined {
  return RULE_CITATIONS[ruleId];
}

// ---------------------------------------------------------------------------
// Field key → primary CFR citation — used by FormVsLabelTable on the review page
// Maps the camelCase field keys from FIELD_LABELS to the most relevant regulation.
// ---------------------------------------------------------------------------

export const FIELD_CITATIONS: Record<string, Citation> = {
  brandName: {
    chapter: "1",
    section: "27 CFR §7.54",
    summary: "Brand name must appear on the brand label (front) per 27 CFR Part 7.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7/subpart-D/section-7.54",
  },
  classType: {
    chapter: "1",
    section: "27 CFR §7.55",
    summary: "Class/type designation required on the brand label per 27 CFR Part 7.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7/subpart-D/section-7.55",
  },
  alcoholContent: {
    chapter: "1",
    section: "27 CFR §7.71",
    summary: "Alcohol content statement required for wine & spirits; optional for malt beverages. Must use approved format (not \"ABV\").",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7/subpart-E/section-7.71",
  },
  netContents: {
    chapter: "1",
    section: "27 CFR §7.28",
    summary: "Net contents statement mandatory. Malt beverages require American measure (FL OZ).",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7",
  },
  healthWarning: {
    chapter: "1",
    section: "27 CFR Part 16",
    summary: "\"GOVERNMENT WARNING:\" in ALL CAPS followed by both prescribed statements. Required on all beverages ≥ 0.5% ABV.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-16",
  },
  nameAddress: {
    chapter: "1",
    section: "27 CFR §7.59",
    summary: "Name and address of bottler, producer, or importer required per 27 CFR Part 7.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7/subpart-D/section-7.59",
  },
  countryOfOrigin: {
    chapter: "1",
    section: "27 CFR §7.63",
    summary: "Country of origin required on imported products per 27 CFR Part 7 and 19 USC §1304.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7/subpart-D/section-7.63",
  },
  appellation: {
    chapter: "1",
    section: "27 CFR §4.25",
    summary: "Appellation of origin for wine — required when varietal or vintage is stated.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-4/subpart-D/section-4.25",
  },
  varietal: {
    chapter: "1",
    section: "27 CFR §4.23",
    summary: "Varietal (grape) designation rules for wine. Requires appellation of origin when stated.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-4/subpart-D/section-4.23",
  },
  vintageDate: {
    chapter: "1",
    section: "27 CFR §4.27",
    summary: "Vintage date rules for wine. Requires appellation of origin when stated.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-4/subpart-D/section-4.27",
  },
  sulfiteDeclaration: {
    chapter: "1",
    section: "27 CFR §4.32(e)",
    summary: "\"Contains Sulfites\" declaration required if product contains ≥ 10 ppm sulfur dioxide.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-4",
  },
  ageStatement: {
    chapter: "1",
    section: "27 CFR §5.74",
    summary: "Age statement required for certain spirits types (e.g., straight bourbon < 4 years).",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5/subpart-F/section-5.74",
  },
  colorIngredients: {
    chapter: "1",
    section: "27 CFR §7.62",
    summary: "If coloring materials are added (e.g., caramel color, FD&C dyes), disclosure is mandatory.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7",
  },
  commodityStatement: {
    chapter: "1",
    section: "27 CFR §5.63",
    summary: "Commodity statement required for distilled spirits in certain circumstances.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5",
  },
  aspartameDeclaration: {
    chapter: "1",
    section: "27 CFR §7.63",
    summary: "\"Phenylketonurics: Contains Phenylalanine\" required for malt beverages containing aspartame.",
    referenceUrl: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7",
  },
};

// ---------------------------------------------------------------------------
// Government Warning — exact prescribed text per 27 CFR Part 16
// ---------------------------------------------------------------------------

const PRESCRIBED_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

/**
 * Validate the government health warning statement.
 * Must contain "GOVERNMENT WARNING:" in ALL CAPS.
 * Must contain both prescribed statements.
 */
function validateHealthWarning(text: string | undefined): ValidationResult[] {
  const results: ValidationResult[] = [];
  const id = "health_warning";

  if (!text) {
    results.push({
      ruleId: "health_warning_present",
      checklistItemId: id,
      severity: "error",
      message: "Government health warning not found on label.",
      suggestion: "The health warning is mandatory on all alcohol beverages per 27 CFR Part 16.",
      pass: false,
      citation: citationFor("health_warning_present"),
    });
    return results;
  }

  // Check "GOVERNMENT WARNING:" is in ALL CAPS
  if (!/GOVERNMENT\s+WARNING\s*:/.test(text)) {
    if (/government\s+warning/i.test(text)) {
      results.push({
        ruleId: "health_warning_caps",
        checklistItemId: id,
        severity: "error",
        message: '"GOVERNMENT WARNING:" must appear in ALL CAPS.',
        suggestion: 'Found similar text but not in required format. Must be exactly "GOVERNMENT WARNING:" in capitals.',
        pass: false,
        citation: citationFor("health_warning_caps"),
      });
    } else {
      results.push({
        ruleId: "health_warning_present",
        checklistItemId: id,
        severity: "error",
        message: '"GOVERNMENT WARNING:" header not found.',
        pass: false,
        citation: citationFor("health_warning_present"),
      });
    }
    return results;
  }

  // Check for statement (1) — Surgeon General / pregnancy / birth defects
  const hasPart1 = /surgeon\s+general/i.test(text) && /pregnan/i.test(text) && /birth\s+defects/i.test(text);

  if (!hasPart1) {
    results.push({
      ruleId: "health_warning_part1",
      checklistItemId: id,
      severity: "error",
      message: "Missing or incomplete Statement (1) about pregnancy and birth defects.",
      suggestion: "Must include the Surgeon General's warning about women not drinking during pregnancy.",
      pass: false,
      citation: citationFor("health_warning_part1"),
    });
  }

  // Check for statement (2) — impairs driving / machinery / health problems
  const hasPart2 =
    /impairs/i.test(text) && (/drive/i.test(text) || /operat/i.test(text)) && /health\s+problems/i.test(text);

  if (!hasPart2) {
    results.push({
      ruleId: "health_warning_part2",
      checklistItemId: id,
      severity: "error",
      message: "Missing or incomplete Statement (2) about impaired driving and health problems.",
      suggestion:
        "Must state that consumption impairs ability to drive/operate machinery and may cause health problems.",
      pass: false,
      citation: citationFor("health_warning_part2"),
    });
  }

  if (hasPart1 && hasPart2) {
    results.push({
      ruleId: "health_warning_complete",
      checklistItemId: id,
      severity: "info",
      message: "Government warning contains both required statements.",
      pass: true,
      citation: citationFor("health_warning_complete"),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// ABV Format — per 27 CFR 4.36 (wine), 7.71 (beer), 5.37 (spirits)
// ---------------------------------------------------------------------------

/** Minimum alcohol content for beverages subject to TTB regulation (0.5% ABV). */
const MIN_ABV_THRESHOLD = 0.5;
/** Maximum plausible alcohol content for validation (95% ABV). */
const MAX_ABV_THRESHOLD = 95;

/**
 * Validate alcohol content statement format.
 * Acceptable: "Alcohol __% by volume" or "__% Alc. By Vol."
 * NOT acceptable: "__% ABV" — "ABV" is not an allowed abbreviation.
 */
function validateAbvFormat(text: string | undefined, category: BeverageCategory): ValidationResult[] {
  const results: ValidationResult[] = [];
  const id = "alcohol_content";

  if (!text) {
    // ABV is optional for malt beverages per 27 CFR 7.71
    if (category === "beer") {
      results.push({
        ruleId: "abv_present",
        checklistItemId: id,
        severity: "info",
        message: "Alcohol content not found — this is optional for malt beverages unless required by state law.",
        pass: true,
        citation: citationFor("abv_present"),
      });
    } else {
      results.push({
        ruleId: "abv_present",
        checklistItemId: id,
        severity: "error",
        message: "Alcohol content statement not found.",
        suggestion: 'Must state "Alcohol __% by volume" or "__% Alc. By Vol."',
        pass: false,
        citation: citationFor("abv_present"),
      });
    }
    return results;
  }

  // Check for forbidden "ABV" abbreviation
  if (/\b\d+\.?\d*\s*%?\s*ABV\b/i.test(text) && !/alc\.?\s*(?:by\s*vol|\/?\s*vol)/i.test(text)) {
    results.push({
      ruleId: "abv_no_abbreviation",
      checklistItemId: id,
      severity: "error",
      message: '"ABV" is not an allowed abbreviation for alcohol content.',
      suggestion: 'Use "Alcohol __% by volume" or "__% Alc. By Vol." instead.',
      pass: false,
      citation: citationFor("abv_no_abbreviation"),
    });
    return results;
  }

  // Check for acceptable formats (including parenthetical abbreviations per 27 CFR 7.71)
  // Standard forms:
  //   "Alcohol __% by volume"  /  "__% Alc. By Vol."  /  "__% Alcohol by volume"
  // Parenthetical forms (malt beverages):
  //   "Alcohol (Alc) __% by Volume (Vol)"  /  "Alc __% by Vol"
  //   "__% Alcohol (Alc)/Volume (Vol)"     /  "__% Alc/Vol"
  const validFormat1 = /alcohol\s*(?:\(alc\))?\s+\d+\.?\d*\s*%\s*by\s+vol(?:ume)?(?:\s*\(vol\))?/i.test(text);
  const validFormat2 = /\d+\.?\d*\s*%\s*alc\.?\s*(?:\(alc\))?\s*by\s*vol\.?(?:\s*\(vol\))?/i.test(text);
  const validFormat3 = /\d+\.?\d*\s*%\s*alcohol\s*(?:\(alc\))?\s+by\s+vol(?:ume)?(?:\s*\(vol\))?/i.test(text);
  const validFormat4 = /\d+\.?\d*\s*%\s*alc(?:ohol)?\.?\s*(?:\(alc\))?\s*\/\s*vol(?:ume)?\.?(?:\s*\(vol\))?/i.test(
    text,
  );
  const validFormat5 = /alcohol\s*(?:\(alc\))?\s*by\s+vol(?:ume)?(?:\s*\(vol\))?\s+\d+\.?\d*\s*%/i.test(text);

  if (validFormat1 || validFormat2 || validFormat3 || validFormat4 || validFormat5) {
    results.push({
      ruleId: "abv_format_valid",
      checklistItemId: id,
      severity: "info",
      message: "Alcohol content format is acceptable.",
      pass: true,
      citation: citationFor("abv_format_valid"),
    });
  } else {
    // Has a percentage but not in an approved format
    if (/\d+\.?\d*\s*%/.test(text)) {
      results.push({
        ruleId: "abv_format_unclear",
        checklistItemId: id,
        severity: "warning",
        message: "Alcohol percentage found but format may not match TTB requirements.",
        suggestion: 'Acceptable formats: "Alcohol __% by volume", "__% Alc. By Vol.", or "__% Alc./Vol."',
        pass: false,
        citation: citationFor("abv_format_unclear"),
      });
    } else {
      results.push({
        ruleId: "abv_no_percentage",
        checklistItemId: id,
        severity: "error",
        message: "No alcohol percentage found in statement.",
        pass: false,
        citation: citationFor("abv_no_percentage"),
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Net Contents Format
// ---------------------------------------------------------------------------

function validateNetContents(text: string | undefined, category: BeverageCategory): ValidationResult[] {
  const results: ValidationResult[] = [];
  const id = "net_contents";

  if (!text) {
    results.push({
      ruleId: "net_contents_present",
      checklistItemId: id,
      severity: "error",
      message: "Net contents statement not found.",
      suggestion:
        category === "beer"
          ? "Must include volume in American measure (e.g., 12 FL OZ, 1 PINT, 1 QUART). Metric may also be shown."
          : "Must include volume (e.g., 750 mL, 1 L, 12 FL OZ).",
      pass: false,
      citation: citationFor("net_contents_present"),
    });
    return results;
  }

  // American units (required for malt beverages, accepted for all)
  const hasAmericanUnit =
    /\d+\.?\d*\s*(fl\.?\s*oz\.?|fluid\s+ounces?|pints?|pt\.?|quarts?|qt\.?|gallons?|gal\.?)/i.test(text);
  // Metric units (required for wine/spirits, optional for beer)
  const hasMetricUnit = /\d+\.?\d*\s*(ml|l|cl|liters?|milliliters?|centiliters?)/i.test(text);

  if (category === "beer") {
    // Malt beverages: American measure REQUIRED, metric optional
    if (hasAmericanUnit) {
      results.push({
        ruleId: "net_contents_valid",
        checklistItemId: id,
        severity: "info",
        message: "Net contents found in American measure" + (hasMetricUnit ? " (with metric equivalent)." : "."),
        pass: true,
        citation: citationFor("net_contents_valid"),
      });
    } else if (hasMetricUnit) {
      results.push({
        ruleId: "net_contents_metric_only",
        checklistItemId: id,
        severity: "warning",
        message: "Net contents found in metric only — malt beverages must include American measure.",
        suggestion:
          "Per 27 CFR 7.28, malt beverages must state net contents in American measure (FL OZ, PINT, QUART, GALLON). Metric may also appear.",
        pass: false,
        citation: citationFor("net_contents_metric_only"),
      });
    } else {
      results.push({
        ruleId: "net_contents_no_unit",
        checklistItemId: id,
        severity: "warning",
        message: "Net contents found but unit may be missing or unclear.",
        suggestion: "Must include American measure: FL OZ, PINT, QUART, or GALLON.",
        pass: false,
        citation: citationFor("net_contents_no_unit"),
      });
    }
  } else {
    // Wine & spirits: metric or American accepted
    if (hasMetricUnit || hasAmericanUnit) {
      results.push({
        ruleId: "net_contents_valid",
        checklistItemId: id,
        severity: "info",
        message: "Net contents statement found with valid unit.",
        pass: true,
        citation: citationFor("net_contents_valid"),
      });
    } else {
      results.push({
        ruleId: "net_contents_no_unit",
        checklistItemId: id,
        severity: "warning",
        message: "Net contents found but unit may be missing or unclear.",
        suggestion: "Must include standard metric units: mL, L, or cL.",
        pass: false,
        citation: citationFor("net_contents_no_unit"),
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Presence rules — simple checks for required fields
// ---------------------------------------------------------------------------

function validatePresence(
  fieldValue: string | undefined,
  checklistItemId: string,
  fieldLabel: string,
): ValidationResult {
  if (fieldValue && fieldValue.trim().length > 0) {
    return {
      ruleId: `${checklistItemId}_present`,
      checklistItemId,
      severity: "info",
      message: `${fieldLabel} detected.`,
      pass: true,
      citation: citationFor(`${checklistItemId}_present`),
    };
  }
  return {
    ruleId: `${checklistItemId}_missing`,
    checklistItemId,
    severity: "error",
    message: `${fieldLabel} not found on label.`,
    pass: false,
    citation: citationFor(`${checklistItemId}_missing`),
  };
}

// ---------------------------------------------------------------------------
// Class/Type Designation Lookup — per TTB Beverage Alcohol Manual
// ---------------------------------------------------------------------------

const BEER_DESIGNATIONS = [
  "ale",
  "beer",
  "lager",
  "stout",
  "porter",
  "malt liquor",
  "malt beverage",
  "india pale ale",
  "ipa",
  "pale ale",
  "amber ale",
  "brown ale",
  "blonde ale",
  "golden ale",
  "cream ale",
  "scotch ale",
  "old ale",
  "barley wine",
  "barleywine",
  "wheat beer",
  "hefeweizen",
  "witbier",
  "weissbier",
  "dunkelweizen",
  "pilsner",
  "pilsener",
  "bock",
  "doppelbock",
  "maibock",
  "eisbock",
  "dunkel",
  "schwarzbier",
  "vienna lager",
  "oktoberfest",
  "märzen",
  "marzen",
  "kölsch",
  "kolsch",
  "altbier",
  "rauchbier",
  "saison",
  "farmhouse ale",
  "belgian ale",
  "tripel",
  "dubbel",
  "quadrupel",
  "sour ale",
  "gose",
  "berliner weisse",
  "lambic",
  "gueuze",
  "flanders red",
  "hard seltzer",
  "hard cider",
  "flavored malt beverage",
  "malt cooler",
  "near beer",
  "non-alcoholic malt beverage",
];

const WINE_DESIGNATIONS = [
  "red wine",
  "white wine",
  "rosé",
  "rose",
  "blush wine",
  "sparkling wine",
  "champagne",
  "prosecco",
  "cava",
  "crémant",
  "cremant",
  "dessert wine",
  "fortified wine",
  "port",
  "sherry",
  "madeira",
  "marsala",
  "vermouth",
  "aperitif wine",
  "table wine",
  "light wine",
  "cabernet sauvignon",
  "merlot",
  "pinot noir",
  "syrah",
  "shiraz",
  "zinfandel",
  "malbec",
  "tempranillo",
  "sangiovese",
  "grenache",
  "nebbiolo",
  "chardonnay",
  "sauvignon blanc",
  "riesling",
  "pinot grigio",
  "pinot gris",
  "gewürztraminer",
  "gewurztraminer",
  "viognier",
  "chenin blanc",
  "semillon",
  "muscat",
  "moscato",
  "moscatel",
  "fruit wine",
  "apple wine",
  "berry wine",
  "honey wine",
  "mead",
  "sake",
  "rice wine",
];

const SPIRITS_DESIGNATIONS = [
  "whiskey",
  "whisky",
  "bourbon",
  "rye whiskey",
  "corn whiskey",
  "kentucky straight bourbon",
  "kentucky straight bourbon whiskey",
  "straight bourbon whiskey",
  "straight bourbon",
  "straight rye whiskey",
  "tennessee whiskey",
  "scotch whisky",
  "scotch",
  "irish whiskey",
  "canadian whisky",
  "blended whiskey",
  "blended whisky",
  "single malt",
  "single malt scotch whisky",
  "single malt whiskey",
  "vodka",
  "flavored vodka",
  "gin",
  "london dry gin",
  "dry gin",
  "old tom gin",
  "rum",
  "white rum",
  "gold rum",
  "dark rum",
  "aged rum",
  "spiced rum",
  "tequila",
  "blanco tequila",
  "reposado tequila",
  "añejo tequila",
  "anejo tequila",
  "mezcal",
  "sotol",
  "raicilla",
  "brandy",
  "cognac",
  "armagnac",
  "grappa",
  "pisco",
  "eau de vie",
  "liqueur",
  "cordial",
  "cream liqueur",
  "absinthe",
  "aquavit",
  "baijiu",
  "cachaça",
  "cachaca",
  "soju",
  "shochu",
];

function validateClassType(text: string | undefined, category: BeverageCategory): ValidationResult[] {
  const results: ValidationResult[] = [];
  const id = "class_type";

  if (!text) return results; // presence is checked elsewhere

  const normalized = text.toLowerCase().trim();
  const designations =
    category === "beer" ? BEER_DESIGNATIONS : category === "wine" ? WINE_DESIGNATIONS : SPIRITS_DESIGNATIONS;

  const matched = designations.some((d) => normalized.includes(d));

  if (matched) {
    results.push({
      ruleId: "class_type_recognized",
      checklistItemId: id,
      severity: "info",
      message: `"${text}" is a recognized TTB ${category} designation.`,
      pass: true,
      citation: citationFor("class_type_recognized"),
    });
  } else {
    // Check if it matches a DIFFERENT category's designations
    const allOther = [
      ...(category !== "beer" ? BEER_DESIGNATIONS : []),
      ...(category !== "wine" ? WINE_DESIGNATIONS : []),
      ...(category !== "spirits" ? SPIRITS_DESIGNATIONS : []),
    ];
    const crossMatch = allOther.some((d) => normalized.includes(d));

    if (crossMatch) {
      results.push({
        ruleId: "class_type_wrong_category",
        checklistItemId: id,
        severity: "warning",
        message: `"${text}" appears to be a designation for a different beverage category. Verify the selected category is correct.`,
        pass: false,
        citation: citationFor("class_type_wrong_category"),
      });
    } else {
      results.push({
        ruleId: "class_type_unrecognized",
        checklistItemId: id,
        severity: "warning",
        message: `"${text}" is not in the standard TTB designation list for ${category}. This may still be valid — verify against TTB guidelines.`,
        suggestion: `Common ${category} designations include: ${designations
          .slice(0, 6)
          .map((d) => `"${d}"`)
          .join(", ")}, etc.`,
        pass: false,
        citation: citationFor("class_type_unrecognized"),
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Shared ABV parser — extracts numeric ABV value from alcohol content text
// ---------------------------------------------------------------------------

function parseAbvNumber(text: string | undefined): number | null {
  if (!text) return null;
  // Try "XX proof" first — proof / 2 = ABV
  const proofMatch = text.match(/(\d{2,3})\s*proof/i);
  if (proofMatch) return parseFloat(proofMatch[1]) / 2;
  // Try percentage (accept comma as European decimal separator: 13,2%)
  const pctMatch = text.match(/(\d{1,2}[.,]?\d?)\s*%/);
  if (pctMatch) return parseFloat(pctMatch[1].replace(',', '.'));
  return null;
}

function parseProofNumber(text: string | undefined): number | null {
  if (!text) return null;
  const m = text.match(/(\d{2,3})\s*proof/i);
  return m ? parseFloat(m[1]) : null;
}

// ---------------------------------------------------------------------------
// Spirits-specific validation — 27 CFR Part 5
// ---------------------------------------------------------------------------

function validateSpiritsSpecific(fields: ExtractedFields): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Proof / ABV consistency check
  if (fields.alcoholContent) {
    const abv = parseAbvNumber(fields.alcoholContent);
    const proof = parseProofNumber(fields.alcoholContent);

    // If both proof and ABV% are present, check consistency (proof ≈ 2 × ABV)
    const pctMatch = fields.alcoholContent.match(/(\d{1,2}\.?\d?)\s*%/);
    if (proof !== null && pctMatch) {
      const abvFromPct = parseFloat(pctMatch[1]);
      const expectedProof = abvFromPct * 2;
      const tolerance = 1.5; // allow rounding
      if (Math.abs(proof - expectedProof) <= tolerance) {
        results.push({
          ruleId: "spirits_proof_abv_consistent",
          checklistItemId: "alcohol_content",
          severity: "info",
          message: `Proof (${proof}) and ABV (${abvFromPct}%) are consistent.`,
          pass: true,
          citation: citationFor("spirits_proof_abv_consistent"),
        });
      } else {
        results.push({
          ruleId: "spirits_proof_abv_mismatch",
          checklistItemId: "alcohol_content",
          severity: "warning",
          message: `Proof (${proof}) does not match ABV (${abvFromPct}%) — expected proof to be ${expectedProof}.`,
          suggestion: "Proof must equal twice the percentage of alcohol by volume per 27 CFR §5.37(b).",
          pass: false,
          citation: citationFor("spirits_proof_abv_mismatch"),
        });
      }
    }

    // ABV range check for spirits
    if (abv !== null) {
      if (abv >= 15) {
        results.push({
          ruleId: "spirits_abv_range_ok",
          checklistItemId: "alcohol_content",
          severity: "info",
          message: `ABV ${abv}% is within expected spirits range.`,
          pass: true,
          citation: citationFor("spirits_abv_range_ok"),
        });
      } else {
        results.push({
          ruleId: "spirits_abv_range_low",
          checklistItemId: "alcohol_content",
          severity: "warning",
          message: `ABV ${abv}% is unusually low for spirits.`,
          suggestion: "Verify the beverage category. Products under 15% ABV may be wine or a ready-to-drink cocktail.",
          pass: false,
          citation: citationFor("spirits_abv_range_low"),
        });
      }
    }
  }

  // Straight whisky age statement check (27 CFR §5.74)
  const ct = (fields.classType || "").toLowerCase();
  const isStraight = /\bstraight\b/i.test(ct);
  if (isStraight) {
    if (fields.ageStatement) {
      results.push({
        ruleId: "spirits_straight_age_ok",
        checklistItemId: "age_statement",
        severity: "info",
        message: "Age statement found on straight whisky — compliant with 27 CFR §5.74.",
        pass: true,
        citation: citationFor("spirits_straight_age_ok"),
      });
    } else {
      results.push({
        ruleId: "spirits_straight_age_note",
        checklistItemId: "age_statement",
        severity: "warning",
        message: "\"Straight\" whisky without an age statement — must be aged at least 4 years.",
        suggestion: "If aged less than 4 years, an age statement is required per 27 CFR §5.74. Verify with producer records.",
        pass: false,
        citation: citationFor("spirits_straight_age_note"),
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Wine-specific validation — 27 CFR Part 4
// ---------------------------------------------------------------------------

function validateWineSpecific(fields: ExtractedFields): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Varietal percentage note (27 CFR §4.23)
  if (fields.varietal) {
    results.push({
      ruleId: "wine_varietal_75_note",
      checklistItemId: "varietal",
      severity: "info",
      message: `Varietal "${fields.varietal}" stated — at least 75% must be this grape (85% if AVA-designated).`,
      pass: true,
      citation: citationFor("wine_varietal_75_note"),
    });
  }

  // Wine ABV range check (27 CFR §4.36)
  if (fields.alcoholContent) {
    const abv = parseAbvNumber(fields.alcoholContent);
    if (abv !== null) {
      if (abv <= 24) {
        results.push({
          ruleId: "wine_abv_range_ok",
          checklistItemId: "alcohol_content",
          severity: "info",
          message: `ABV ${abv}% is within expected wine range.`,
          pass: true,
          citation: citationFor("wine_abv_range_ok"),
        });
      } else {
        results.push({
          ruleId: "wine_abv_range_high",
          checklistItemId: "alcohol_content",
          severity: "warning",
          message: `ABV ${abv}% is unusually high for wine.`,
          suggestion: "Wine above 24% ABV is rare. Verify this is not a fortified wine or spirits product.",
          pass: false,
          citation: citationFor("wine_abv_range_high"),
        });
      }
    }
  }

  // Vintage year plausibility (27 CFR §4.27)
  if (fields.vintageDate) {
    const yearMatch = fields.vintageDate.match(/(\d{4})/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      const currentYear = new Date().getFullYear();
      if (year >= 1900 && year <= currentYear) {
        results.push({
          ruleId: "wine_vintage_plausible",
          checklistItemId: "vintage_date",
          severity: "info",
          message: `Vintage year ${year} is plausible.`,
          pass: true,
          citation: citationFor("wine_vintage_plausible"),
        });
      } else {
        results.push({
          ruleId: "wine_vintage_implausible",
          checklistItemId: "vintage_date",
          severity: "warning",
          message: `Vintage year ${year} appears implausible.`,
          suggestion: year > currentYear
            ? "Vintage year is in the future — verify the year is correct."
            : "Vintage year is before 1900 — verify the year is correct.",
          pass: false,
          citation: citationFor("wine_vintage_implausible"),
        });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Beer-specific validation — 27 CFR Part 7
// ---------------------------------------------------------------------------

/** Class/type keywords that indicate a flavored malt beverage */
const FMB_KEYWORDS = [
  "flavored malt beverage", "hard seltzer", "hard cider", "hard lemonade",
  "wine cooler", "malt cooler", "seltzer", "flavored malt",
];

function validateBeerSpecific(fields: ExtractedFields): ValidationResult[] {
  const results: ValidationResult[] = [];

  // FMB composition statement note
  const ct = (fields.classType || "").toLowerCase();
  const isFmb = FMB_KEYWORDS.some((kw) => ct.includes(kw));
  if (isFmb) {
    results.push({
      ruleId: "beer_fmb_composition_note",
      checklistItemId: "class_type",
      severity: "info",
      message: "Flavored malt beverage detected — a statement of composition may be required.",
      suggestion: "Per TTB Ruling 2004-1, FMBs derived from malt base with added flavors may need a composition statement on the label.",
      pass: true,
      citation: citationFor("beer_fmb_composition_note"),
    });
  }

  // Beer ABV range check
  if (fields.alcoholContent) {
    const abv = parseAbvNumber(fields.alcoholContent);
    if (abv !== null) {
      if (abv <= 15) {
        results.push({
          ruleId: "beer_abv_range_ok",
          checklistItemId: "alcohol_content",
          severity: "info",
          message: `ABV ${abv}% is within expected malt beverage range.`,
          pass: true,
          citation: citationFor("beer_abv_range_ok"),
        });
      } else {
        results.push({
          ruleId: "beer_abv_range_high",
          checklistItemId: "alcohol_content",
          severity: "warning",
          message: `ABV ${abv}% is unusually high for a malt beverage.`,
          suggestion: "Most malt beverages are under 15% ABV. Verify the beverage category is correct.",
          pass: false,
          citation: citationFor("beer_abv_range_high"),
        });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Cross-field rules
// ---------------------------------------------------------------------------

function validateCrossFieldRules(
  fields: ExtractedFields,
  category: BeverageCategory,
  labelPosition: "front" | "back" | "other",
): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Wine: varietal requires appellation
  if (category === "wine" && fields.varietal && !fields.appellation) {
    results.push({
      ruleId: "varietal_requires_appellation",
      checklistItemId: "appellation",
      severity: "warning",
      message: "Grape varietal is stated — appellation of origin is required.",
      suggestion: "Per TTB regulations, when a grape variety is stated, an appellation of origin must also appear.",
      pass: false,
      citation: citationFor("varietal_requires_appellation"),
    });
  }

  // Wine: vintage requires appellation
  if (category === "wine" && fields.vintageDate && !fields.appellation) {
    results.push({
      ruleId: "vintage_requires_appellation",
      checklistItemId: "appellation",
      severity: "warning",
      message: "Vintage date is stated — appellation of origin is required.",
      suggestion: "Per TTB regulations, when a vintage year is stated, an appellation of origin must also appear.",
      pass: false,
      citation: citationFor("vintage_requires_appellation"),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main validation entry point
// ---------------------------------------------------------------------------

/**
 * Run all validation rules against extracted fields.
 * Returns a flat list of ValidationResult, one per rule check.
 */
export function validateExtractedFields(
  fields: ExtractedFields,
  category: BeverageCategory,
  labelPosition: "front" | "back" | "other",
): ValidationResult[] {
  const results: ValidationResult[] = [];

  // --- Presence checks for front label fields ---
  if (labelPosition === "front" || labelPosition === "other") {
    results.push(validatePresence(fields.brandName, "brand_name", "Brand name"));
    results.push(validatePresence(fields.classType, "class_type", "Class/type designation"));
    results.push(...validateClassType(fields.classType, category));
  }

  // --- Format validations ---
  if (labelPosition === "front" || labelPosition === "other") {
    results.push(...validateAbvFormat(fields.alcoholContent, category));
  }

  if (labelPosition === "back" || labelPosition === "other") {
    results.push(...validateHealthWarning(fields.healthWarning));
  }

  // Name & address: required on back for all; also required on front for domestic malt beverages
  if (labelPosition === "back" || labelPosition === "other" || labelPosition === "front") {
    results.push(validatePresence(fields.nameAddress, "name_address", "Name and address"));
  }

  // Net contents can appear on front or back
  results.push(...validateNetContents(fields.netContents, category));

  // --- Category-specific fields ---

  // Sulfite declaration: MANDATORY for wine (virtually all wines ≥ 10 ppm SO₂), optional for beer
  if (category === "wine") {
    if (fields.sulfiteDeclaration) {
      results.push({
        ruleId: "sulfite_present",
        checklistItemId: "sulfite_declaration",
        severity: "info",
        message: "Sulfite declaration found.",
        pass: true,
        citation: citationFor("sulfite_present"),
      });
    } else {
      results.push({
        ruleId: "sulfite_wine_missing",
        checklistItemId: "sulfite_declaration",
        severity: "error",
        message: "Sulfite declaration not found — required on wine labels per 27 CFR §4.32(e).",
        suggestion: '"Contains Sulfites" must appear on the label. Virtually all wines contain ≥ 10 ppm SO₂.',
        pass: false,
        citation: citationFor("sulfite_wine_missing"),
      });
    }
  } else if (category === "beer") {
    if (fields.sulfiteDeclaration) {
      results.push({
        ruleId: "sulfite_present",
        checklistItemId: "sulfite_declaration",
        severity: "info",
        message: "Sulfite declaration found.",
        pass: true,
        citation: citationFor("sulfite_present"),
      });
    }
  }

  // Age statement: conditional for spirits
  if (category === "spirits" && labelPosition === "front") {
    if (fields.ageStatement) {
      results.push({
        ruleId: "age_statement_present",
        checklistItemId: "age_statement",
        severity: "info",
        message: "Age statement found.",
        pass: true,
        citation: citationFor("age_statement_present"),
      });
    }
  }

  // Color ingredient disclosures: conditional for all categories (if present, note it)
  if (fields.colorIngredients) {
    results.push({
      ruleId: "color_ingredients_present",
      checklistItemId: "color_ingredients",
      severity: "info",
      message: "Color ingredient disclosures found.",
      pass: true,
      citation: citationFor("color_ingredients_present"),
    });
  }

  // Commodity statement: conditional for spirits
  if (category === "spirits" && fields.commodityStatement) {
    results.push({
      ruleId: "commodity_statement_present",
      checklistItemId: "commodity_statement",
      severity: "info",
      message: "Commodity statement found.",
      pass: true,
      citation: citationFor("commodity_statement_present"),
    });
  }

  // Aspartame declaration: conditional for beer
  if (category === "beer" && fields.aspartameDeclaration) {
    results.push({
      ruleId: "aspartame_declaration_present",
      checklistItemId: "aspartame_declaration",
      severity: "info",
      message: "Aspartame declaration found.",
      pass: true,
      citation: citationFor("aspartame_declaration_present"),
    });
  }

  // --- Category-specific validation rules ---
  if (category === "spirits") {
    results.push(...validateSpiritsSpecific(fields));
  } else if (category === "wine") {
    results.push(...validateWineSpecific(fields));
  } else if (category === "beer") {
    results.push(...validateBeerSpecific(fields));
  }

  // --- Cross-field rules ---
  results.push(...validateCrossFieldRules(fields, category, labelPosition));

  return results;
}

/**
 * Apply validation results to checklist items.
 * Updates status and note fields based on rule outcomes.
 */
export function applyValidationResults(checklist: ChecklistItem[], results: ValidationResult[]): ChecklistItem[] {
  return checklist.map((item) => {
    const itemResults = results.filter((r) => r.checklistItemId === item.id);
    if (itemResults.length === 0) return item;

    // If any result is a failure, mark as auto_fail
    const hasFailure = itemResults.some((r) => !r.pass);
    const hasError = itemResults.some((r) => r.severity === "error" && !r.pass);
    const allPass = itemResults.every((r) => r.pass);

    // Build a combined note from all results
    const notes = itemResults
      .filter((r) => !r.pass || r.severity === "info")
      .map((r) => {
        const icon = r.pass ? "✓" : r.severity === "error" ? "✗" : "⚠";
        return `${icon} ${r.message}${r.suggestion ? ` — ${r.suggestion}` : ""}`;
      })
      .join("\n");

    let newStatus = item.status;
    if (allPass) {
      newStatus = "auto_pass";
    } else if (hasError) {
      newStatus = "auto_fail";
    }
    // Keep existing status if only warnings (user should review)

    return {
      ...item,
      status: newStatus,
      note: notes || item.note,
      confidence: allPass ? 0.85 : hasError ? 0.8 : 0.6,
      validationResults: itemResults,
    };
  });
}
