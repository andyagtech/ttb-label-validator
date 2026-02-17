#!/usr/bin/env node
/**
 * Benchmark Tesseract.js OCR performance across all TTB label images.
 *
 * For each label image:
 *   1. Preprocess with Sharp (grayscale, sharpen, upscale, pad)
 *   2. Run Tesseract.js OCR
 *   3. Parse extracted text with parseOcrText heuristics
 *   4. Compare against ground truth from TTB records + sampleData defaults
 *   5. Output markdown performance report
 *
 * Usage: node scripts/benchmark-ocr.mjs [--limit N] [--verbose]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import Tesseract from "tesseract.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.join(__dirname, "..");
const LABELS_DIR = path.join(PROJECT, "frontend", "public", "ttb-labels");
const RECORDS_FILE = path.join(PROJECT, "sample_labels", "ttb_cola_records.json");

const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : Infinity;

// ---------------------------------------------------------------------------
// parseOcrText — inline copy from ocr.ts (same as parse_ocr_outputs.mjs)
// ---------------------------------------------------------------------------
function parseOcrText(rawText) {
  const fields = {};
  const text = rawText.replace(/\n/g, " ").replace(/\s+/g, " ");
  const lines = rawText.split(/\n/).map(l => l.trim()).filter(Boolean);

  // --- Alcohol content ---
  const abvPatterns = [
    /alcohol\s*(?:\(alc\))?\s+(\d+\.?\d*)\s*%\s*by\s+vol(?:ume)?/i,
    /alcohol\s+by\s+volume:\s*(\d+\.?\d*)\s*%/i,
    /(\d+\.?\d*)\s*%\s*alc\.?\s*by\s*vol\.?/i,
    /(\d+\.?\d*)\s*%\s*alc\.?\s*\/\s*vol\.?/i,
    // OCR misread: "/" → "I" or "1": "5% ALCIVOL"
    /(\d+\.?\d*)\s*%\s*alc\.?\s*[i1l]\s*vol\.?/i,
    // OCR misread: "V" → "N": "5% ALC. NOL."
    /(\d+\.?\d*)\s*%\s*alc\.?\s*[./]?\s*n[o0]l\.?/i,
    /alc[.,]?\s*(\d+\.?\d*)\s*%\s*by\s*vol\.?/i,
    /alc\.?\s*\/\s*vol\.?\s*(\d+\.?\d*)\s*%/i,
    // OCR misread reversed: "ALC. NOL. 5%" / "ALCIVOL 5%"
    /alc\.?\s*[./]?\s*n[o0]l\.?\s*(\d+\.?\d*)\s*%/i,
    /alc\.?\s*[i1l]\s*vol\.?\s*(\d+\.?\d*)\s*%/i,
    /(\d+\.?\d*)\s*%\s*alcohol\s*(?:\(alc\))?\s*(?:by\s+vol(?:ume)?|\/\s*vol(?:ume)?)/i,
    // Proof-based: "(80 PROOF)" / "80 Proof"
    /\(?(\d+)\s*proof\)?/i,
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
    const netMatch = text.match(/(\d+\.?\d*)\s*(ml|l|fl\.?\s*oz\.?|fluid\s+oz\.?|liters?|milliliters?|cl|pints?|pt\.?|quarts?|qt\.?|gallons?|gal\.?|oz\.?)/i);
    if (netMatch) fields.netContents = netMatch[0].trim();
  }

  // --- Government warning ---
  if (/government\s+warning/i.test(text)) {
    const gwStart = text.search(/government\s+warning/i);
    fields.healthWarning = text.slice(gwStart, gwStart + 500).trim();
  }
  // Fallback: "SURGEON GENERAL" without "GOVERNMENT WARNING" prefix
  if (!fields.healthWarning && /surgeon\s+general/i.test(text)) {
    const sgStart = text.search(/surgeon\s+general/i);
    const start = Math.max(0, sgStart - 40);
    fields.healthWarning = text.slice(start, sgStart + 500).trim();
  }
  // Fallback 2: "ACCORDING TO THE" + "BIRTH DEFECTS" — fragmented OCR
  if (!fields.healthWarning && /according\s+to\s+the/i.test(text) && /birth\s+defects/i.test(text)) {
    const atStart = text.search(/according\s+to\s+the/i);
    fields.healthWarning = text.slice(Math.max(0, atStart - 30), atStart + 500).trim();
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
  const classPatterns = [
    /\b(\d+%\s+(?:cabernet\s+sauvignon|chardonnay|merlot|pinot\s+noir|pinot\s+grigio|riesling|sauvignon\s+blanc|zinfandel|malbec|syrah|shiraz|tempranillo|sangiovese|grenache|viognier|chenin\s+blanc|semillon|muscat|moscato|corn\s+neutral\s+spirits|grain\s+neutral\s+spirits))\b/i,
    /\b(tequila\s+seltzer|tequila\s+with\s+[\w\s]+|vodka\s+soda|ranch\s+water)\b/i,
    /\b(ale\s+with\s+[\w\s]+flavor|malt\s+beverage|flavored\s+malt\s+beverage|hard\s+seltzer|hard\s+cider|hard\s+lemonade|wine\s+cooler)\b/i,
    /\b(neutral\s+spirits|corn\s+neutral\s+spirits|grain\s+neutral\s+spirits)\b/i,
    // Beer (expanded: DIPA, session, hazy, black IPA, sour, fruited, etc.)
    /\b(double\s+india\s+pale\s+ale|hazy\s+(?:double\s+)?(?:india\s+)?pale\s+ale|black\s+(?:india\s+)?pale\s+ale|session\s+(?:india\s+)?pale\s+ale|new\s+england\s+(?:style\s+)?(?:india\s+)?pale\s+ale|(?:double|imperial)\s+IPA|DIPA)\b/i,
    /\b(pale\s+ale|india\s+pale\s+ale|IPA|lager|stout|porter|pilsner|wheat\s+(?:beer|ale)|amber\s+ale|brown\s+ale|hefeweizen|saison|sour\s+ale|(?:fruited\s+)?sour|blonde\s+ale|cream\s+ale|kolsch|kölsch|bock|doppelbock|dunkel|marzen|märzen|witbier|berliner\s+weisse|gose|barleywine|scotch\s+ale|strong\s+ale|farmhouse\s+ale|wild\s+ale|belgian\s+(?:strong|pale|dark|dubbel|tripel|quad))\b/i,
    /\b(red\s+wine|white\s+wine|rosé|sparkling\s+wine|champagne|table\s+wine|dessert\s+wine|fortified\s+wine|port|sherry|vermouth)\b/i,
    /\b(cabernet\s+sauvignon|chardonnay|merlot|pinot\s+noir|pinot\s+grigio|riesling|sauvignon\s+blanc|zinfandel|malbec|syrah|shiraz)\b/i,
    // Spirits (expanded: straight bourbon, single malt, etc.)
    /\b(straight\s+(?:bourbon|rye)\s+whiskey|single\s+(?:barrel|malt)\s+(?:whiskey|whisky|scotch)|small\s+batch\s+(?:bourbon|whiskey))/i,
    /\b(blended\s+whiskey|bourbon|scotch|vodka|rum|gin|tequila|brandy|cognac|mezcal|absinthe|whisky|rye\s+whiskey|agave\s+spirits?|sotol|raicilla|pisco|grappa|aquavit|cachaca|soju|baijiu|amaro|aperitif|digestif|liqueur|cordial|ready\s+to\s+drink|cocktail)\b/i,
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
  // Brand fallback 4: URL
  if (!fields.brandName) {
    const urlMatch = text.match(/\b([A-Za-z][A-Za-z]+)\.com\b/i);
    if (urlMatch) { fields.brandName = urlMatch[1].toUpperCase(); }
  }

  // --- Name & address ---
  const NA_PREFIX = /(?:imported|bottled|produced\s*&?\s*bottled|produced|distributed|blended\s*&?\s*bottled|distilled\s*&?\s*bottled|distilled|brewed|made|packed|canned|vinted|cellared|crafted|brewed\s*&?\s*canned|brewed\s*&?\s*packaged|brewed\s*&?\s*bottled|crafted\s*&?\s*canned|crafted\s*&?\s*distilled|fermented|estate\s+bottled)\s+(?:by|for|in|at|and\s+(?:canned|bottled|packaged))(?:\s|$)/i;
  const naPatterns = [
    new RegExp(`(${NA_PREFIX.source}[^.]+?,\\s*[A-Z]{2}\\s*\\d{5})`, "i"),
    new RegExp(`(${NA_PREFIX.source}[^.]+?,\\s*[A-Z]{2})\\b`, "i"),
  ];
  for (const pat of naPatterns) {
    const m = text.match(pat);
    if (m) { fields.nameAddress = m[1].trim(); break; }
  }
  if (!fields.nameAddress) {
    for (let i = 0; i < lines.length; i++) {
      if (NA_PREFIX.test(lines[i])) {
        let combined = lines[i];
        for (let j = 1; j <= 2 && i + j < lines.length; j++) combined += " " + lines[i + j];
        const m = combined.match(new RegExp(`(${NA_PREFIX.source}.+?,\\s*[A-Z]{2}(?:\\s*\\d{5})?)`, "i"));
        if (m) { fields.nameAddress = m[1].trim(); break; }
        fields.nameAddress = combined.slice(0, 120).trim();
        break;
      }
    }
  }
  // Post-correct merged state codes
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
  const varietalMatch = text.match(/\b(cabernet\s+sauvignon|chardonnay|merlot|pinot\s+noir|pinot\s+grigio|riesling|sauvignon\s+blanc|zinfandel|malbec|syrah|shiraz|tempranillo|sangiovese|grenache|viognier|gewürztraminer|chenin\s+blanc|semillon|muscat|moscato)\b/i);
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
  const countryPats = [
    /\b(product\s+of\s+[\w\s]+)/i,
    /\b(imported\s+(?:from|by)\s+[\w\s]+)/i,
    /\b(made\s+in\s+[\w\s]+)/i,
    /\b(hecho\s+en\s+[\w\s]+)/i,
    /\b(producto\s+de\s+[\w\s]+)/i,
    /\b(product\s+of\s+the\s+usa)/i,
    /\b(produced\s+in\s+[\w\s]+)/i,
  ];
  for (const pat of countryPats) {
    const m = text.match(pat);
    if (m) { fields.countryOfOrigin = m[0].trim(); break; }
  }

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
// Sharp-based preprocessing (mirrors browser-side preprocessForOcr)
// ---------------------------------------------------------------------------
async function preprocessImage(input) {
  // Accept either a file path (string) or { buffer: Buffer }
  const src = typeof input === "string" ? sharp(input) : sharp(input.buffer);
  const meta = await src.metadata();
  const MIN_WIDTH = 1500;
  const PAD = 10;
  const scale = meta.width < MIN_WIDTH ? Math.ceil(MIN_WIDTH / meta.width) : 1;
  const w = meta.width * scale;
  const h = meta.height * scale;

  const srcAgain = typeof input === "string" ? sharp(input) : sharp(input.buffer);
  const buf = await srcAgain
    .resize(w, h, { kernel: "lanczos3" })
    .grayscale()
    .sharpen({ sigma: 1, m1: 0.3, m2: 0.3 })
    .normalise()   // percentile-based contrast stretching
    .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: "#FFFFFF" })
    .png()
    .toBuffer();

  return buf;
}

// ---------------------------------------------------------------------------
// Load TTB records for ground truth (brand names, class types)
// ---------------------------------------------------------------------------
function loadRecords() {
  const raw = JSON.parse(fs.readFileSync(RECORDS_FILE, "utf-8"));
  const all = [...(raw.beer || []), ...(raw.wine || []), ...(raw.spirits || [])];
  const byId = {};
  for (const r of all) byId[r.ttbId] = r;
  return byId;
}

// ---------------------------------------------------------------------------
// Group label images by TTB ID
// ---------------------------------------------------------------------------
function groupImages() {
  const files = fs.readdirSync(LABELS_DIR).filter(f => f.endsWith(".png"));
  const groups = {};
  for (const f of files) {
    const m = f.match(/^(\d+)-(\d+)\.png$/);
    if (!m) continue;
    const ttbId = m[1];
    const num = parseInt(m[2]);
    if (!groups[ttbId]) groups[ttbId] = [];
    groups[ttbId].push({ file: f, num, path: path.join(LABELS_DIR, f) });
  }
  // Sort each group by num
  for (const id of Object.keys(groups)) {
    groups[id].sort((a, b) => a.num - b.num);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Score a single field
// ---------------------------------------------------------------------------
function scoreField(expected, actual) {
  if (!expected && !actual) return { result: "skip", score: null };
  if (!actual && expected) return { result: "miss", score: 0 };
  if (actual && !expected) return { result: "extra", score: null };

  const eLower = expected.toLowerCase().trim();
  const aLower = actual.toLowerCase().trim();

  // Exact match
  if (eLower === aLower) return { result: "exact", score: 1.0 };

  // ABV: compare just the numeric portion
  const eNum = expected.match(/(\d+\.?\d*)\s*%/);
  const aNum = actual.match(/(\d+\.?\d*)\s*%/);
  if (eNum && aNum && eNum[1] === aNum[1]) return { result: "exact", score: 1.0 };

  // Partial match: substring containment
  if (aLower.includes(eLower.slice(0, 15)) || eLower.includes(aLower.slice(0, 15))) {
    return { result: "partial", score: 0.5 };
  }

  // Levenshtein similarity (for fuzzy brand name matching)
  const sim = similarity(eLower, aLower);
  if (sim > 0.6) return { result: "fuzzy", score: sim };

  return { result: "mismatch", score: 0 };
}

function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  return (maxLen - levenshtein(a, b)) / maxLen;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ---------------------------------------------------------------------------
// Categorize a TTB record
// ---------------------------------------------------------------------------
function getCategory(record) {
  if (!record) return "unknown";
  const ct = (record.classType || "").toLowerCase();
  if (/beer|ale|lager|stout|porter|malt|ipa|pilsner/i.test(ct)) return "beer";
  if (/wine|champagne|rosé|cava|prosecco/i.test(ct)) return "wine";
  if (/spirit|whiskey|vodka|rum|gin|tequila|brandy|bourbon|mezcal|liqueur|cordial/i.test(ct)) return "spirits";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("Loading records and images...");
  const records = loadRecords();
  const groups = groupImages();
  const ttbIds = Object.keys(groups).sort();

  console.log(`Found ${ttbIds.length} TTB IDs with ${Object.values(groups).flat().length} total images`);

  // Create Tesseract worker
  const worker = await Tesseract.createWorker("eng");

  const results = [];
  let processed = 0;

  for (const ttbId of ttbIds) {
    if (processed >= LIMIT) break;
    const images = groups[ttbId];
    const record = records[ttbId];
    const category = getCategory(record);

    for (const img of images) {
      if (processed >= LIMIT) break;
      processed++;

      const label = img.num === 1 ? "front" : img.num === 2 ? "back" : `label-${img.num}`;
      process.stdout.write(`  [${processed}] ${ttbId}-${img.num} (${label})...`);

      try {
        // Preprocess
        const ppBuf = await preprocessImage(img.path);

        // OCR — Pass 1 (0° normal)
        const startMs = Date.now();
        const { data } = await worker.recognize(ppBuf);
        const ocrMs = Date.now() - startMs;

        // Parse
        const parsed = parseOcrText(data.text);
        const charCount = data.text.length;
        const wordCount = data.text.split(/\s+/).filter(Boolean).length;
        const confidence = data.confidence;
        let rotationUsed = null;
        let rotationMs = 0;

        // Pass 2: Smart edge-strip rotation
        // 1. Analyze left/right 15% strips for text content (pixel stdev)
        // 2. Only crop + rotate strips with content
        // 3. OCR just the narrow strip (~15% of pixels) instead of full image
        const EDGE_RATIO = 0.15;
        const STDEV_THRESHOLD = 25;
        if (!parsed.healthWarning) {
          const rotStart = Date.now();
          const meta = await sharp(img.path).metadata();
          const stripW = Math.max(10, Math.round(meta.width * EDGE_RATIO));

          // Compute stdev for left and right edge strips
          async function edgeStdev(left) {
            const extractLeft = left ? 0 : meta.width - stripW;
            const raw = await sharp(img.path)
              .extract({ left: extractLeft, top: 0, width: stripW, height: meta.height })
              .grayscale()
              .raw()
              .toBuffer();
            let sum = 0;
            for (let i = 0; i < raw.length; i++) sum += raw[i];
            const mean = sum / raw.length;
            let sqDiff = 0;
            for (let i = 0; i < raw.length; i++) sqDiff += (raw[i] - mean) ** 2;
            return Math.sqrt(sqDiff / raw.length);
          }

          const leftStdev = await edgeStdev(true);
          const rightStdev = await edgeStdev(false);

          const sides = [];
          if (leftStdev > STDEV_THRESHOLD) sides.push({ side: "left", extractLeft: 0 });
          if (rightStdev > STDEV_THRESHOLD) sides.push({ side: "right", extractLeft: meta.width - stripW });

          if (sides.length > 0) {
            for (const { side, extractLeft } of sides) {
              for (const deg of [90, 270]) {
                const stripBuf = await sharp(img.path)
                  .extract({ left: extractLeft, top: 0, width: stripW, height: meta.height })
                  .rotate(deg)
                  .toBuffer();
                const stripPP = await preprocessImage({ buffer: stripBuf });
                const { data: rotData } = await worker.recognize(stripPP);
                const rotParsed = parseOcrText(rotData.text);
                for (const [k, v] of Object.entries(rotParsed)) {
                  if (v && !parsed[k]) parsed[k] = v;
                }
                if (parsed.healthWarning) {
                  rotationUsed = `${side}-${deg}`;
                  break;
                }
              }
              if (parsed.healthWarning) break;
            }
          }
          rotationMs = Date.now() - rotStart;
        }

        // Score available fields
        const fieldScores = {};
        const FIELDS = ["brandName", "classType", "alcoholContent", "netContents",
          "healthWarning", "sulfiteDeclaration", "nameAddress",
          "vintageDate", "varietal", "appellation", "countryOfOrigin", "ageStatement"];

        for (const f of FIELDS) {
          if (parsed[f]) fieldScores[f] = { extracted: true, value: parsed[f] };
        }

        // Brand name accuracy (if we have ground truth)
        let brandScore = null;
        if (record && parsed.brandName) {
          brandScore = scoreField(record.brandName || record.brand, parsed.brandName);
        }

        results.push({
          ttbId, imageNum: img.num, label, category,
          ocrMs, rotationMs, rotationUsed, totalMs: ocrMs + rotationMs,
          charCount, wordCount, confidence,
          rawTextPreview: data.text.slice(0, 200).replace(/\n/g, "↵"),
          parsed, fieldScores, brandScore,
          fieldsExtracted: Object.keys(fieldScores).length,
          brandName: record?.brandName || record?.brand || "",
        });

        const rotTag = rotationUsed ? ` +rot${rotationUsed}°(${rotationMs}ms)` : (rotationMs > 0 ? ` +rot(${rotationMs}ms,miss)` : "");
        const fieldList = Object.keys(fieldScores).join(", ") || "(none)";
        console.log(` ${ocrMs}ms${rotTag}, conf=${confidence?.toFixed(0)}%, ${Object.keys(fieldScores).length} fields [${fieldList}]`);
      } catch (err) {
        console.log(` ERROR: ${err.message}`);
        results.push({
          ttbId, imageNum: img.num, label, category,
          error: err.message, fieldsExtracted: 0,
          brandName: record?.brandName || record?.brand || "",
        });
      }
    }
  }

  await worker.terminate();

  // ---------------------------------------------------------------------------
  // Generate report
  // ---------------------------------------------------------------------------
  generateReport(results);
}

function generateReport(results) {
  const successful = results.filter(r => !r.error);
  const errors = results.filter(r => r.error);

  // Overall stats
  const totalImages = results.length;
  const avgOcrMs = successful.length
    ? (successful.reduce((s, r) => s + r.ocrMs, 0) / successful.length).toFixed(0)
    : 0;
  const avgTotalMs = successful.length
    ? (successful.reduce((s, r) => s + (r.totalMs || r.ocrMs), 0) / successful.length).toFixed(0)
    : 0;
  const avgConfidence = successful.length
    ? (successful.reduce((s, r) => s + (r.confidence || 0), 0) / successful.length).toFixed(1)
    : 0;

  // Rotation stats
  const rotationAttempted = successful.filter(r => r.rotationMs > 0);
  const rotationSuccess = successful.filter(r => r.rotationUsed);
  const avgRotMs = rotationAttempted.length
    ? (rotationAttempted.reduce((s, r) => s + r.rotationMs, 0) / rotationAttempted.length).toFixed(0)
    : 0;

  // Field extraction rates
  const FIELDS = ["brandName", "classType", "alcoholContent", "netContents",
    "healthWarning", "sulfiteDeclaration", "nameAddress",
    "vintageDate", "varietal", "appellation", "countryOfOrigin", "ageStatement"];

  const fieldCounts = {};
  for (const f of FIELDS) fieldCounts[f] = 0;
  for (const r of successful) {
    for (const f of FIELDS) {
      if (r.fieldScores[f]?.extracted) fieldCounts[f]++;
    }
  }

  // Brand name accuracy
  const brandResults = successful.filter(r => r.brandScore);
  const brandExact = brandResults.filter(r => r.brandScore.result === "exact").length;
  const brandPartial = brandResults.filter(r => ["partial", "fuzzy"].includes(r.brandScore.result)).length;
  const brandMiss = brandResults.filter(r => r.brandScore.result === "mismatch" || r.brandScore.result === "miss").length;

  // Category breakdown
  const categories = ["beer", "wine", "spirits"];
  const catStats = {};
  for (const cat of categories) {
    const catResults = successful.filter(r => r.category === cat);
    catStats[cat] = {
      count: catResults.length,
      avgFields: catResults.length
        ? (catResults.reduce((s, r) => s + r.fieldsExtracted, 0) / catResults.length).toFixed(1)
        : 0,
      avgConfidence: catResults.length
        ? (catResults.reduce((s, r) => s + (r.confidence || 0), 0) / catResults.length).toFixed(1)
        : 0,
      avgMs: catResults.length
        ? (catResults.reduce((s, r) => s + r.ocrMs, 0) / catResults.length).toFixed(0)
        : 0,
    };
  }

  // Per-label-type breakdown (front vs back)
  const frontResults = successful.filter(r => r.label === "front");
  const backResults = successful.filter(r => r.label === "back");

  const frontFieldRate = {};
  const backFieldRate = {};
  for (const f of FIELDS) {
    frontFieldRate[f] = frontResults.filter(r => r.fieldScores[f]?.extracted).length;
    backFieldRate[f] = backResults.filter(r => r.fieldScores[f]?.extracted).length;
  }

  // Speed distribution
  const ocrTimes = successful.map(r => r.ocrMs).sort((a, b) => a - b);
  const p50 = ocrTimes[Math.floor(ocrTimes.length * 0.5)];
  const p90 = ocrTimes[Math.floor(ocrTimes.length * 0.9)];
  const p99 = ocrTimes[Math.floor(ocrTimes.length * 0.99)];

  // Find worst performers (lowest confidence)
  const worstConf = [...successful].sort((a, b) => (a.confidence || 0) - (b.confidence || 0)).slice(0, 10);

  // Find labels with zero fields extracted
  const zeroFields = successful.filter(r => r.fieldsExtracted === 0);

  // ---------------------------------------------------------------------------
  // Markdown output
  // ---------------------------------------------------------------------------
  const now = new Date().toISOString().split("T")[0];
  let md = `# Tesseract.js OCR Performance Report

**Generated:** ${now}
**Engine:** Tesseract.js v7 (LSTM eng)
**Preprocessing:** Sharp (grayscale → sharpen → normalise → 10px white pad → upscale to ≥1500px)
**Parser:** Heuristic regex parser (\`parseOcrText\` from \`ocr.ts\`)
**Labels tested:** ${totalImages} images across ${[...new Set(results.map(r => r.ttbId))].length} products

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Images processed** | ${totalImages} (${errors.length} errors) |
| **Avg OCR time (pass 1 only)** | ${avgOcrMs}ms per image |
| **Avg total time (with rotation)** | ${avgTotalMs}ms per image |
| **Avg Tesseract confidence** | ${avgConfidence}% |
| **Speed P50 / P90 / P99** | ${p50}ms / ${p90}ms / ${p99}ms |
| **Rotation attempted** | ${rotationAttempted.length}/${successful.length} images (when healthWarning missing) |
| **Rotation found healthWarning** | ${rotationSuccess.length}/${rotationAttempted.length} (avg ${avgRotMs}ms overhead) |
| **Brand name detected** | ${fieldCounts.brandName}/${successful.length} (${(fieldCounts.brandName / successful.length * 100).toFixed(0)}%) |
| **Brand name accurate** | ${brandExact}/${brandResults.length} exact, ${brandPartial} partial, ${brandMiss} miss |

---

## Field Extraction Rates

How often the parser successfully extracts each field from OCR text (across all ${successful.length} images):

| Field | Extracted | Rate | Front Labels (${frontResults.length}) | Back Labels (${backResults.length}) |
|-------|-----------|------|-------------|------------|
`;

  const FIELD_DISPLAY = {
    brandName: "Brand Name",
    classType: "Class/Type",
    alcoholContent: "Alcohol Content",
    netContents: "Net Contents",
    healthWarning: "Health Warning",
    sulfiteDeclaration: "Sulfite Declaration",
    nameAddress: "Name & Address",
    vintageDate: "Vintage Date",
    varietal: "Varietal",
    appellation: "Appellation",
    countryOfOrigin: "Country of Origin",
    ageStatement: "Age Statement",
  };

  for (const f of FIELDS) {
    const rate = (fieldCounts[f] / successful.length * 100).toFixed(0);
    const frontRate = frontResults.length ? (frontFieldRate[f] / frontResults.length * 100).toFixed(0) : "0";
    const backRate = backResults.length ? (backFieldRate[f] / backResults.length * 100).toFixed(0) : "0";
    md += `| ${FIELD_DISPLAY[f]} | ${fieldCounts[f]}/${successful.length} | **${rate}%** | ${frontFieldRate[f]} (${frontRate}%) | ${backFieldRate[f]} (${backRate}%) |\n`;
  }

  md += `
---

## Category Breakdown

| Category | Images | Avg Fields/Image | Avg Confidence | Avg OCR Time |
|----------|--------|-------------------|----------------|-------------|
`;
  for (const cat of categories) {
    const s = catStats[cat];
    md += `| **${cat.charAt(0).toUpperCase() + cat.slice(1)}** | ${s.count} | ${s.avgFields} | ${s.avgConfidence}% | ${s.avgMs}ms |\n`;
  }

  md += `
---

## Brand Name Accuracy

Of ${brandResults.length} images where both ground-truth brand name and OCR brand name were available:

| Result | Count | Rate |
|--------|-------|------|
| **Exact match** | ${brandExact} | ${(brandExact / brandResults.length * 100).toFixed(0)}% |
| **Partial/fuzzy** | ${brandPartial} | ${(brandPartial / brandResults.length * 100).toFixed(0)}% |
| **Mismatch/miss** | ${brandMiss} | ${(brandMiss / brandResults.length * 100).toFixed(0)}% |

`;

  // Brand name detail samples
  if (brandResults.length > 0) {
    md += `### Sample Brand Name Matches\n\n`;
    md += `| TTB ID | Expected | OCR Extracted | Result |\n`;
    md += `|--------|----------|---------------|--------|\n`;

    // Show some exact, some partial, some misses
    const samples = [
      ...brandResults.filter(r => r.brandScore.result === "exact").slice(0, 5),
      ...brandResults.filter(r => ["partial", "fuzzy"].includes(r.brandScore.result)).slice(0, 5),
      ...brandResults.filter(r => r.brandScore.result === "mismatch" || r.brandScore.result === "miss").slice(0, 5),
    ];
    for (const r of samples) {
      const icon = r.brandScore.result === "exact" ? "✅" : r.brandScore.result === "mismatch" || r.brandScore.result === "miss" ? "❌" : "⚠️";
      md += `| ${r.ttbId}-${r.imageNum} | ${r.brandName} | ${r.parsed.brandName || "—"} | ${icon} ${r.brandScore.result} |\n`;
    }
  }

  md += `
---

## OCR Speed Distribution

\`\`\`
${makeHistogram(ocrTimes)}
\`\`\`

---

## Lowest Confidence Images

Images where Tesseract reported the lowest confidence (potential trouble spots):

| Image | Confidence | Category | Fields | Brand |
|-------|------------|----------|--------|-------|
`;

  for (const r of worstConf) {
    md += `| ${r.ttbId}-${r.imageNum} | ${r.confidence?.toFixed(0)}% | ${r.category} | ${r.fieldsExtracted} | ${r.parsed.brandName || "—"} |\n`;
  }

  if (zeroFields.length > 0) {
    md += `
---

## Images With Zero Fields Extracted (${zeroFields.length})

These images produced OCR text but the parser could not extract any structured fields:

| Image | Category | Confidence | Word Count | Text Preview |
|-------|----------|------------|------------|--------------|
`;
    for (const r of zeroFields.slice(0, 20)) {
      md += `| ${r.ttbId}-${r.imageNum} | ${r.category} | ${r.confidence?.toFixed(0)}% | ${r.wordCount} | \`${(r.rawTextPreview || "").slice(0, 60)}…\` |\n`;
    }
  }

  md += `
---

## Methodology

1. **Image preprocessing** (Sharp): grayscale conversion, unsharp-mask sharpening (sigma=1, amount=0.3), percentile-based contrast normalization, 10px white padding, upscale to ≥1500px width
2. **OCR engine**: Tesseract.js v7 with LSTM English model, default PSM (automatic page segmentation)
3. **Field parsing**: Regex-based heuristic parser (\`parseOcrText\`) matching patterns for ABV, net contents, government warning, brand name, class/type, name & address, sulfite declaration, vintage, varietal, appellation, country of origin, age statement
4. **Ground truth**: Brand names and class/type codes from TTB COLA records (\`ttb_cola_records.json\`)
5. **Scoring**: Exact string match, ABV numeric match, substring containment (partial), Levenshtein similarity >0.6 (fuzzy)

### Known Limitations

- **Expected fields are partially synthetic** — alcohol content, net contents, and other fields in \`sampleData.ts\` use category defaults (e.g., "5.5% Alc. By Vol." for all beer), not per-label ground truth. Only brand name and class/type come from real TTB records.
- **Front labels are mostly artwork** — many front labels contain only the brand name and imagery with minimal extractable text. Low field counts on front labels are expected.
- **Health warning detection** checks for "GOVERNMENT WARNING" prefix only — does not verify full text accuracy or word-for-word compliance.
`;

  // Write report
  const outPath = path.join(PROJECT, "docs", "OCR_PERFORMANCE.md");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, md);
  console.log(`\n✅ Report written to ${outPath}`);

  // Also print summary to stdout
  console.log(`\n${"═".repeat(70)}`);
  console.log(`  TESSERACT OCR BENCHMARK SUMMARY`);
  console.log(`${"═".repeat(70)}`);
  console.log(`  Images: ${totalImages} (${errors.length} errors)`);
  console.log(`  Avg OCR time (pass 1): ${avgOcrMs}ms | Total (w/ rotation): ${avgTotalMs}ms`);
  console.log(`  Speed: P50=${p50}ms | P90=${p90}ms | P99=${p99}ms`);
  console.log(`  Avg confidence: ${avgConfidence}%`);
  console.log(`  Rotation: ${rotationAttempted.length} attempted, ${rotationSuccess.length} found healthWarning (avg ${avgRotMs}ms overhead)`);
  console.log(`  Brand detected: ${fieldCounts.brandName}/${successful.length} (${(fieldCounts.brandName / successful.length * 100).toFixed(0)}%)`);
  console.log(`  Brand accurate: ${brandExact}/${brandResults.length} exact`);
  console.log(`  Health warning: ${fieldCounts.healthWarning}/${successful.length} (${(fieldCounts.healthWarning / successful.length * 100).toFixed(0)}%)`);
  console.log(`  ABV detected:   ${fieldCounts.alcoholContent}/${successful.length} (${(fieldCounts.alcoholContent / successful.length * 100).toFixed(0)}%)`);
  console.log(`${"═".repeat(70)}`);
}

function makeHistogram(times) {
  const buckets = [500, 1000, 1500, 2000, 3000, 5000, 10000, 20000];
  const counts = new Array(buckets.length + 1).fill(0);
  for (const t of times) {
    let placed = false;
    for (let i = 0; i < buckets.length; i++) {
      if (t < buckets[i]) { counts[i]++; placed = true; break; }
    }
    if (!placed) counts[buckets.length]++;
  }
  const labels = [
    ...buckets.map((b, i) => `< ${(b / 1000).toFixed(1)}s`),
    `≥ ${(buckets[buckets.length - 1] / 1000).toFixed(0)}s`,
  ];
  const maxCount = Math.max(...counts);
  const barWidth = 40;
  let out = "";
  for (let i = 0; i < counts.length; i++) {
    const bar = "█".repeat(Math.round((counts[i] / maxCount) * barWidth));
    out += `  ${labels[i].padStart(8)} │ ${bar} ${counts[i]}\n`;
  }
  return out;
}

main().catch(err => { console.error(err); process.exit(1); });
