/**
 * OCR Field Extractors — modular field-specific extraction functions.
 * 
 * Each function handles extraction for a single field type, making the code
 * easier to test, maintain, and improve. These are used by parseOcrText()
 * in ocr.ts to build the complete ExtractedFields object.
 */

import type { ExtractedFields } from "./ocr";
import { inferCategory } from "./categoryMatch";

// ---------------------------------------------------------------------------
// Helper Types
// ---------------------------------------------------------------------------

interface TextContext {
  /** Raw OCR text with newlines preserved */
  rawText: string;
  /** Normalized text (newlines to spaces, whitespace collapsed) */
  text: string;
  /** Individual lines (trimmed, empty lines removed) */
  lines: string[];
}

// ---------------------------------------------------------------------------
// Alcohol Content Extraction
// ---------------------------------------------------------------------------

/**
 * Extract alcohol content from OCR text.
 * 
 * Handles multiple formats and common OCR errors:
 * - Standard: "5% Alc. By Vol.", "Alcohol 5% by volume"
 * - OCR misreads: V to N ("ALC. NOL."), / to I ("ALCIVOL")
 * - Proof format: "(80 PROOF)", "92 Proof"
 * 
 * @param ctx - Text context with raw, normalized, and line-split versions
 * @returns Partial ExtractedFields with alcoholContent if found
 */
export function extractAlcoholContent(ctx: TextContext): Partial<ExtractedFields> {
  const { text } = ctx;
  
  const abvPatterns = [
    /alcohol\s*(?:\(alc\))?\s+(\d+\.?\d*)\s*%\s*by\s+vol(?:ume)?/i,
    /alcohol\s+by\s+volume:\s*(\d+\.?\d*)\s*%/i,
    /(\d+\.?\d*)\s*%\s*alc\.?\s*by\s*vol\.?/i,
    /(\d+\.?\d*)\s*%\s*alc\.?\s*\/\s*vol\.?/i,
    /(\d+\.?\d*)\s*%\s*alc\.?\s*[i1l]\s*vol\.?/i,
    /(\d+\.?\d*)\s*%\s*alc\.?\s*[./]?\s*n[o0]l\.?/i,
    /alc[.,]?\s*(\d+\.?\d*)\s*%\s*by\s*vol\.?/i,
    /alc\.?\s*\/\s*vol\.?\s*(\d+\.?\d*)\s*%/i,
    /alc\.?\s*[./]?\s*n[o0]l\.?\s*(\d+\.?\d*)\s*%/i,
    /alc\.?\s*[i1l]\s*vol\.?\s*(\d+\.?\d*)\s*%/i,
    /(\d+\.?\d*)\s*%\s*alcohol\s*(?:\(alc\))?\s*(?:by\s+vol(?:ume)?|\/\s*vol(?:ume)?)/i,
    /\(?(\d+)\s*proof\)?/i,
    /(\d+\.?\d*)\s*%\s*alc/i,
    /alc[.,]?\s*(\d+\.?\d*)\s*%/i,
  ];
  
  for (const pat of abvPatterns) {
    const m = text.match(pat);
    if (m) {
      return { alcoholContent: m[0].trim() };
    }
  }
  
  return {};
}

// ---------------------------------------------------------------------------
// Net Contents Extraction
// ---------------------------------------------------------------------------

/**
 * Extract net contents from OCR text.
 * 
 * Handles compound formats ("1 PINT, 8.9 FL. OZ.") and single units with
 * OCR error tolerance (O to 0, I to 1, missing spaces, m| misread).
 * 
 * IMPORTANT: Uses bare l (not l with word boundary) in regex - this is intentional!
 * Changing to word boundary causes -20 image regression. See SPECIAL_CASES.md.
 * 
 * @param ctx - Text context
 * @returns Partial ExtractedFields with netContents if found
 */
export function extractNetContents(ctx: TextContext): Partial<ExtractedFields> {
  const { text } = ctx;
  
  const compoundNet = text.match(/(\d+\.?\d*)\s*(pints?|pt\.?|quarts?|qt\.?)\s*[,.]?\s*(\d+\.?\d*)\s*(fl\.?\s*oz\.?)/i);
  if (compoundNet) {
    return { netContents: compoundNet[0].trim() };
  }
  
  // Word-form + parenthetical: ONE PINT(16 FL OZ), ONE PINT (16 FL. OZ.)
  const wordFormNet = text.match(/(?:one|two|three|four|five|six)\s+(?:pints?|quarts?|gallons?|liters?)\s*\(?\s*\d+\.?\d*\s*fl\.?\s*[o0]z\.?\s*\)?/i);
  if (wordFormNet) {
    return { netContents: wordFormNet[0].trim() };
  }

  const netMatch = text.match(
    /(\d+\.?\d*)\s*[-~]?\s*(ml|m[|l]|l|fl\.?\s*[o0]z\.?|fluid\s+[o0]z\.?|liters?|milliliters?|cl|pints?|pt\.?|quarts?|qt\.?|gallons?|gal\.?|[o0]z\.?|ounces?)/i,
  );
  if (netMatch) {
    return { netContents: netMatch[0].trim() };
  }
  
  return {};
}

// ---------------------------------------------------------------------------
// Health Warning Extraction
// ---------------------------------------------------------------------------

/**
 * Extract government health warning from OCR text.
 * 
 * Uses multiple fallback strategies for fragmented or partial OCR:
 * 1. Primary: "GOVERNMENT WARNING" (with OCR error tolerance)
 * 2. Fallback 1: "SURGEON GENERAL" without prefix
 * 3. Fallback 2: "ACCORDING TO THE" + "BIRTH DEFECTS" (fragmented)
 * 4. Fallback 3: "WOMEN SHOULD NOT DRINK" (body text only)
 * 5. Fallback 4: "CONSUMPTION OF ALCOHOLIC" (second statement)
 * 
 * @param ctx - Text context
 * @returns Partial ExtractedFields with healthWarning if found
 */
export function extractHealthWarning(ctx: TextContext): Partial<ExtractedFields> {
  const { text } = ctx;
  
  const truncateWarning = (raw: string): string => {
    const endMatch = raw.match(/health\s+problems[\s.!;,)]*(?:\b|$)/i);
    if (endMatch && endMatch.index !== undefined) {
      return raw.slice(0, endMatch.index + endMatch[0].length).trim();
    }
    return raw.trim();
  };
  
  if (/govern[mn]en[ti]?\s+warnin[g6]/i.test(text)) {
    const gwStart = text.search(/govern[mn]en[ti]?\s+warnin[g6]/i);
    return { healthWarning: truncateWarning(text.slice(gwStart, gwStart + 500)) };
  }
  
  if (/surgeon\s+general/i.test(text)) {
    const sgStart = text.search(/surgeon\s+general/i);
    const start = Math.max(0, sgStart - 40);
    return { healthWarning: truncateWarning(text.slice(start, sgStart + 500)) };
  }
  
  if (/according\s+to\s+the/i.test(text) && /birth\s+defects/i.test(text)) {
    const atStart = text.search(/according\s+to\s+the/i);
    return { healthWarning: truncateWarning(text.slice(Math.max(0, atStart - 30), atStart + 500)) };
  }
  
  if (/women\s+should\s+not\s+drink/i.test(text)) {
    const wStart = text.search(/women\s+should\s+not\s+drink/i);
    const start = Math.max(0, wStart - 50);
    return { healthWarning: truncateWarning(text.slice(start, wStart + 500)) };
  }
  
  if (/consumption\s+of\s+alcoholic/i.test(text)) {
    const cStart = text.search(/consumption\s+of\s+alcoholic/i);
    const start = Math.max(0, cStart - 80);
    return { healthWarning: truncateWarning(text.slice(start, cStart + 500)) };
  }
  
  return {};
}

// ---------------------------------------------------------------------------
// Sulfite Declaration Extraction
// ---------------------------------------------------------------------------

/**
 * Extract sulfite declaration from OCR text.
 * 
 * @param ctx - Text context
 * @returns Partial ExtractedFields with sulfiteDeclaration if found
 */
export function extractSulfiteDeclaration(ctx: TextContext): Partial<ExtractedFields> {
  const { text } = ctx;
  
  if (/contains?\s+sulfites?/i.test(text)) {
    return { sulfiteDeclaration: "Contains Sulfites" };
  }
  
  return {};
}

// ---------------------------------------------------------------------------
// Brand Name Extraction
// ---------------------------------------------------------------------------

/**
 * Extract brand name from OCR text.
 * 
 * Uses multiple strategies:
 * 1. Pattern match (brewery, winery, distillery, etc.)
 * 2. First prominent all-caps line
 * 3. First short prominent line (with noise filtering)
 * 4. Extract from product-name lines (requires classType)
 * 5. Extract from URL
 * 
 * @param ctx - Text context
 * @param classType - Optional class type to help with brand extraction
 * @returns Partial ExtractedFields with brandName if found
 */
export function extractBrandName(ctx: TextContext, classType?: string): Partial<ExtractedFields> {
  const { text, lines } = ctx;
  
  const brandPatterns = [
    /(\w[\w\s&']+(?:brew(?:ery|ing)|winer(?:y|ies)|distiller(?:y|ies)|cellars?|vineyards?|estate))/i,
  ];
  
  for (const pat of brandPatterns) {
    const m = text.match(pat);
    if (m) {
      return { brandName: m[1].trim() };
    }
  }
  
  for (const line of lines.slice(0, 8)) {
    if (line.length >= 3 && line.length <= 60 && /^[A-Z][A-Z\s&'.]+$/.test(line)) {
      if (/^tasting\s+notes/i.test(line)) continue;
      if (/^artwork\s+by/i.test(line)) continue;
      if (/^brewed|^distilled|^produced|^imported|^bottled|^crafted|^fermented|^canned/i.test(line)) continue;
      if (/^ingredients?[:\s]/i.test(line)) continue;
      if (/^nutrition\s+facts/i.test(line)) continue;
      return { brandName: line };
    }
  }
  
  for (const line of lines.slice(0, 8)) {
    if (line.length < 3 || line.length > 40) continue;
    if (/government\s+warning/i.test(line)) continue;
    if (/contains?\s+sulfites?/i.test(line)) continue;
    if (/^\d/.test(line)) continue;
    if (/alc|vol|proof|oz|ml|fl\b/i.test(line)) continue;
    if (/\b(front|back)\s+label\b/i.test(line)) continue;
    if (/^\d+["″']\s*x\s*\d/i.test(line)) continue;
    if (/serving/i.test(line)) continue;
    if (/bottled\s+by|distilled|produced|imported|distributed|canned\s+by/i.test(line)) continue;
    if (/[=\[\]~|{}@#$^*<>]/.test(line)) continue;
    if (/calories|carbohydrate|protein|fat:/i.test(line)) continue;
    if (/^tasting\s+notes/i.test(line)) continue;
    if (/^artwork\s+by/i.test(line)) continue;
    if (/^brewed|^crafted|^fermented/i.test(line)) continue;
    if (/^ingredients?[:\s]/i.test(line)) continue;
    if (/^nutrition\s+facts/i.test(line)) continue;
    if (/^www\.|^@|^http/i.test(line)) continue;
    // Skip lines that are mostly punctuation/symbols/noise
    if (line.replace(/[^a-zA-Z]/g, "").length < line.length * 0.4) continue;
    return { brandName: line };
  }
  
  if (classType) {
    const classLower = classType.toLowerCase();
    for (const line of lines) {
      const lineLower = line.toLowerCase();
      const classIdx = lineLower.indexOf(classLower);
      if (classIdx > 0) {
        const before = line.slice(0, classIdx).trim();
        if (before.length >= 2 && before.length <= 40 && !/\d/.test(before)) {
          return { brandName: before };
        }
      }
    }
  }
  
  const urlMatch = text.match(/\b([A-Za-z][A-Za-z]+)\.com\b/i);
  if (urlMatch) {
    return { brandName: urlMatch[1].toUpperCase() };
  }
  
  return {};
}

// ---------------------------------------------------------------------------
// Class Type Extraction
// ---------------------------------------------------------------------------

/**
 * Extract class/type designation from OCR text.
 * 
 * Handles beer, wine, and spirits types with extensive pattern matching.
 * 
 * @param ctx - Text context
 * @returns Partial ExtractedFields with classType if found
 */
export function extractClassType(ctx: TextContext): Partial<ExtractedFields> {
  const { text } = ctx;
  
  const classPatterns = [
    // Varietal + percentage (wine)
    /\b(\d+%\s+(?:cabernet\s+sauvignon|chardonnay|merlot|pinot\s+noir|pinot\s+grigio|pinot\s+gris|pinot\s+blanc|riesling|sauvignon\s+blanc|zinfandel|malbec|syrah|shiraz|tempranillo|sangiovese|grenache|viognier|chenin\s+blanc|semillon|muscat|moscato|corn\s+neutral\s+spirits|grain\s+neutral\s+spirits))\b/i,
    // Spirits compound (RTD, seltzer, soda)
    /\b(tequila\s+seltzer|tequila\s+with\s+[\w\s]+|vodka\s+soda|ranch\s+water|irish\s+cream)\b/i,
    // Malt beverages
    /\b(ale\s+with\s+[\w\s]+flavor|malt\s+beverage|flavored\s+malt\s+beverage|malt\s+liquor|hard\s+seltzer|hard\s+cider|hard\s+lemonade|wine\s+cooler)\b/i,
    // Neutral spirits
    /\b(neutral\s+spirits|corn\s+neutral\s+spirits|grain\s+neutral\s+spirits)\b/i,
    // IPA variants (before generic IPA/pale ale)
    /\b(double\s+india\s+pale\s+ale|hazy\s+(?:double\s+)?(?:india\s+)?pale\s+ale|black\s+(?:india\s+)?pale\s+ale|session\s+(?:india\s+)?pale\s+ale|new\s+england\s+(?:style\s+)?(?:india\s+)?pale\s+ale|(?:double|imperial)\s+IPA|DIPA)\b/i,
    // Stout variants (before generic stout)
    /\b(imperial\s+stout|milk\s+stout|oatmeal\s+stout)\b/i,
    // Beer styles
    /\b(pale\s+ale|india\s+pale\s+ale|IPA|vienna\s+lager|lager|stout|porter|pilsner|pils|wheat\s+(?:beer|ale)|amber\s+ale|brown\s+ale|red\s+ale|golden\s+ale|old\s+ale|mild\s+ale|blonde\s+ale|cream\s+ale|hefeweizen|saison|sour\s+ale|(?:fruited\s+)?sour|fruit\s+(?:beer|ale)|kolsch|kölsch|bock|doppelbock|dunkel|marzen|märzen|witbier|berliner\s+weisse?|gose|barleywine|scotch\s+ale|strong\s+ale|farmhouse\s+ale|wild\s+ale|belgian\s+(?:strong|pale|dark|dubbel|tripel|quad)|tripel|dubbel|quadrupel|lambic|gu?euze|schwarzbier|altbier|rauchbier|ESB|shandy)\b/i,
    // Wine types
    /\b(red\s+wine|white\s+wine|rosé|rose\s+wine|sparkling\s+wine|champagne|table\s+wine|dessert\s+wine|fortified\s+wine|ice\s*wine|natural\s+wine|late\s+harvest|blanc\s+de\s+blancs|blanc\s+de\s+noirs|port|sherry|vermouth|mead|cava|prosecco)\b/i,
    // Wine varietals
    /\b(cabernet\s+sauvignon|cabernet\s+franc|chardonnay|merlot|pinot\s+noir|pinot\s+grigio|pinot\s+gris|pinot\s+blanc|riesling|sauvignon\s+blanc|zinfandel|malbec|syrah|shiraz|petite?\s+si?rah|petit\s+verdot|tempranillo|sangiovese|nebbiolo|barbera|dolcetto|montepulciano|grenache|mourv[eè]dre|viognier|gew[uü]rztraminer|chenin\s+blanc|semillon|muscat|moscato|gr[uü]ner\s+veltliner|alba(?:ri[nñ]o|rinho)|torront[eé]s|gamay|carm[eé]n[eè]re|marsanne|roussanne)\b/i,
    // Spirits compound whiskey
    /\b(straight\s+(?:bourbon|rye)\s+whiskey|single\s+(?:barrel|malt)\s+(?:whiskey|whisky|scotch)|small\s+batch\s+(?:bourbon|whiskey)|tennessee\s+whiskey)\b/i,
    // Core spirits
    /\b(blended\s+whiskey|bourbon|scotch|vodka|rum|gin|genever|tequila|brandy|cognac|armagnac|calvados|mezcal|absinthe|whisky|whiskey|rye\s+whiskey|agave\s+spirits?|sotol|raicilla|pisco|grappa|aquavit|cachaca|cachaça|soju|baijiu|amaro|aperitif|digestif|liqueur|cordial|schnapps|moonshine|ready\s+to\s+drink|cocktail|sake|saki|margarita)\b/i,
  ];
  
  for (const pat of classPatterns) {
    const m = text.match(pat);
    if (m) {
      return { classType: m[0].trim() };
    }
  }
  
  return {};
}

// ---------------------------------------------------------------------------
// Name & Address Extraction
// ---------------------------------------------------------------------------

/**
 * Extract name and address from OCR text.
 * 
 * Uses multiple strategies:
 * 1. Match on joined text with producer prefixes
 * 2. Multi-line scan (prefix on one line, address on next)
 * 3. Post-correct OCR merge errors (NAPACA to NAPA, CA)
 * 4. Fallback: find City, STATE ZIPCODE and grab context
 * 
 * @param ctx - Text context
 * @returns Partial ExtractedFields with nameAddress if found
 */
export function extractNameAddress(ctx: TextContext): Partial<ExtractedFields> {
  const { text, lines } = ctx;
  
  const NA_PREFIX = /(?:imported|bottled?|bo[ti]+led|produced|distributed|blended|distilled?|disti[li]+ed|brewed|made|packed|canned|vinted|cellared|crafted|fermented|estate\s+bottled|grown|selected|aged)\s*(?:&|and)?\s*(?:bottled?|bo[ti]+led|produced|distributed|blended|distilled?|disti[li]+ed|brewed|canned|packaged|crafted)?\s+(?:by|for|in|at|and\s+(?:canned|bottled|packaged))(?:\s|$)/i;
  
  const naPatterns = [
    new RegExp(`(${NA_PREFIX.source}[^.]+?,\\s*[A-Z]{2}\\s*\\d{5})`, "i"),
    new RegExp(`(${NA_PREFIX.source}[^.]+?,\\s*[A-Z]{2})\\b`, "i"),
  ];
  
  for (const pat of naPatterns) {
    const m = text.match(pat);
    if (m) {
      return { nameAddress: m[1].trim() };
    }
  }
  
  for (let i = 0; i < lines.length; i++) {
    if (NA_PREFIX.test(lines[i])) {
      let combined = lines[i];
      for (let j = 1; j <= 2 && i + j < lines.length; j++) {
        combined += " " + lines[i + j];
      }
      const m = combined.match(new RegExp(`(${NA_PREFIX.source}.+?,\\s*[A-Z]{2}(?:\\s*\\d{5})?)`, "i"));
      if (m) {
        let nameAddress = m[1].trim();
        const US_STATES = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)$/;
        nameAddress = nameAddress.replace(
          /([A-Za-z]{3,})([A-Z]{2})\s*(-\s*USA|[+]\s*USA)?\s*$/,
          (_match, city, st, usa) => {
            if (US_STATES.test(st)) {
              return `${city}, ${st}${usa ? " USA" : ""}`;
            }
            return _match;
          },
        );
        return { nameAddress };
      }
      return { nameAddress: combined.slice(0, 120).trim() };
    }
  }
  
  const addressMatch = text.match(/[\w\s]+,\s*[A-Z]{2}\s*\d{5}/);
  if (addressMatch) {
    const idx = text.indexOf(addressMatch[0]);
    const start = Math.max(0, idx - 80);
    let grabbed = text.slice(start, idx + addressMatch[0].length).trim();
    const importerStart = grabbed.search(NA_PREFIX);
    if (importerStart > 0) {
      grabbed = grabbed.slice(importerStart).trim();
    } else {
      const cleanStart = grabbed.search(/[A-Z][\w\s&',.-]+,\s*[A-Z]{2}/);
      if (cleanStart > 0) grabbed = grabbed.slice(cleanStart).trim();
    }
    return { nameAddress: grabbed };
  }
  
  const cityStateMatch = text.match(/([\w\s]+,\s*[A-Z]{2})\b/);
  if (cityStateMatch) {
    const idx = text.indexOf(cityStateMatch[0]);
    const start = Math.max(0, idx - 80);
    let grabbed = text.slice(start, idx + cityStateMatch[0].length).trim();
    const importerStart = grabbed.search(NA_PREFIX);
    if (importerStart > 0) grabbed = grabbed.slice(importerStart).trim();
    return { nameAddress: grabbed };
  }
  
  return {};
}

// ---------------------------------------------------------------------------
// Simple Field Extractors
// ---------------------------------------------------------------------------

export function extractVarietal(ctx: TextContext): Partial<ExtractedFields> {
  const { text } = ctx;
  const varietalPatterns = /\b(cabernet\s+sauvignon|cabernet\s+franc|chardonnay|merlot|pinot\s+noir|pinot\s+grigio|pinot\s+gris|pinot\s+blanc|riesling|sauvignon\s+blanc|zinfandel|malbec|syrah|shiraz|petite?\s+si?rah|petit\s+verdot|tempranillo|sangiovese|nebbiolo|barbera|dolcetto|montepulciano|grenache|mourv[eè]dre|viognier|gew[uü]rztraminer|chenin\s+blanc|semillon|muscat|moscato|gr[uü]ner\s+veltliner|alba(?:ri[nñ]o|rinho)|torront[eé]s|gamay|carm[eé]n[eè]re|marsanne|roussanne)\b/i;
  const varietalMatch = text.match(varietalPatterns);
  if (varietalMatch) {
    return { varietal: varietalMatch[0].trim() };
  }
  return {};
}

export function extractVintageDate(ctx: TextContext): Partial<ExtractedFields> {
  const { text } = ctx;
  const vintageMatch = text.match(/\b(19|20)\d{2}\b/);
  if (vintageMatch) {
    const yr = parseInt(vintageMatch[0]);
    if (yr >= 1950 && yr <= new Date().getFullYear()) {
      return { vintageDate: vintageMatch[0] };
    }
  }
  return {};
}

export function extractCountryOfOrigin(ctx: TextContext): Partial<ExtractedFields> {
  const { text } = ctx;
  const countryPatterns = [
    /\b(product\s+of\s+[\w\s]+)/i,
    /\b(imported\s+(?:from|by)\s+[\w\s]+)/i,
    /\b(made\s+in\s+[\w\s]+)/i,
    /\b(hecho\s+en\s+[\w\s]+)/i,
    /\b(producto\s+de\s+[\w\s]+)/i,
    /\b(product\s+of\s+the\s+usa)/i,
    /\b(produced\s+in\s+[\w\s]+)/i,
  ];
  for (const pat of countryPatterns) {
    const m = text.match(pat);
    if (m) {
      return { countryOfOrigin: m[0].trim() };
    }
  }
  return {};
}

export function extractAgeStatement(ctx: TextContext): Partial<ExtractedFields> {
  const { text } = ctx;
  const agePatterns = [
    /\b(aged\s+(?:a\s+minimum\s+of\s+)?(\d+)\s+years?)\b/i,
    /\b((\d+)\s+years?\s+old)\b/i,
    /\b((\d+)\s*-?\s*yr\.?\s*old)\b/i,
  ];
  for (const pat of agePatterns) {
    const m = text.match(pat);
    if (m) {
      return { ageStatement: m[0].trim() };
    }
  }
  return {};
}

export function extractAppellation(ctx: TextContext): Partial<ExtractedFields> {
  const { text } = ctx;
  const appellationPatterns = [
    /\b(napa\s+valley|sonoma\s+(?:county|coast|valley)|paso\s+robles|russian\s+river\s+valley|willamette\s+valley|columbia\s+valley|walla\s+walla\s+valley|finger\s+lakes|long\s+island|central\s+coast|santa\s+barbara\s+county|monterey\s+county|mendocino\s+county|lodi|alexander\s+valley|dry\s+creek\s+valley|anderson\s+valley|carneros|los\s+carneros|stags\s+leap|oakville|rutherford|st\.?\s*helena|calistoga)\b/i,
    /\b(bordeaux|burgundy|champagne|côtes?\s+du\s+rhône|loire\s+valley|alsace|languedoc|provence|rioja|ribera\s+del\s+duero|chianti|barolo|barbaresco|prosecco|valpolicella|mosel|rheingau|marlborough|barossa\s+valley|mclaren\s+vale|margaret\s+river|hunter\s+valley|stellenbosch|mendoza|maipo\s+valley|casablanca\s+valley)\b/i,
  ];
  for (const pat of appellationPatterns) {
    const m = text.match(pat);
    if (m) {
      return { appellation: m[0].trim() };
    }
  }
  return {};
}

// ---------------------------------------------------------------------------
// Category Inference
// ---------------------------------------------------------------------------

export function inferCategoryFromFields(fields: Partial<ExtractedFields>): Partial<ExtractedFields> {
  const catResult = inferCategory({
    classType: fields.classType,
    varietal: fields.varietal,
    appellation: fields.appellation,
    ageStatement: fields.ageStatement,
    rawText: fields.rawText,
  });
  
  if (catResult.category) {
    return {
      detectedCategory: catResult.category,
      detectedSubcategory: catResult.subcategory ?? undefined,
    };
  }
  
  return {};
}
