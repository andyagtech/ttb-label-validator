/**
 * Parse raw Tesseract outputs through our parseOcrText heuristic parser
 * and compare to vision model ground truth.
 */
import { readFileSync } from "fs";

// ---------------------------------------------------------------------------
// Inline copy of parseOcrText (from ocr.ts) — adapted for Node.js
// ---------------------------------------------------------------------------
function parseOcrText(rawText) {
  const fields = { rawText };
  const text = rawText.replace(/\n/g, " ").replace(/\s+/g, " ");
  const lines = rawText.split(/\n/).map(l => l.trim()).filter(Boolean);

  // --- Alcohol content ---
  const abvPatterns = [
    /alcohol\s*(?:\(alc\))?\s+(\d+\.?\d*)\s*%\s*by\s+vol(?:ume)?/i,
    /alcohol\s+by\s+volume:\s*(\d+\.?\d*)\s*%/i,
    /(\d+\.?\d*)\s*%\s*alc\.?\s*by\s*vol\.?/i,
    /(\d+\.?\d*)\s*%\s*alc\.?\s*\/\s*vol\.?/i,
    /alc[.,]?\s*(\d+\.?\d*)\s*%\s*by\s*vol\.?/i,
    /alc\.?\s*\/\s*vol\.?\s*(\d+\.?\d*)\s*%/i,
    /(\d+\.?\d*)\s*%\s*alcohol\s*(?:\(alc\))?\s*(?:by\s+vol(?:ume)?|\/\s*vol(?:ume)?)/i,
    /(\d+\.?\d*)\s*%\s*alc/i,
    /alc[.,]?\s*(\d+\.?\d*)\s*%/i,
  ];
  for (const pat of abvPatterns) {
    const m = text.match(pat);
    if (m) { fields.alcoholContent = m[0].trim(); break; }
  }

  // --- Net contents ---
  const compoundNet = text.match(/(\d+\.?\d*)\s*(pints?|pt\.?|quarts?|qt\.?)\s*[,.]?\s*(\d+\.?\d*)\s*(fl\.?\s*oz\.?)/i);
  if (compoundNet) {
    fields.netContents = compoundNet[0].trim();
  } else {
    const netMatch = text.match(/(\d+\.?\d*)\s*(ml|l|fl\.?\s*oz\.?|fluid\s+oz\.?|liters?|milliliters?|cl|pints?|pt\.?|quarts?|qt\.?|gallons?|gal\.?)/i);
    if (netMatch) fields.netContents = netMatch[0].trim();
  }

  // --- Government warning ---
  if (/government\s+warning/i.test(text)) {
    const gwStart = text.search(/government\s+warning/i);
    fields.healthWarning = text.slice(gwStart, gwStart + 500).trim();
  }

  // --- Contains Sulfites ---
  if (/contains?\s+sulfites?/i.test(text)) {
    fields.sulfiteDeclaration = "Contains Sulfites";
  }

  // --- Brand name ---
  const brandPatterns = [
    /(\w[\w\s&']+(?:brew(?:ery|ing)|winer(?:y|ies)|distiller(?:y|ies)|cellars?|vineyards?|estate))/i,
  ];
  for (const pat of brandPatterns) {
    const m = text.match(pat);
    if (m) { fields.brandName = m[1].trim(); break; }
  }
  if (!fields.brandName) {
    for (const line of lines.slice(0, 8)) {
      if (line.length >= 3 && line.length <= 60 && /^[A-Z][A-Z\s&'.]+$/.test(line)) {
        fields.brandName = line; break;
      }
    }
  }
  if (!fields.brandName) {
    for (const line of lines.slice(0, 8)) {
      if (line.length < 3 || line.length > 40) continue;
      if (/government\s+warning/i.test(line)) continue;
      if (/contains?\s+sulfites?/i.test(line)) continue;
      if (/^\d/.test(line)) continue;
      if (/alc|vol|proof|oz|ml|fl\b/i.test(line)) continue;
      if (/\b(front|back)\s+label\b/i.test(line)) continue;
      if (/^\d+["\u2033']\s*x\s*\d/i.test(line)) continue;
      if (/serving/i.test(line)) continue;
      if (/bottled\s+by|distilled|produced|imported|distributed|canned\s+by/i.test(line)) continue;
      if (/[=\[\]~|{}@#$^*<>]/.test(line)) continue;
      if (/calories|carbohydrate|protein|fat:/i.test(line)) continue;
      fields.brandName = line; break;
    }
  }

  // --- Class / type ---
  // (compound types first so "tequila seltzer" beats "tequila")
  const classPatterns = [
    /\b(\d+%\s+(?:cabernet\s+sauvignon|chardonnay|merlot|pinot\s+noir|pinot\s+grigio|riesling|sauvignon\s+blanc|zinfandel|malbec|syrah|shiraz|tempranillo|sangiovese|grenache|viognier|chenin\s+blanc|semillon|muscat|moscato|corn\s+neutral\s+spirits|grain\s+neutral\s+spirits))\b/i,
    /\b(tequila\s+seltzer|tequila\s+with\s+[\w\s]+|vodka\s+soda|ranch\s+water)\b/i,
    /\b(ale\s+with\s+[\w\s]+flavor|malt\s+beverage|flavored\s+malt\s+beverage|hard\s+seltzer|hard\s+cider|hard\s+lemonade|wine\s+cooler)\b/i,
    /\b(neutral\s+spirits|corn\s+neutral\s+spirits|grain\s+neutral\s+spirits)\b/i,
    /\b(pale\s+ale|india\s+pale\s+ale|IPA|lager|stout|porter|pilsner|wheat\s+beer|amber\s+ale|brown\s+ale|hefeweizen|saison|sour\s+ale|blonde\s+ale|cream\s+ale|kolsch|bock|doppelbock)\b/i,
    /\b(red\s+wine|white\s+wine|rosé|sparkling\s+wine|champagne|table\s+wine|dessert\s+wine|fortified\s+wine|port|sherry|vermouth)\b/i,
    /\b(cabernet\s+sauvignon|chardonnay|merlot|pinot\s+noir|pinot\s+grigio|riesling|sauvignon\s+blanc|zinfandel|malbec|syrah|shiraz)\b/i,
    /\b(blended\s+whiskey|bourbon|scotch|vodka|rum|gin|tequila|brandy|cognac|mezcal|absinthe|whisky|rye\s+whiskey)\b/i,
  ];
  for (const pat of classPatterns) {
    const m = text.match(pat);
    if (m) { fields.classType = m[0].trim(); break; }
  }

  // Brand fallback 3: extract brand from product-name lines
  if (!fields.brandName && fields.classType) {
    const classLower = fields.classType.toLowerCase();
    for (const line of lines) {
      const lineLower = line.toLowerCase();
      const classIdx = lineLower.indexOf(classLower);
      if (classIdx > 0) {
        const before = line.slice(0, classIdx).trim();
        if (before.length >= 2 && before.length <= 40 && !/\d/.test(before)) {
          fields.brandName = before; break;
        }
      }
    }
  }
  // Brand fallback 4: extract brand from URL
  if (!fields.brandName) {
    const urlMatch = text.match(/\b([A-Za-z][A-Za-z]+)\.com\b/i);
    if (urlMatch) { fields.brandName = urlMatch[1].toUpperCase(); }
  }

  // --- Name & address ---
  const NA_PREFIX = /(?:imported|bottled|produced\s*&?\s*bottled|produced|distributed|blended\s*&?\s*bottled|distilled\s*&?\s*bottled|distilled|brewed|made|packed|canned|vinted|cellared)\s+(?:by|for|in)(?:\s|$)/i;
  const naPatterns = [
    new RegExp(`(${NA_PREFIX.source}[^.]+?,\\s*[A-Z]{2}\\s*\\d{5})`, "i"),
    new RegExp(`(${NA_PREFIX.source}[^.]+?,\\s*[A-Z]{2})\\b`, "i"),
  ];
  for (const pat of naPatterns) {
    const m = text.match(pat);
    if (m) { fields.nameAddress = m[1].trim(); break; }
  }
  // Multi-line scan
  if (!fields.nameAddress) {
    for (let i = 0; i < lines.length; i++) {
      if (NA_PREFIX.test(lines[i])) {
        let combined = lines[i];
        for (let j = 1; j <= 2 && i + j < lines.length; j++) {
          combined += " " + lines[i + j];
        }
        const m = combined.match(new RegExp(`(${NA_PREFIX.source}.+?,\\s*[A-Z]{2}(?:\\s*\\d{5})?)`, "i"));
        if (m) { fields.nameAddress = m[1].trim(); break; }
        fields.nameAddress = combined.slice(0, 120).trim();
        break;
      }
    }
  }
  // Post-correct merged state codes (NAPACA → NAPA, CA)
  if (fields.nameAddress) {
    const US_STATES = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)$/;
    fields.nameAddress = fields.nameAddress.replace(
      /([A-Za-z]{3,})([A-Z]{2})\s*(-\s*USA|[+]\s*USA)?\s*$/,
      (_match, city, st, usa) => {
        if (US_STATES.test(st)) return `${city}, ${st}${usa ? " USA" : ""}`;
        return _match;
      },
    );
  }
  // Fallback: City, ST ZIP
  if (!fields.nameAddress) {
    const addressMatch = text.match(/[\w\s]+,\s*[A-Z]{2}\s*\d{5}/);
    if (addressMatch) {
      const idx = text.indexOf(addressMatch[0]);
      const start = Math.max(0, idx - 80);
      let grabbed = text.slice(start, idx + addressMatch[0].length).trim();
      const importerStart = grabbed.search(NA_PREFIX);
      if (importerStart > 0) grabbed = grabbed.slice(importerStart).trim();
      fields.nameAddress = grabbed;
    } else {
      const cityStateMatch = text.match(/([\w\s]+,\s*[A-Z]{2})\b/);
      if (cityStateMatch) {
        const idx = text.indexOf(cityStateMatch[0]);
        const start = Math.max(0, idx - 80);
        let grabbed = text.slice(start, idx + cityStateMatch[0].length).trim();
        const importerStart = grabbed.search(NA_PREFIX);
        if (importerStart > 0) grabbed = grabbed.slice(importerStart).trim();
        fields.nameAddress = grabbed;
      }
    }
  }

  // --- Varietal ---
  const varietalPatterns = /\b(cabernet\s+sauvignon|chardonnay|merlot|pinot\s+noir|pinot\s+grigio|riesling|sauvignon\s+blanc|zinfandel|malbec|syrah|shiraz|tempranillo|sangiovese|grenache|viognier|gewürztraminer|chenin\s+blanc|semillon|muscat|moscato)\b/i;
  const varietalMatch = text.match(varietalPatterns);
  if (varietalMatch) {
    fields.varietal = varietalMatch[0].trim();
    if (!fields.classType) fields.classType = fields.varietal;
  }

  // --- Vintage date ---
  const vintageMatch = text.match(/\b(19|20)\d{2}\b/);
  if (vintageMatch) {
    const yr = parseInt(vintageMatch[0]);
    if (yr >= 1950 && yr <= new Date().getFullYear()) fields.vintageDate = vintageMatch[0];
  }

  // --- Country of origin ---
  const countryPatterns = /\b(product\s+of\s+[\w\s]+|imported\s+(?:from|by)\s+[\w\s]+|made\s+in\s+[\w\s]+)/i;
  const countryMatch = text.match(countryPatterns);
  if (countryMatch) fields.countryOfOrigin = countryMatch[0].trim();

  // --- Age statement ---
  const agePatterns = [
    /\b(aged\s+(?:a\s+minimum\s+of\s+)?(\d+)\s+years?)\b/i,
    /\b((\d+)\s+years?\s+old)\b/i,
    /\b((\d+)\s*-?\s*yr\.?\s*old)\b/i,
  ];
  for (const pat of agePatterns) {
    const m = text.match(pat);
    if (m) { fields.ageStatement = m[0].trim(); break; }
  }

  // --- Appellation ---
  const appellationPatterns = [
    /\b(napa\s+valley|sonoma\s+(?:county|coast|valley)|paso\s+robles|russian\s+river\s+valley|willamette\s+valley|columbia\s+valley|walla\s+walla\s+valley|finger\s+lakes|long\s+island|central\s+coast|santa\s+barbara\s+county|monterey\s+county|mendocino\s+county|lodi|alexander\s+valley|dry\s+creek\s+valley|anderson\s+valley|carneros|los\s+carneros|stags\s+leap|oakville|rutherford|st\.?\s*helena|calistoga)\b/i,
    /\b(bordeaux|burgundy|champagne|côtes?\s+du\s+rhône|loire\s+valley|alsace|languedoc|provence|rioja|ribera\s+del\s+duero|chianti|barolo|barbaresco|prosecco|valpolicella|mosel|rheingau|marlborough|barossa\s+valley|mclaren\s+vale|margaret\s+river|hunter\s+valley|stellenbosch|mendoza|maipo\s+valley|casablanca\s+valley)\b/i,
  ];
  for (const pat of appellationPatterns) {
    const m = text.match(pat);
    if (m) { fields.appellation = m[0].trim(); break; }
  }

  return fields;
}

// ---------------------------------------------------------------------------
// Ground truth (what a vision model like Claude extracts from each image)
// ---------------------------------------------------------------------------
const GROUND_TRUTH = {
  "edge": {
    label: "The Edge — Pinot Noir (wine back, textured bg)",
    brandName: "The Edge",
    classType: "Pinot Noir",
    alcoholContent: "ALC. 13.5% by vol.",
    netContents: "750ML",
    healthWarning: "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL WOMAN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEM.",
    sulfiteDeclaration: "CONTAINS SULFITES",
    nameAddress: "BOTTLED BY JUDD'S HILL, NAPA CA",
    vintageDate: "2022",
    appellation: "Carneros, Napa Valley",
  },
  "barley": {
    label: "Barley & Boar — Gin (spirits back, light bg)",
    brandName: "BARLEY & BOAR",
    classType: "Gin / 100% Corn Neutral Spirits",
    alcoholContent: null,
    netContents: null,
    healthWarning: "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.",
    sulfiteDeclaration: null,
    nameAddress: "DISTILLED AND BOTTLED BY [BARLEY & BOAR], ATASCADERO, CA · USA",
    vintageDate: null,
    appellation: null,
  },
  "longhorn": {
    label: "Longhorn Cellars (wine back, INVERTED dark bg)",
    brandName: "LONGHORN CELLARS",
    classType: "100% Sangiovese",
    alcoholContent: null,
    netContents: "750 ML",
    healthWarning: "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.",
    sulfiteDeclaration: "CONTAINS SULFITES",
    nameAddress: "PRODUCED & BOTTLED BY LONGHORN CELLARS, LLC, FREDERICKSBURG, TEXAS",
    vintageDate: null,
    varietal: "Sangiovese",
  },
  "onda": {
    label: "Onda Tequila Seltzer (colorful wrap)",
    brandName: "ONDA",
    classType: "Tequila Seltzer",
    alcoholContent: "4.5% ALC/VOL",
    netContents: "12 FL OZ (355 ML)",
    healthWarning: "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES... (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.",
    sulfiteDeclaration: null,
    nameAddress: "CANNED BY QUE ONDA BEVERAGE. WAVERLY, NY.",
    vintageDate: null,
    appellation: null,
  },
};

// ---------------------------------------------------------------------------
// Parse and compare
// ---------------------------------------------------------------------------
const RAW_FILES = {
  "edge": "/tmp/ocr_edge.txt",
  "barley": "/tmp/ocr_barley.txt",
  "longhorn": "/tmp/ocr_longhorn.txt",
  "onda": "/tmp/ocr_onda.txt",
};

const PP_FILES = {
  "edge": "scripts/pp_out/edge_out.txt",
  "barley": "scripts/pp_out/barley_out.txt",
  "longhorn": "scripts/pp_out/longhorn_out.txt",
  "onda": "scripts/pp_out/onda_out.txt",
};

const FIELDS = [
  "brandName", "classType", "alcoholContent", "netContents",
  "healthWarning", "sulfiteDeclaration", "nameAddress",
  "vintageDate", "varietal", "appellation",
];

function scoreField(gtVal, tVal, field) {
  if (!tVal && !gtVal) return { score: null, label: "" }; // both empty, skip
  if (!tVal && gtVal) return { score: 0, label: "❌ MISS" };
  if (tVal && !gtVal) return { score: null, label: "➕ EXTRA" };
  // For ABV, normalize: extract just the numeric percentage for comparison
  if (field === "alcoholContent") {
    const gtNum = gtVal.match(/(\d+\.?\d*)\s*%/);
    const tNum = tVal.match(/(\d+\.?\d*)\s*%/);
    if (gtNum && tNum && gtNum[1] === tNum[1]) {
      return { score: 1, label: "✅ HIT" };
    }
  }
  const gtLower = gtVal.toLowerCase().slice(0, 40);
  const tLower = tVal.toLowerCase().slice(0, 40);
  if (tLower.includes(gtLower.slice(0, 15)) || gtLower.includes(tLower.slice(0, 15))) {
    return { score: 1, label: "✅ HIT" };
  }
  return { score: 0.5, label: "⚠️ PART" };
}

let totalFields = 0, rawHits = 0, ppHits = 0;

for (const key of Object.keys(GROUND_TRUTH)) {
  const gt = GROUND_TRUTH[key];
  const rawText = readFileSync(RAW_FILES[key], "utf-8");
  const ppText = readFileSync(PP_FILES[key], "utf-8");
  const rawParsed = parseOcrText(rawText);
  const ppParsed = parseOcrText(ppText);

  console.log(`\n${"═".repeat(90)}`);
  console.log(`  ${gt.label}`);
  console.log(`  Raw chars: ${rawText.length}  │  Preprocessed chars: ${ppText.length}`);
  console.log(`${"═".repeat(90)}`);
  console.log(`  ${"Field".padEnd(20)}│ ${"Vision Model".padEnd(28)}│ ${"Raw Tesseract".padEnd(28)}│ ${"Preprocessed".padEnd(28)}│ Raw  │ PP`);
  console.log(`  ${"─".repeat(20)}┼${"─".repeat(29)}┼${"─".repeat(29)}┼${"─".repeat(29)}┼──────┼─────`);

  for (const field of FIELDS) {
    const gtVal = gt[field] || null;
    const rawVal = rawParsed[field] || null;
    const ppVal = ppParsed[field] || null;
    if (!gtVal && !rawVal && !ppVal) continue;

    const rawScore = scoreField(gtVal, rawVal, field);
    const ppScore = scoreField(gtVal, ppVal, field);
    if (rawScore.score !== null) { totalFields++; rawHits += rawScore.score; }
    else if (ppScore.score !== null) { totalFields++; }
    if (ppScore.score !== null && rawScore.score === null) { ppHits += ppScore.score; }
    else if (ppScore.score !== null) { ppHits += ppScore.score; }

    const gtD = (gtVal || "—").slice(0, 27).padEnd(28);
    const rawD = (rawVal || "—").slice(0, 27).padEnd(28);
    const ppD = (ppVal || "—").slice(0, 27).padEnd(28);
    console.log(`  ${field.padEnd(20)}│ ${gtD}│ ${rawD}│ ${ppD}│ ${rawScore.label.padEnd(5)}│ ${ppScore.label}`);
  }
}

console.log(`\n${"═".repeat(90)}`);
console.log(`  OVERALL COMPARISON (${totalFields} ground-truth fields across 4 labels):`);
console.log(`  ─────────────────────────────────────────────────`);
console.log(`  Vision Model (Claude/Gemini):  ${totalFields}/${totalFields}  = 100%  (baseline)`);
console.log(`  Tesseract RAW (PSM 6):         ${rawHits}/${totalFields}  = ${((rawHits / totalFields) * 100).toFixed(0)}%`);
console.log(`  Tesseract PREPROCESSED:        ${ppHits}/${totalFields}  = ${((ppHits / totalFields) * 100).toFixed(0)}%`);
console.log(`  Improvement from preprocessing: +${(((ppHits - rawHits) / totalFields) * 100).toFixed(0)} percentage points`);
console.log(`${"═".repeat(90)}`);
