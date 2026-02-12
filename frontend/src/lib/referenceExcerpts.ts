/**
 * Pre-extracted regulation text excerpts keyed by section slug.
 * Used by the Explain API to provide contextual regulatory guidance.
 *
 * Each excerpt is 500-800 tokens of the relevant regulation text from
 * the TTB Beverage Alcohol Manual and 27 CFR references.
 */

export const REFERENCE_EXCERPTS: Record<string, string> = {
  "mandatory-label-info": `Per TTB Beverage Alcohol Manual Vol. 3, Ch. 1 — the following information is mandatory on all malt beverage labels: (1) Brand name on the front in min 2 mm type, (2) Class/type designation on the front, (3) Name and address of producer/bottler on the front (domestic) or importer on front/back/side, (4) Net contents in American measure on the front, (5) Alcohol content (optional for malt beverages unless required by state law), and the Government Health Warning on any label position. All mandatory text must be readily legible on a contrasting background, separate and apart from descriptive or explanatory information. Type size minimums: 2 mm for containers over 1/2 pint, 1 mm for containers 1/2 pint or less.`,

  "brand-name": `Per TTB Beverage Alcohol Manual Vol. 3, Ch. 1, Item 1 — the brand name is the name under which a malt beverage or line of malt beverages is marketed. It must appear on the FRONT of the container in minimum 2 mm type (1 mm for containers ≤ 1/2 pint). The brand name must be readily legible, on a contrasting background, separate and apart from (or substantially more conspicuous than) descriptive or explanatory information. A brand name that describes the age, origin, identity, or other characteristics of the malt beverage is prohibited UNLESS it accurately describes the product and conveys no erroneous impression, OR is qualified with the word "BRAND" or a statement that dispels any erroneous impression.`,

  "class-type": `Per TTB Beverage Alcohol Manual Vol. 3, Ch. 1, Item 2 and Ch. 4 — the class/type designation identifies the specific identity of the malt beverage (e.g., "Beer," "Ale," "India Pale Ale"). It must appear on the FRONT of the container in min 2 mm type. Three levels of specificity are acceptable: (1) General classification: "Malt Beverage"; (2) Class: "Ale," "Beer," "Lager"; (3) Type: "India Pale Ale," "Bock Beer." Recognized classes include Ale, Beer, Cereal Beverage, Lager, Malt Beverage Specialty, Malt Liquor, Near Beer, Porter, and Stout. For specialty malt beverages, a fanciful name plus a composition statement is required. Per 27 CFR Part 7.`,

  "alcohol-content": `Per TTB Beverage Alcohol Manual Vol. 3, Ch. 1, Item 5 and 27 CFR 7.71 — alcohol content is OPTIONAL for malt beverages unless required or prohibited by state law. If stated, it must be expressed as percent by volume. Acceptable formats include: "ALCOHOL (ALC) __% BY VOLUME (VOL)," "ALC __% BY VOL," "__% ALCOHOL BY VOLUME," or "__% ALC/VOL." The abbreviation "ABV" alone is NOT an accepted format. Precision: must be to the nearest 0.1%. Tolerances: ±0.3% for beverages ≥ 0.5% ABV. Type size: min 2 mm, max 3 mm (containers ≤ 40 fl. oz.) or 4 mm (> 40 fl. oz.). All portions must be of the same kind and size of lettering, and equally conspicuous coloring.`,

  "net-contents": `Per TTB Beverage Alcohol Manual Vol. 3, Ch. 1, Item 4 and Ch. 5 / 27 CFR 7.28 — net contents must be expressed in American measure. Metric measure may also appear but is not sufficient alone. There are no standards of fill for malt beverages. Placement: front of the container, or blown/branded/burned into container. Format depends on volume: less than 1 pint → fluid ounces; 1 pint → "1 pint"; more than 1 pint but less than 1 quart → pints and fluid ounces; 1 quart → "1 quart"; more than 1 quart → quarts, pints, and fluid ounces or fractions of a gallon. Type size: min 2 mm (> 1/2 pint), 1 mm (≤ 1/2 pint).`,

  "name-address": `Per TTB Beverage Alcohol Manual Vol. 3, Ch. 1, Item 3 and 27 CFR Part 7 — for domestic products, the name and address of the producer/bottler or packer must appear, optionally preceded by "BREWED AND BOTTLED BY," "BREWED BY," or "BOTTLED/PACKED BY." For imported products, the name and address of the importer must appear, preceded by "IMPORTED BY," "SOLE AGENT," or "SOLE U.S. AGENT." The name must be the company/corporate name or trade name identical to that on the brewer's notice (domestic) or basic permit (imported). Address: city and state where bottled/packed, or principal place of business. Domestic placement: FRONT of container. Imported: front, back, or side.`,

  "health-warning": `Per TTB Beverage Alcohol Manual Vol. 3, Ch. 1, Item 10 and Ch. 3 / 27 CFR Part 16 — the Government Warning is required on ALL alcohol beverages ≥ 0.5% ABV bottled on or after November 18, 1989. Prescribed text: "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems." Format: "GOVERNMENT WARNING" must be in ALL CAPS and BOLD. The remainder must NOT be bold. Must appear as a continuous paragraph. Type size: 3 mm (> 3L), 2 mm (> 237 mL to 3L), 1 mm (≤ 237 mL). Characters per inch limits: 40 (1 mm), 25 (2 mm), 12 (3 mm).`,

  "sulfite-declaration": `Per TTB Beverage Alcohol Manual Vol. 3, Ch. 1, Item 8 and 27 CFR Part 7 — a sulfite declaration is required on any malt beverage containing 10 or more parts per million (ppm) sulfur dioxide. Acceptable text: "CONTAINS SULFITES" or "CONTAINS (A) SULFITING AGENT(S)" or identification of the specific sulfiting agent(s). "Sulphites" may be used in lieu of "Sulfites." Placement: front, back, or side of the container. Type size: min 2 mm (> 1/2 pint), 1 mm (≤ 1/2 pint).`,

  "country-of-origin": `Per TTB Beverage Alcohol Manual Vol. 3, Ch. 1, Item 11 and U.S. Customs Service regulations — country of origin is required for any IMPORTED malt beverage. Not required for domestic products. No specific type size or legibility requirements. Acceptable formats: "PRODUCT OF [Country]," "PRODUCE OF [Country]," "PRODUCED/BREWED IN [Country]," "PRODUCED/BREWED AND BOTTLED OR PACKED IN [Country]," "PRODUCED/BREWED BY [Name and address in country]," or "[Country] ALE" (country name with class/type designation).`,

  "type-size": `Per TTB Beverage Alcohol Manual Vol. 3, Ch. 2 and 27 CFR Parts 7, 16 — type size rules for mandatory label information: All mandatory info except ABV and health warning: min 2 mm (> 1/2 pint), min 1 mm (≤ 1/2 pint), no max. Alcohol content: min 2 mm, min 1 mm, max 3 mm (≤ 40 fl. oz.) or 4 mm (> 40 fl. oz.). Health warning: see Ch. 3 (min 1-3 mm based on container size, with characters-per-inch limits). Country of origin: no specific requirement. All mandatory text must be readily legible on a contrasting background.`,

  appellation: `Per TTB regulations for wine labeling (27 CFR Part 4) — an appellation of origin is a geographic designation indicating where the grapes were grown. When a grape variety (varietal) is stated on the label, an appellation of origin MUST also appear. Similarly, when a vintage year is stated, an appellation of origin is required. For American appellations, at least 75% of the grapes must come from the designated area (85% for American Viticultural Areas). The appellation must appear on the front label.`,

  "vintage-varietal": `Per TTB regulations for wine labeling (27 CFR Part 4) — a vintage date indicates the year the grapes were harvested. If stated, at least 95% of the wine must be derived from grapes harvested in that year (85% for non-AVA appellations). A grape varietal designation (e.g., "Pinot Noir") requires that at least 75% of the wine is made from that grape variety. Both vintage and varietal statements trigger the requirement for an appellation of origin to also appear on the label.`,
};

/**
 * Map ruleId prefixes to reference excerpt slugs.
 */
const RULE_TO_SECTION: Record<string, string> = {
  health_warning: "health-warning",
  abv: "alcohol-content",
  net_contents: "net-contents",
  brand_name: "brand-name",
  class_type: "class-type",
  name_address: "name-address",
  sulfite: "sulfite-declaration",
  age_statement: "alcohol-content",
  country_origin: "country-of-origin",
  varietal_requires: "vintage-varietal",
  vintage_requires: "vintage-varietal",
};

/**
 * Look up the reference excerpt for a given ruleId.
 */
export function getExcerptForRule(ruleId: string): string | undefined {
  // Try exact match first, then prefix match
  for (const [prefix, slug] of Object.entries(RULE_TO_SECTION)) {
    if (ruleId.startsWith(prefix)) {
      return REFERENCE_EXCERPTS[slug];
    }
  }
  return REFERENCE_EXCERPTS["mandatory-label-info"];
}
