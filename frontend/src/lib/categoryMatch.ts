/**
 * Category inference and verification for TTB COLA labels.
 *
 * Two-level classification:
 *   Level 1 (top-level): Beer, Wine, Spirits
 *   Level 2 (subcategory): e.g. "India Pale Ale", "Chardonnay", "Bourbon"
 *
 * Uses OCR-extracted class/type, varietal, and raw text to infer the
 * beverage category, then compares against the submitted category.
 */

import type { BeverageCategory } from "./types";

// ---------------------------------------------------------------------------
// Subcategory → Parent Category mapping
// ---------------------------------------------------------------------------

interface SubcategoryEntry {
  term: string;
  pattern: RegExp;
  parent: BeverageCategory;
  subcategory: string;
}

/**
 * Comprehensive term-to-category mapping. Order matters — more specific terms
 * should come before generic ones (e.g. "hard cider" before "cider").
 */
const SUBCATEGORY_MAP: SubcategoryEntry[] = [
  // ── Beer & Malt Beverages ───────────────────────────────────────────────
  // Compound styles first
  { term: "hard seltzer", pattern: /\bhard\s+seltzer\b/i, parent: "beer", subcategory: "Hard Seltzer" },
  { term: "hard cider", pattern: /\bhard\s+cider\b/i, parent: "beer", subcategory: "Hard Cider" },
  { term: "hard lemonade", pattern: /\bhard\s+lemonade\b/i, parent: "beer", subcategory: "Hard Lemonade" },
  { term: "malt beverage", pattern: /\b(?:flavored\s+)?malt\s+beverage\b/i, parent: "beer", subcategory: "Malt Beverage" },
  { term: "malt liquor", pattern: /\bmalt\s+liquor\b/i, parent: "beer", subcategory: "Malt Liquor" },
  // IPA variants
  { term: "double IPA", pattern: /\b(?:double|imperial)\s+(?:india\s+)?pale\s+ale\b/i, parent: "beer", subcategory: "Double IPA" },
  { term: "DIPA", pattern: /\bDIPA\b/, parent: "beer", subcategory: "Double IPA" },
  { term: "hazy IPA", pattern: /\bhazy\s+(?:double\s+)?(?:india\s+)?pale\s+ale\b/i, parent: "beer", subcategory: "Hazy IPA" },
  { term: "session IPA", pattern: /\bsession\s+(?:india\s+)?pale\s+ale\b/i, parent: "beer", subcategory: "Session IPA" },
  { term: "black IPA", pattern: /\bblack\s+(?:india\s+)?pale\s+ale\b/i, parent: "beer", subcategory: "Black IPA" },
  { term: "NE IPA", pattern: /\b(?:new\s+england|NE)\s+(?:style\s+)?(?:india\s+)?pale\s+ale\b/i, parent: "beer", subcategory: "New England IPA" },
  { term: "India Pale Ale", pattern: /\bindia\s+pale\s+ale\b/i, parent: "beer", subcategory: "India Pale Ale" },
  { term: "IPA", pattern: /\bIPA\b/, parent: "beer", subcategory: "India Pale Ale" },
  // Belgian styles
  { term: "belgian tripel", pattern: /\bbelgian\s+tripel\b/i, parent: "beer", subcategory: "Belgian Tripel" },
  { term: "belgian dubbel", pattern: /\bbelgian\s+dubbel\b/i, parent: "beer", subcategory: "Belgian Dubbel" },
  { term: "belgian quad", pattern: /\bbelgian\s+quad\b/i, parent: "beer", subcategory: "Belgian Quad" },
  { term: "belgian strong", pattern: /\bbelgian\s+(?:strong|dark|pale)\b/i, parent: "beer", subcategory: "Belgian Ale" },
  // German styles
  { term: "hefeweizen", pattern: /\bhefeweizen\b/i, parent: "beer", subcategory: "Hefeweizen" },
  { term: "kolsch", pattern: /\bk[oö]lsch\b/i, parent: "beer", subcategory: "Kölsch" },
  { term: "dunkel", pattern: /\bdunkel\b/i, parent: "beer", subcategory: "Dunkel" },
  { term: "marzen", pattern: /\bm[aä]rzen\b/i, parent: "beer", subcategory: "Märzen" },
  { term: "bock", pattern: /\b(?:doppel)?bock\b/i, parent: "beer", subcategory: "Bock" },
  { term: "berliner weisse", pattern: /\bberliner\s+weisse?\b/i, parent: "beer", subcategory: "Berliner Weisse" },
  { term: "witbier", pattern: /\bwitbier\b/i, parent: "beer", subcategory: "Witbier" },
  // Sour styles
  { term: "fruited sour", pattern: /\bfruited\s+sour\b/i, parent: "beer", subcategory: "Fruited Sour" },
  { term: "gose", pattern: /\bgose\b/i, parent: "beer", subcategory: "Gose" },
  { term: "sour ale", pattern: /\bsour\s+ale\b/i, parent: "beer", subcategory: "Sour Ale" },
  { term: "sour", pattern: /\bsour\b/i, parent: "beer", subcategory: "Sour" },
  // Core styles
  { term: "pale ale", pattern: /\bpale\s+ale\b/i, parent: "beer", subcategory: "Pale Ale" },
  { term: "amber ale", pattern: /\bamber\s+ale\b/i, parent: "beer", subcategory: "Amber Ale" },
  { term: "brown ale", pattern: /\bbrown\s+ale\b/i, parent: "beer", subcategory: "Brown Ale" },
  { term: "blonde ale", pattern: /\bblonde?\s+ale\b/i, parent: "beer", subcategory: "Blonde Ale" },
  { term: "cream ale", pattern: /\bcream\s+ale\b/i, parent: "beer", subcategory: "Cream Ale" },
  { term: "scotch ale", pattern: /\bscotch\s+ale\b/i, parent: "beer", subcategory: "Scotch Ale" },
  { term: "strong ale", pattern: /\bstrong\s+ale\b/i, parent: "beer", subcategory: "Strong Ale" },
  { term: "farmhouse ale", pattern: /\bfarmhouse\s+ale\b/i, parent: "beer", subcategory: "Farmhouse Ale" },
  { term: "wild ale", pattern: /\bwild\s+ale\b/i, parent: "beer", subcategory: "Wild Ale" },
  { term: "wheat beer", pattern: /\bwheat\s+(?:beer|ale)\b/i, parent: "beer", subcategory: "Wheat Beer" },
  { term: "barleywine", pattern: /\bbarleywine\b/i, parent: "beer", subcategory: "Barleywine" },
  { term: "pilsner", pattern: /\bpilsner\b/i, parent: "beer", subcategory: "Pilsner" },
  { term: "lager", pattern: /\blager\b/i, parent: "beer", subcategory: "Lager" },
  { term: "stout", pattern: /\bstout\b/i, parent: "beer", subcategory: "Stout" },
  { term: "porter", pattern: /\bporter\b/i, parent: "beer", subcategory: "Porter" },
  { term: "saison", pattern: /\bsaison\b/i, parent: "beer", subcategory: "Saison" },
  // Generic beer terms (last)
  { term: "ale", pattern: /\bale\b/i, parent: "beer", subcategory: "Ale" },
  { term: "beer", pattern: /\bbeer\b/i, parent: "beer", subcategory: "Beer" },
  { term: "cider", pattern: /\bcider\b/i, parent: "beer", subcategory: "Cider" },
  { term: "brew", pattern: /\bbrew(?:ed|ery|ing)?\b/i, parent: "beer", subcategory: "Beer" },

  // ── Wine ────────────────────────────────────────────────────────────────
  // Wine types
  { term: "sparkling wine", pattern: /\bsparkling\s+wine\b/i, parent: "wine", subcategory: "Sparkling Wine" },
  { term: "table wine", pattern: /\btable\s+wine\b/i, parent: "wine", subcategory: "Table Wine" },
  { term: "dessert wine", pattern: /\bdessert\s+wine\b/i, parent: "wine", subcategory: "Dessert Wine" },
  { term: "fortified wine", pattern: /\bfortified\s+wine\b/i, parent: "wine", subcategory: "Fortified Wine" },
  { term: "red wine", pattern: /\bred\s+wine\b/i, parent: "wine", subcategory: "Red Wine" },
  { term: "white wine", pattern: /\bwhite\s+wine\b/i, parent: "wine", subcategory: "White Wine" },
  { term: "rosé", pattern: /(?<![a-zA-Z])ros[eé](?![a-zA-Z])/i, parent: "wine", subcategory: "Rosé" },
  { term: "champagne", pattern: /\bchampagne\b/i, parent: "wine", subcategory: "Champagne" },
  { term: "prosecco", pattern: /\bprosecco\b/i, parent: "wine", subcategory: "Prosecco" },
  { term: "port", pattern: /\bport(?:\s+wine)?\b/i, parent: "wine", subcategory: "Port" },
  { term: "sherry", pattern: /\bsherry\b/i, parent: "wine", subcategory: "Sherry" },
  { term: "vermouth", pattern: /\bvermouth\b/i, parent: "wine", subcategory: "Vermouth" },
  { term: "mead", pattern: /\bmead(?:ery)?\b/i, parent: "wine", subcategory: "Mead" },
  // Varietals (also strong wine indicators)
  { term: "cabernet sauvignon", pattern: /\bcabernet\s+sauvignon\b/i, parent: "wine", subcategory: "Cabernet Sauvignon" },
  { term: "cabernet franc", pattern: /\bcabernet\s+franc\b/i, parent: "wine", subcategory: "Cabernet Franc" },
  { term: "chardonnay", pattern: /\bchardonnay\b/i, parent: "wine", subcategory: "Chardonnay" },
  { term: "merlot", pattern: /\bmerlot\b/i, parent: "wine", subcategory: "Merlot" },
  { term: "pinot noir", pattern: /\bpinot\s+noir\b/i, parent: "wine", subcategory: "Pinot Noir" },
  { term: "pinot grigio", pattern: /\bpinot\s+grigio\b/i, parent: "wine", subcategory: "Pinot Grigio" },
  { term: "pinot gris", pattern: /\bpinot\s+gris\b/i, parent: "wine", subcategory: "Pinot Gris" },
  { term: "riesling", pattern: /\briesling\b/i, parent: "wine", subcategory: "Riesling" },
  { term: "sauvignon blanc", pattern: /\bsauvignon\s+blanc\b/i, parent: "wine", subcategory: "Sauvignon Blanc" },
  { term: "zinfandel", pattern: /\bzinfandel\b/i, parent: "wine", subcategory: "Zinfandel" },
  { term: "malbec", pattern: /\bmalbec\b/i, parent: "wine", subcategory: "Malbec" },
  { term: "syrah", pattern: /\bsyrah\b/i, parent: "wine", subcategory: "Syrah" },
  { term: "shiraz", pattern: /\bshiraz\b/i, parent: "wine", subcategory: "Shiraz" },
  { term: "tempranillo", pattern: /\btempranillo\b/i, parent: "wine", subcategory: "Tempranillo" },
  { term: "sangiovese", pattern: /\bsangiovese\b/i, parent: "wine", subcategory: "Sangiovese" },
  { term: "grenache", pattern: /\bgrenache\b/i, parent: "wine", subcategory: "Grenache" },
  { term: "viognier", pattern: /\bviognier\b/i, parent: "wine", subcategory: "Viognier" },
  { term: "gewürztraminer", pattern: /\bgew[uü]rztraminer\b/i, parent: "wine", subcategory: "Gewürztraminer" },
  { term: "chenin blanc", pattern: /\bchenin\s+blanc\b/i, parent: "wine", subcategory: "Chenin Blanc" },
  { term: "semillon", pattern: /\bse?millon\b/i, parent: "wine", subcategory: "Sémillon" },
  { term: "muscat", pattern: /\bmuscat(?:el)?\b/i, parent: "wine", subcategory: "Muscat" },
  { term: "moscato", pattern: /\bmoscato\b/i, parent: "wine", subcategory: "Moscato" },
  // Wine appellations/regions (strong wine indicators)
  { term: "bourgogne", pattern: /\bbourgogne\b/i, parent: "wine", subcategory: "Burgundy" },
  { term: "burgundy", pattern: /\bburgundy\b/i, parent: "wine", subcategory: "Burgundy" },
  { term: "bordeaux", pattern: /\bbordeaux\b/i, parent: "wine", subcategory: "Bordeaux" },
  { term: "chablis", pattern: /\bchablis\b/i, parent: "wine", subcategory: "Chablis" },
  { term: "chianti", pattern: /\bchianti\b/i, parent: "wine", subcategory: "Chianti" },
  { term: "rioja", pattern: /\brioja\b/i, parent: "wine", subcategory: "Rioja" },
  { term: "barolo", pattern: /\bbarolo\b/i, parent: "wine", subcategory: "Barolo" },
  { term: "champagne", pattern: /\bchampagne\b/i, parent: "wine", subcategory: "Champagne" },
  // Winemaking terms
  { term: "vineyard", pattern: /\bvineyard\b/i, parent: "wine", subcategory: "Wine" },
  { term: "vintage", pattern: /\bvintage\b/i, parent: "wine", subcategory: "Wine" },
  { term: "estate bottled", pattern: /\bestate\s+bottled\b/i, parent: "wine", subcategory: "Wine" },
  { term: "vinted", pattern: /\bvinted\b/i, parent: "wine", subcategory: "Wine" },
  { term: "appellation", pattern: /\bappellation\b/i, parent: "wine", subcategory: "Wine" },
  // Generic wine term (last)
  { term: "wine", pattern: /\bwine\b/i, parent: "wine", subcategory: "Wine" },

  // ── Spirits ─────────────────────────────────────────────────────────────
  // Compound types first
  { term: "straight bourbon", pattern: /\bstraight\s+bourbon\b/i, parent: "spirits", subcategory: "Straight Bourbon" },
  { term: "straight rye", pattern: /\bstraight\s+rye\s+whisk(?:e?y)\b/i, parent: "spirits", subcategory: "Straight Rye Whiskey" },
  { term: "single malt", pattern: /\bsingle\s+(?:malt|barrel)\s+(?:whisk(?:e?y)|scotch)\b/i, parent: "spirits", subcategory: "Single Malt" },
  { term: "small batch", pattern: /\bsmall\s+batch\s+(?:bourbon|whisk(?:e?y))\b/i, parent: "spirits", subcategory: "Small Batch" },
  { term: "blended whiskey", pattern: /\bblended\s+whisk(?:e?y)\b/i, parent: "spirits", subcategory: "Blended Whiskey" },
  { term: "rye whiskey", pattern: /\brye\s+whisk(?:e?y)\b/i, parent: "spirits", subcategory: "Rye Whiskey" },
  { term: "corn whiskey", pattern: /\bcorn\s+whisk(?:e?y)\b/i, parent: "spirits", subcategory: "Corn Whiskey" },
  { term: "tequila seltzer", pattern: /\btequila\s+seltzer\b/i, parent: "spirits", subcategory: "Tequila Seltzer" },
  { term: "vodka soda", pattern: /\bvodka\s+soda\b/i, parent: "spirits", subcategory: "Vodka Soda" },
  { term: "ranch water", pattern: /\branch\s+water\b/i, parent: "spirits", subcategory: "Ranch Water" },
  { term: "agave spirits", pattern: /\bagave\s+spirits?\b/i, parent: "spirits", subcategory: "Agave Spirit" },
  { term: "neutral spirits", pattern: /\b(?:corn\s+|grain\s+)?neutral\s+spirits?\b/i, parent: "spirits", subcategory: "Neutral Spirits" },
  // Core spirits
  { term: "bourbon", pattern: /\bbourbon\b/i, parent: "spirits", subcategory: "Bourbon" },
  { term: "scotch", pattern: /\bscotch\b/i, parent: "spirits", subcategory: "Scotch" },
  { term: "whiskey", pattern: /\bwhisk(?:e?y)\b/i, parent: "spirits", subcategory: "Whiskey" },
  { term: "vodka", pattern: /\bvodka\b/i, parent: "spirits", subcategory: "Vodka" },
  { term: "rum", pattern: /\brum\b/i, parent: "spirits", subcategory: "Rum" },
  { term: "gin", pattern: /\bgin\b/i, parent: "spirits", subcategory: "Gin" },
  { term: "tequila", pattern: /\btequila\b/i, parent: "spirits", subcategory: "Tequila" },
  { term: "mezcal", pattern: /\bmezcal\b/i, parent: "spirits", subcategory: "Mezcal" },
  { term: "brandy", pattern: /\bbrandy\b/i, parent: "spirits", subcategory: "Brandy" },
  { term: "cognac", pattern: /\bcognac\b/i, parent: "spirits", subcategory: "Cognac" },
  { term: "grappa", pattern: /\bgrappa\b/i, parent: "spirits", subcategory: "Grappa" },
  { term: "absinthe", pattern: /\babsinthe\b/i, parent: "spirits", subcategory: "Absinthe" },
  { term: "aquavit", pattern: /\baquavit\b/i, parent: "spirits", subcategory: "Aquavit" },
  { term: "cachaca", pattern: /\bcacha[cç]a\b/i, parent: "spirits", subcategory: "Cachaça" },
  { term: "pisco", pattern: /\bpisco\b/i, parent: "spirits", subcategory: "Pisco" },
  { term: "sotol", pattern: /\bsotol\b/i, parent: "spirits", subcategory: "Sotol" },
  { term: "raicilla", pattern: /\braicilla\b/i, parent: "spirits", subcategory: "Raicilla" },
  { term: "soju", pattern: /\bsoju\b/i, parent: "spirits", subcategory: "Soju" },
  { term: "sake", pattern: /\bsak[eé]\b/i, parent: "spirits", subcategory: "Sake" },
  { term: "amaro", pattern: /\bamaro\b/i, parent: "spirits", subcategory: "Amaro" },
  { term: "liqueur", pattern: /\bliqueur\b/i, parent: "spirits", subcategory: "Liqueur" },
  { term: "cordial", pattern: /\bcordial\b/i, parent: "spirits", subcategory: "Cordial" },
  { term: "cocktail", pattern: /\bcocktail\b/i, parent: "spirits", subcategory: "Ready-to-Drink Cocktail" },
  { term: "RTD", pattern: /\bRTD\b/, parent: "spirits", subcategory: "Ready-to-Drink" },
  { term: "margarita", pattern: /\bmargarita\b/i, parent: "spirits", subcategory: "Margarita" },
  // Producer terms that imply spirits
  { term: "distillery", pattern: /\bdistiller(?:y|ies|s)\b/i, parent: "spirits", subcategory: "Spirit" },
  { term: "distilled", pattern: /\bdistilled\b/i, parent: "spirits", subcategory: "Spirit" },
  { term: "proof", pattern: /\b\d+\s*proof\b/i, parent: "spirits", subcategory: "Spirit" },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CategoryInference {
  /** Inferred top-level category (beer/wine/spirits), or null if unable to determine */
  category: BeverageCategory | null;
  /** Specific subcategory name (e.g. "India Pale Ale", "Chardonnay", "Bourbon") */
  subcategory: string | null;
  /** 0-1 confidence in the inference */
  confidence: number;
  /** The OCR text fragment that triggered the match */
  matchedTerm: string | null;
}

/**
 * Infer beverage category from OCR-extracted fields and/or raw text.
 *
 * Checks (in priority order):
 *   1. classType field (most reliable — already parsed from label)
 *   2. varietal field (strong wine indicator)
 *   3. appellation field (wine indicator)
 *   4. ageStatement field (spirits indicator)
 *   5. Raw OCR text scan (fallback)
 */
export function inferCategory(
  fields: {
    classType?: string;
    varietal?: string;
    appellation?: string;
    ageStatement?: string;
    rawText?: string;
  },
): CategoryInference {
  const noResult: CategoryInference = { category: null, subcategory: null, confidence: 0, matchedTerm: null };

  // Priority 1: classType — highest confidence, already parsed
  if (fields.classType) {
    const result = matchText(fields.classType);
    if (result) return { ...result, confidence: 0.95 };
  }

  // Priority 2: varietal — strong wine indicator
  if (fields.varietal) {
    const result = matchText(fields.varietal);
    if (result) return { ...result, confidence: 0.9 };
  }

  // Priority 3: appellation — implies wine
  if (fields.appellation) {
    return { category: "wine", subcategory: "Wine", confidence: 0.85, matchedTerm: fields.appellation };
  }

  // Priority 4: age statement — strong spirits indicator
  if (fields.ageStatement) {
    return { category: "spirits", subcategory: "Aged Spirit", confidence: 0.8, matchedTerm: fields.ageStatement };
  }

  // Priority 5: raw text scan — lower confidence
  if (fields.rawText) {
    const result = matchText(fields.rawText);
    if (result) return { ...result, confidence: 0.7 };
  }

  return noResult;
}

/**
 * Verify that the inferred category matches the declared category.
 * Returns a structured result suitable for display in the FormVsLabelTable.
 */
export function verifyCategoryMatch(
  declared: BeverageCategory,
  inferred: CategoryInference,
): {
  match: boolean;
  verdict: "match" | "mismatch" | "unknown";
  message: string;
  severity: "success" | "error" | "info";
} {
  if (!inferred.category) {
    return {
      match: true,
      verdict: "unknown",
      message: "Unable to infer category from label text",
      severity: "info",
    };
  }

  if (inferred.category === declared) {
    const sub = inferred.subcategory ? ` (${inferred.subcategory})` : "";
    return {
      match: true,
      verdict: "match",
      message: `Label text "${inferred.matchedTerm}" confirms ${capitalize(declared)}${sub}`,
      severity: "success",
    };
  }

  // Mismatch
  return {
    match: false,
    verdict: "mismatch",
    message: `Category mismatch: submitted as "${capitalize(declared)}" but label contains "${inferred.matchedTerm}" which indicates ${capitalize(inferred.category)} (${inferred.subcategory})`,
    severity: "error",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchText(text: string): Omit<CategoryInference, "confidence"> | null {
  for (const entry of SUBCATEGORY_MAP) {
    const m = text.match(entry.pattern);
    if (m) {
      return {
        category: entry.parent,
        subcategory: entry.subcategory,
        matchedTerm: m[0],
      };
    }
  }
  return null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
