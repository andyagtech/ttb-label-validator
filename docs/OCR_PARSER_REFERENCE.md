# OCR Parser Reference — Field Extraction Strategies

This document provides a detailed reference for the `parseOcrText()` function in `frontend/src/lib/ocr.ts`, explaining the programmatic structure and pattern-matching strategies for each field.

---

## Table of Contents

1. [Parser Architecture](#parser-architecture)
2. [Field Extraction Flow Diagram](#field-extraction-flow-diagram)
3. [Field-by-Field Reference](#field-by-field-reference)
4. [Design Principles](#design-principles)
5. [OCR Error Handling](#ocr-error-handling)
6. [Performance Characteristics](#performance-characteristics)
7. [Category Inference Pipeline](#category-inference-pipeline)

---

## Parser Architecture

### High-Level Structure

```typescript
function parseOcrText(rawText: string): ExtractedFields
```

**Input:** Raw OCR text from Tesseract.js (multi-line string)  
**Output:** Structured object with 15+ extracted fields

### Preprocessing Step

```typescript
// Create two views of the same text:
const text = rawText.replace(/\n/g, " ").replace(/\s+/g, " ");  // Flattened for regex
const lines = rawText.split(/\n/).map(l => l.trim()).filter(Boolean);  // Line array for positional logic
```

**Why two views?**
- `text` — Single-line string for regex patterns that may span multiple lines
- `lines` — Array of individual lines for positional heuristics (e.g., "first prominent line = brand name")

---

## Field Extraction Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    parseOcrText(rawText)                      │
└────────────────────────────┬─────────────────────────────────┘
                             │
                ┌────────────▼────────────┐
                │  Preprocess Input       │
                │  • text (flat string)   │
                │  • lines (array)        │
                └────────────┬────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼─────┐      ┌──────▼──────┐      ┌─────▼──────┐
   │ Pattern  │      │  Heuristic  │      │  Context   │
   │ Matching │      │  Fallbacks  │      │  Dependent │
   └────┬─────┘      └──────┬──────┘      └─────┬──────┘
        │                   │                    │
        │                   │                    │
┌───────▼───────────────────▼────────────────────▼────────────┐
│                  Field Extraction Order                      │
│                                                              │
│  1. alcoholContent    ─┐                                    │
│  2. netContents        │  Independent fields                │
│  3. healthWarning      │  (pattern matching only)           │
│  4. sulfiteDeclaration─┘                                    │
│                                                              │
│  5. brandName (tier 1-2) ─┐                                 │
│  6. classType              │  Interdependent                │
│  7. brandName (tier 3-4) ──┤  (use each other as context)  │
│                            │                                │
│  8. nameAddress ───────────┘                                │
│                                                              │
│  9. varietal          ─┐                                    │
│ 10. vintageDate        │  Simple pattern matching           │
│ 11. countryOfOrigin    │                                    │
│ 12. ageStatement       │                                    │
│ 13. appellation       ─┘                                    │
│                                                              │
│ 14. detectedCategory (inferred from above fields)           │
└──────────────────────────────────────────────────────────────┘
```

---

## Field-by-Field Reference

### 1. Alcohol Content

**Strategy:** Pattern array → first match wins  
**Complexity:** 14 ordered patterns from most specific to most general

```typescript
const abvPatterns = [
  /alcohol\s*(?:\(alc\))?\s+(\d+\.?\d*)\s*%\s*by\s+vol(?:ume)?/i,  // "Alcohol 5% by volume"
  /alcohol\s+by\s+volume:\s*(\d+\.?\d*)\s*%/i,                      // "Alcohol by volume: 4.5%"
  /(\d+\.?\d*)\s*%\s*alc\.?\s*by\s*vol\.?/i,                       // "5% Alc. By Vol."
  /(\d+\.?\d*)\s*%\s*alc\.?\s*\/\s*vol\.?/i,                       // "5% ALC./VOL."
  /(\d+\.?\d*)\s*%\s*alc\.?\s*[i1l]\s*vol\.?/i,                    // OCR: "/" → "I/1/l"
  /(\d+\.?\d*)\s*%\s*alc\.?\s*[./]?\s*n[o0]l\.?/i,                 // OCR: "V" → "N"
  // ... 8 more patterns
];

for (const pat of abvPatterns) {
  const m = text.match(pat);
  if (m) {
    fields.alcoholContent = m[0].trim();
    break;  // Stop at first match
  }
}
```

**OCR Error Handling:**
- `/` → `I`, `1`, or `l`: `"5% ALCIVOL"`, `"5% ALC1VOL"`
- `V` → `N`: `"5% ALC.NOL"`, `"5% ALC/NOL"`
- `.` → `,`: `"ALC, 5%"` (comma misread)

**Special Cases:**
- Proof-based: `"(80 PROOF)"`, `"92PROOF"` → extract as-is
- Serving Facts format: `"Alcohol by volume: 4.5%"`

**Pattern Hierarchy:**
```
Most Specific:  "Alcohol 5% by volume"
                "Alcohol by volume: 4.5%"
                "5% Alc. By Vol."
                "5% ALC./VOL."
OCR Variants:   "5% ALCIVOL", "5% ALC.NOL"
Loose Fallback: "5% alc", "alc 5%"
```

---

### 2. Net Contents

**Strategy:** Two-tier matching (compound → simple)  
**Complexity:** 2 patterns with OCR error tolerance

```typescript
// Tier 1: Compound format
const compoundNet = text.match(/(\d+\.?\d*)\s*(pints?|pt\.?|quarts?|qt\.?)\s*[,.]?\s*(\d+\.?\d*)\s*(fl\.?\s*oz\.?)/i);
if (compoundNet) {
  fields.netContents = compoundNet[0].trim();
} else {
  // Tier 2: Single unit with OCR error tolerance
  const netMatch = text.match(
    /(\d+\.?\d*)\s*[-~]?\s*(ml|m[|l]|l|fl\.?\s*oz\.?|fluid\s+oz\.?|liters?|milliliters?|cl|pints?|pt\.?|quarts?|qt\.?|gallons?|gal\.?|oz\.?|ounces?)/i
  );
  if (netMatch) fields.netContents = netMatch[0].trim();
}
```

**Examples:**
- Compound: `"1 PINT, 8.9 FL. OZ."`, `"1 PINT 8.9 FL OZ"`
- Simple: `"750 mL"`, `"12 FL OZ"`, `"1.75 L"`, `"1 PINT"`
- No-space: `"750ML"`, `"12FLOZ"`, `"16OZ"`

**OCR Error Handling:**
- `O` → `0`: `"75O ML"` → matches as `"750 ML"`
- `I` → `1`: `"I.75 L"` → matches as `"1.75 L"`
- `m|` misread: `"750 m|"` (pipe as lowercase L)
- Missing spaces: `"750ML"`, `"12FLOZ"`

---

### 3. Health Warning

**Strategy:** Anchor → slice → truncate with 4 fallbacks  
**Complexity:** Multi-strategy with end-marker truncation

```typescript
// Helper: truncate at "HEALTH PROBLEMS" end marker
const truncateWarning = (raw: string): string => {
  const endMatch = raw.match(/health\s+problems[\s.!;,)]*(?:\b|$)/i);
  if (endMatch && endMatch.index !== undefined) {
    return raw.slice(0, endMatch.index + endMatch[0].length).trim();
  }
  return raw.trim();
};

// Primary: "GOVERNMENT WARNING" with OCR error tolerance
if (/govern[mn]en[ti]?\s+warnin[g6]/i.test(text)) {
  const gwStart = text.search(/govern[mn]en[ti]?\s+warnin[g6]/i);
  fields.healthWarning = truncateWarning(text.slice(gwStart, gwStart + 500));
}

// Fallback 1: "SURGEON GENERAL" without header
if (!fields.healthWarning && /surgeon\s+general/i.test(text)) {
  const sgStart = text.search(/surgeon\s+general/i);
  fields.healthWarning = truncateWarning(text.slice(Math.max(0, sgStart - 40), sgStart + 500));
}

// Fallback 2: "ACCORDING TO THE" + "BIRTH DEFECTS" (fragmented)
if (!fields.healthWarning && /according\s+to\s+the/i.test(text) && /birth\s+defects/i.test(text)) {
  const atStart = text.search(/according\s+to\s+the/i);
  fields.healthWarning = truncateWarning(text.slice(Math.max(0, atStart - 30), atStart + 500));
}

// Fallback 3: "WOMEN SHOULD NOT DRINK" (body text)
if (!fields.healthWarning && /women\s+should\s+not\s+drink/i.test(text)) {
  const wStart = text.search(/women\s+should\s+not\s+drink/i);
  fields.healthWarning = truncateWarning(text.slice(Math.max(0, wStart - 50), wStart + 500));
}

// Fallback 4: "CONSUMPTION OF ALCOHOLIC" (second statement)
if (!fields.healthWarning && /consumption\s+of\s+alcoholic/i.test(text)) {
  const cStart = text.search(/consumption\s+of\s+alcoholic/i);
  fields.healthWarning = truncateWarning(text.slice(Math.max(0, cStart - 80), cStart + 500));
}
```

**Flow Diagram:**
```
┌─────────────────────────────────────────────────┐
│  Search for "GOVERNMENT WARNING"                │
│  (with OCR error tolerance)                     │
└──────────────┬──────────────────────────────────┘
               │
         Found?│
        ┌──────┴──────┐
       YES            NO
        │              │
        │      ┌───────▼────────────────────────┐
        │      │ Fallback 1: "SURGEON GENERAL"  │
        │      └───────┬────────────────────────┘
        │              │
        │        Found?│
        │       ┌──────┴──────┐
        │      YES            NO
        │       │              │
        │       │      ┌───────▼──────────────────────────────┐
        │       │      │ Fallback 2: "ACCORDING TO THE" +     │
        │       │      │             "BIRTH DEFECTS"          │
        │       │      └───────┬──────────────────────────────┘
        │       │              │
        │       │        Found?│
        │       │       ┌──────┴──────┐
        │       │      YES            NO
        │       │       │              │
        │       │       │      ┌───────▼──────────────────────┐
        │       │       │      │ Fallback 3: "WOMEN SHOULD    │
        │       │       │      │             NOT DRINK"       │
        │       │       │      └───────┬──────────────────────┘
        │       │       │              │
        │       │       │        Found?│
        │       │       │       ┌──────┴──────┐
        │       │       │      YES            NO
        │       │       │       │              │
        │       │       │       │      ┌───────▼──────────────┐
        │       │       │       │      │ Fallback 4:          │
        │       │       │       │      │ "CONSUMPTION OF      │
        │       │       │       │      │  ALCOHOLIC"          │
        │       │       │       │      └───────┬──────────────┘
        │       │       │       │              │
        └───────┴───────┴───────┴──────────────┘
                        │
                ┌───────▼────────┐
                │ Truncate at    │
                │ "HEALTH        │
                │  PROBLEMS"     │
                └────────────────┘
```

**OCR Error Handling:**
- `GOVERNMEN` (missing T)
- `GOVERNMENI` (T → I)
- `WARNIN6` (G → 6)

**Why Truncation?**
Prevents capturing unrelated text after the warning ends. The legal text always ends with "MAY CAUSE HEALTH PROBLEMS."

---

### 4. Brand Name

**Strategy:** 4-tier cascading fallback system  
**Complexity:** Pattern → heuristic → context-dependent → URL extraction

```typescript
// Tier 1: Specific pattern (brewery/winery/distillery)
const brandPatterns = [
  /(\w[\w\s&']+(?:brew(?:ery|ing)|winer(?:y|ies)|distiller(?:y|ies)|cellars?|vineyards?|estate))/i
];
for (const pat of brandPatterns) {
  const m = text.match(pat);
  if (m) {
    fields.brandName = m[1].trim();
    break;
  }
}

// Tier 2: First prominent all-caps line (top 8 lines)
if (!fields.brandName) {
  for (const line of lines.slice(0, 8)) {
    if (line.length >= 3 && line.length <= 60 && /^[A-Z][A-Z\s&'.]+$/.test(line)) {
      fields.brandName = line;
      break;
    }
  }
}

// Tier 3: First short prominent line with exclusions
if (!fields.brandName) {
  for (const line of lines.slice(0, 8)) {
    // Skip: numbers, measurements, gov warning, nutrition, producer statements, OCR noise
    if (line.length < 3 || line.length > 40) continue;
    if (/government\s+warning/i.test(line)) continue;
    if (/contains?\s+sulfites?/i.test(line)) continue;
    if (/^\d/.test(line)) continue;
    if (/alc|vol|proof|oz|ml|fl\b/i.test(line)) continue;
    if (/bottled\s+by|distilled|produced|imported|distributed/i.test(line)) continue;
    if (/[=\[\]~|{}@#$^*<>]/.test(line)) continue;
    if (/calories|carbohydrate|protein|fat:/i.test(line)) continue;
    
    fields.brandName = line;
    break;
  }
}

// Tier 4: Extract from product name (requires classType)
if (!fields.brandName && fields.classType) {
  const classLower = fields.classType.toLowerCase();
  for (const line of lines) {
    const lineLower = line.toLowerCase();
    const classIdx = lineLower.indexOf(classLower);
    if (classIdx > 0) {
      const before = line.slice(0, classIdx).trim();
      if (before.length >= 2 && before.length <= 40 && !/\d/.test(before)) {
        fields.brandName = before;
        break;
      }
    }
  }
}

// Tier 5: Extract from URL
if (!fields.brandName) {
  const urlMatch = text.match(/\b([A-Za-z][A-Za-z]+)\.com\b/i);
  if (urlMatch) {
    fields.brandName = urlMatch[1].toUpperCase();
  }
}
```

**Examples:**
- Tier 1: `"Narrows Brewing"` → match on "Brewing"
- Tier 2: `"HOPS N DROPS"` → all caps, near top
- Tier 3: `"Hennessy"` → prominent line, passes exclusions
- Tier 4: `"ONDA TEQUILA SELTZER"` → classType="tequila seltzer" → brand="ONDA"
- Tier 5: `"www.barleyandboar.com"` → brand="BARLEYANDBOAR"

**Flow Diagram:**
```
┌──────────────────────────────────┐
│ Tier 1: Pattern Match            │
│ (brewery/winery/distillery)      │
└────────┬─────────────────────────┘
         │
   Found?│
    ┌────┴────┐
   YES       NO
    │         │
    │  ┌──────▼──────────────────────┐
    │  │ Tier 2: First All-Caps Line │
    │  │ (top 8 lines, 3-60 chars)   │
    │  └──────┬──────────────────────┘
    │         │
    │   Found?│
    │    ┌────┴────┐
    │   YES       NO
    │    │         │
    │    │  ┌──────▼──────────────────────┐
    │    │  │ Tier 3: First Prominent     │
    │    │  │ Line (with exclusions)      │
    │    │  └──────┬──────────────────────┘
    │    │         │
    │    │   Found?│
    │    │    ┌────┴────┐
    │    │   YES       NO
    │    │    │         │
    │    │    │  ┌──────▼──────────────────┐
    │    │    │  │ Tier 4: Extract from    │
    │    │    │  │ Product Name            │
    │    │    │  │ (requires classType)    │
    │    │    │  └──────┬──────────────────┘
    │    │    │         │
    │    │    │   Found?│
    │    │    │    ┌────┴────┐
    │    │    │   YES       NO
    │    │    │    │         │
    │    │    │    │  ┌──────▼──────────┐
    │    │    │    │  │ Tier 5: URL     │
    │    │    │    │  │ Extraction      │
    │    │    │    │  └──────┬──────────┘
    │    │    │    │         │
    └────┴────┴────┴─────────┘
                   │
            ┌──────▼──────┐
            │ Brand Name  │
            │ or empty    │
            └─────────────┘
```

---

### 5. Class/Type

**Strategy:** Pattern array → first match wins  
**Complexity:** 9 ordered patterns covering 100+ beverage types

```typescript
const classPatterns = [
  // "100% Sangiovese" — percentage + varietal/type
  /\b(\d+%\s+(?:cabernet\s+sauvignon|chardonnay|...))\b/i,
  
  // Compound spirits (must be before generic spirits)
  /\b(tequila\s+seltzer|vodka\s+soda|ranch\s+water)\b/i,
  /\b(hard\s+seltzer|malt\s+beverage|flavored\s+malt\s+beverage)\b/i,
  
  // Beer (specific → general)
  /\b(double\s+india\s+pale\s+ale|hazy\s+(?:double\s+)?(?:india\s+)?pale\s+ale|...)\b/i,
  /\b(pale\s+ale|IPA|lager|stout|porter|pilsner|pils|...)\b/i,
  
  // Wine
  /\b(red\s+wine|white\s+wine|rosé|rose\s+wine|sparkling\s+wine|...)\b/i,
  /\b(cabernet\s+sauvignon|chardonnay|merlot|pinot\s+noir|...)\b/i,
  
  // Spirits (specific → general)
  /\b(straight\s+(?:bourbon|rye)\s+whiskey|single\s+(?:barrel|malt)|...)\b/i,
  /\b(bourbon|scotch|vodka|rum|gin|tequila|brandy|cognac|...)\b/i,
];

for (const pat of classPatterns) {
  const m = text.match(pat);
  if (m) {
    fields.classType = m[0].trim();
    break;
  }
}
```

**Pattern Order Rationale:**
1. **Percentage + varietal** first (most specific)
2. **Compound types** before generic (avoid "tequila" matching before "tequila seltzer")
3. **Beer specific** before general (avoid "pale ale" matching before "hazy pale ale")
4. **Spirits specific** before general (avoid "bourbon" matching before "straight bourbon whiskey")

**Coverage:**
- **Beer:** 40+ types (IPA variants, lager, stout, porter, sour, Belgian styles, etc.)
- **Wine:** 25+ types (red/white/rosé, sparkling, fortified, varietals)
- **Spirits:** 35+ types (whiskey variants, vodka, rum, gin, tequila, brandy, liqueurs, etc.)

---

### 6. Name & Address

**Strategy:** 3-strategy cascade + post-correction  
**Complexity:** Prefix matching → multi-line scan → reverse lookup

```typescript
// Define producer action verbs (with OCR error tolerance)
const NA_PREFIX = /(?:imported|bottled?|bo[ti]+led|produced|distributed|blended|distilled?|disti[li]+ed|brewed|made|packed|canned|vinted|cellared|crafted|fermented|estate\s+bottled|grown|selected|aged)\s*(?:&|and)?\s*(?:bottled?|bo[ti]+led|produced|distributed|blended|distilled?|disti[li]+ed|brewed|canned|packaged|crafted)?\s+(?:by|for|in|at|and\s+(?:canned|bottled|packaged))(?:\s|$)/i;

// Strategy 1: Single-line with state/ZIP
const naPatterns = [
  new RegExp(`(${NA_PREFIX.source}[^.]+?,\\s*[A-Z]{2}\\s*\\d{5})`, "i"),  // with ZIP
  new RegExp(`(${NA_PREFIX.source}[^.]+?,\\s*[A-Z]{2})\\b`, "i"),         // without ZIP
];
for (const pat of naPatterns) {
  const m = text.match(pat);
  if (m) {
    fields.nameAddress = m[1].trim();
    break;
  }
}

// Strategy 2: Multi-line scan (prefix on one line, address on next)
if (!fields.nameAddress) {
  for (let i = 0; i < lines.length; i++) {
    if (NA_PREFIX.test(lines[i])) {
      let combined = lines[i];
      for (let j = 1; j <= 2 && i + j < lines.length; j++) {
        combined += " " + lines[i + j];
      }
      const m = combined.match(new RegExp(`(${NA_PREFIX.source}.+?,\\s*[A-Z]{2}(?:\\s*\\d{5})?)`, "i"));
      if (m) {
        fields.nameAddress = m[1].trim();
        break;
      }
      fields.nameAddress = combined.slice(0, 120).trim();
      break;
    }
  }
}

// Post-correction: Fix OCR merge errors (NAPACA → NAPA, CA)
if (fields.nameAddress) {
  const US_STATES = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)$/;
  fields.nameAddress = fields.nameAddress.replace(
    /([A-Za-z]{3,})([A-Z]{2})\s*(-\s*USA|[+]\s*USA)?\s*$/,
    (_match, city, st, usa) => {
      if (US_STATES.test(st)) {
        return `${city}, ${st}${usa ? " USA" : ""}`;
      }
      return _match;
    }
  );
}

// Strategy 3: Reverse lookup (find City, ST ZIP and grab context before)
if (!fields.nameAddress) {
  const addressMatch = text.match(/[\w\s]+,\s*[A-Z]{2}\s*\d{5}/);
  if (addressMatch) {
    const idx = text.indexOf(addressMatch[0]);
    const start = Math.max(0, idx - 80);
    let grabbed = text.slice(start, idx + addressMatch[0].length).trim();
    const importerStart = grabbed.search(NA_PREFIX);
    if (importerStart > 0) {
      grabbed = grabbed.slice(importerStart).trim();
    }
    fields.nameAddress = grabbed;
  }
}
```

**Examples:**
- Strategy 1: `"Brewed by Narrows Brewing, Tacoma, WA 98402"` (single line)
- Strategy 2: `"Brewed by\nNarrows Brewing\nTacoma, WA 98402"` (multi-line)
- Strategy 3: `"...some text... Tacoma, WA 98402"` → grab 80 chars before
- Post-correction: `"NAPACA"` → `"NAPA, CA"`

**OCR Error Handling:**
- `BOITLED` → `BOTTLED` (I/T confusion)
- `DISTIILED` → `DISTILLED` (I/L confusion)
- `NAPACA` → `NAPA, CA` (missing comma)

**Producer Action Verbs:**
```
imported, bottled, produced, distributed, blended, distilled, brewed,
made, packed, canned, vinted, cellared, crafted, fermented,
estate bottled, grown, selected, aged
```

**Compound Connectors:**
```
& bottled, and bottled, & canned, and canned, & packaged, and packaged
```

---

### 7. Simple Fields

These fields use straightforward single-pattern matching:

#### Sulfite Declaration
```typescript
if (/contains?\s+sulfites?/i.test(text)) {
  fields.sulfiteDeclaration = "Contains Sulfites";
}
```

#### Varietal
```typescript
const varietalMatch = text.match(
  /\b(cabernet\s+sauvignon|chardonnay|merlot|pinot\s+noir|pinot\s+grigio|riesling|sauvignon\s+blanc|zinfandel|malbec|syrah|shiraz|tempranillo|sangiovese|grenache|viognier|gewürztraminer|chenin\s+blanc|semillon|muscat|moscato)\b/i
);
if (varietalMatch) {
  fields.varietal = varietalMatch[0].trim();
  // Use as classType fallback
  if (!fields.classType) {
    fields.classType = fields.varietal;
  }
}
```

#### Vintage Date
```typescript
const vintageMatch = text.match(/\b(19|20)\d{2}\b/);
if (vintageMatch) {
  const yr = parseInt(vintageMatch[0]);
  if (yr >= 1950 && yr <= new Date().getFullYear()) {
    fields.vintageDate = vintageMatch[0];
  }
}
```

#### Country of Origin
```typescript
const countryPatterns = [
  /\b(product\s+of\s+[\w\s]+)/i,           // "Product of France"
  /\b(imported\s+(?:from|by)\s+[\w\s]+)/i, // "Imported from Italy"
  /\b(made\s+in\s+[\w\s]+)/i,              // "Made in USA"
  /\b(hecho\s+en\s+[\w\s]+)/i,             // Spanish: "Hecho en Mexico"
  /\b(producto\s+de\s+[\w\s]+)/i,          // Spanish: "Producto de Mexico"
  /\b(product\s+of\s+the\s+usa)/i,         // Specific US match
  /\b(produced\s+in\s+[\w\s]+)/i,          // "Produced in California"
];
for (const pat of countryPatterns) {
  const m = text.match(pat);
  if (m) {
    fields.countryOfOrigin = m[0].trim();
    break;
  }
}
```

#### Age Statement (Spirits)
```typescript
const agePatterns = [
  /\b(aged\s+(?:a\s+minimum\s+of\s+)?(\d+)\s+years?)\b/i,  // "Aged 12 years"
  /\b((\d+)\s+years?\s+old)\b/i,                            // "12 years old"
  /\b((\d+)\s*-?\s*yr\.?\s*old)\b/i,                        // "12-yr old"
];
for (const pat of agePatterns) {
  const m = text.match(pat);
  if (m) {
    fields.ageStatement = m[0].trim();
    break;
  }
}
```

#### Appellation (Wine)
```typescript
const appellationPatterns = [
  // US appellations
  /\b(napa\s+valley|sonoma\s+(?:county|coast|valley)|paso\s+robles|russian\s+river\s+valley|willamette\s+valley|columbia\s+valley|walla\s+walla\s+valley|finger\s+lakes|long\s+island|central\s+coast|santa\s+barbara\s+county|monterey\s+county|mendocino\s+county|lodi|alexander\s+valley|dry\s+creek\s+valley|anderson\s+valley|carneros|los\s+carneros|stags\s+leap|oakville|rutherford|st\.?\s*helena|calistoga)\b/i,
  
  // International appellations
  /\b(bordeaux|burgundy|champagne|côtes?\s+du\s+rhône|loire\s+valley|alsace|languedoc|provence|rioja|ribera\s+del\s+duero|chianti|barolo|barbaresco|prosecco|valpolicella|mosel|rheingau|marlborough|barossa\s+valley|mclaren\s+vale|margaret\s+river|hunter\s+valley|stellenbosch|mendoza|maipo\s+valley|casablanca\s+valley)\b/i,
];
for (const pat of appellationPatterns) {
  const m = text.match(pat);
  if (m) {
    fields.appellation = m[0].trim();
    break;
  }
}
```

---

## Design Principles

### 1. Cascading Fallbacks
Try specific patterns first, fall back to heuristics if no match:
```
Pattern Match → Positional Heuristic → Context-Based → URL/Fallback
```

### 2. OCR Error Tolerance
Common character substitutions handled in patterns:
- `I/1/l` confusion: `"ALCIVOL"`, `"ALC1VOL"`
- `O/0` confusion: `"75O ML"`
- `V/N` confusion: `"ALC.NOL"`
- `|/l` confusion: `"750 m|"`
- Missing spaces: `"750ML"`, `"12FLOZ"`
- Punctuation misreads: `.` → `,`, `/` → `I`

### 3. Positional Heuristics
Use label layout conventions:
- **Brand names** appear at the top (first 8 lines)
- **Health warnings** appear at edges (rotation detection)
- **Producer statements** appear near bottom (name & address)

### 4. Context Awareness
Use found fields to help find others:
- `classType` helps extract `brandName` from product lines
- `varietal` can serve as `classType` fallback
- `NA_PREFIX` helps locate `nameAddress` boundaries

### 5. Truncation/Boundaries
Prevent over-capturing:
- Health warning: truncate at `"HEALTH PROBLEMS"`
- Name & address: stop at state/ZIP pattern
- Vintage date: validate year range (1950–current)

### 6. Multi-Strategy Approaches
Try different methods for complex fields:
- Name & address: single-line → multi-line → reverse lookup
- Brand name: pattern → all-caps → prominent → context → URL

---

## OCR Error Handling

### Character Substitution Patterns

| Correct | OCR Misread | Pattern Example |
|---------|-------------|-----------------|
| `/` | `I`, `1`, `l` | `ALC./VOL.` → `ALCIVOL`, `ALC1VOL` |
| `V` | `N` | `VOL` → `NOL` |
| `O` | `0` | `750` → `75O` |
| `I` | `1`, `l` | `1.75` → `I.75`, `l.75` |
| `T` | `I` | `BOTTLED` → `BOITLED` |
| `L` | `I` | `DISTILLED` → `DISTIILED` |
| `.` | `,` | `ALC.` → `ALC,` |
| `l` | `|` | `ml` → `m|` |
| `G` | `6` | `WARNING` → `WARNIN6` |

### Whitespace Handling

```typescript
// Normalize whitespace in flattened text
const text = rawText.replace(/\n/g, " ").replace(/\s+/g, " ");

// Patterns handle optional spaces
/(\d+\.?\d*)\s*[-~]?\s*(ml|l|...)/i  // Matches "750ml", "750 ml", "750  ml"
```

### Missing Punctuation

```typescript
// Comma insertion for city/state
"NAPACA" → "NAPA, CA"
"ATASCADEROCA" → "ATASCADERO, CA"

// Pattern handles optional periods
/alc\.?\s*by\s*vol\.?/i  // Matches "ALC BY VOL", "ALC. BY VOL.", "ALCBYVOL"
```

---

## Performance Characteristics

### Time Complexity
- **O(n)** for most fields (single regex pass over text)
- **O(n × m)** for brand name tier 2-3 (scan first 8 lines with exclusions)
- **O(n × k)** for name & address strategy 2 (multi-line scan with 2-line lookahead)

Where:
- `n` = length of OCR text
- `m` = number of exclusion checks (~10)
- `k` = number of lines in text

### Space Complexity
- **O(n)** — stores two views of text (`text` and `lines`)
- **O(1)** — patterns are compile-time constants

### Typical Performance
- **Parse time:** <5ms per image (regex matching is fast)
- **Bottleneck:** Tesseract OCR (~1–3s), not parsing

### Detection Rates (209 images benchmark)
| Field | Rate | Strategy |
|-------|------|----------|
| Brand Name | 98% | Multi-tier fallback |
| Health Warning | 58% | Anchor + 4 fallbacks + rotation |
| Class/Type | 55% | 100+ pattern dictionary |
| Net Contents | 52% | Compound + simple |
| Name & Address | 54% | 3-strategy cascade |
| Alcohol Content | 40% | 14 ordered patterns |
| Sulfite | 19% | Simple keyword |
| Vintage Date | 20% | Year pattern + validation |
| Country of Origin | 23% | 7 multilingual patterns |
| Varietal | 14% | Dictionary match |
| Appellation | 10% | Region dictionary |
| Age Statement | 1% | 3 patterns (spirits only) |

---

## Category Inference Pipeline

**Function:** `inferCategory(fields)` → `CategoryInference`  
**Location:** `frontend/src/lib/categoryMatch.ts` lines 291–359  
**Called by:** `inferCategoryFromFields()` in `ocr-extractors.ts`, `FormVsLabelTable.tsx`

Category inference runs **after** all field extractors, using their outputs to determine the beverage category and official TTB class/type code.

### CategoryInference Interface

```typescript
interface CategoryInference {
  category: "beer" | "wine" | "spirits" | null;
  subcategory: string | null;        // Specific TTB code (e.g., "STRAIGHT BOURBON WHISKY")
  subcategoryFamily: string | null;  // Broad family (e.g., "WHISKY")
  confidence: number;                // 0–1
  confidenceTier: "high" | "medium" | "low" | null;
  matchedTerm: string | null;        // OCR text that triggered the match
}
```

### Priority Chain

Inputs are checked in order; the first match wins:

| Priority | Input Field | Confidence | Tier | Rationale |
|----------|-------------|------------|------|-----------|
| 1 | `classType` | 0.95 | high | Already parsed from label — most reliable |
| 2 | `varietal` | 0.90 | high | Strong wine indicator (grape = wine) |
| 3 | `appellation` | 0.85 | medium | Implies wine, but no type info; defaults to TABLE WHITE WINE |
| 4 | `ageStatement` | 0.80 | medium | Strong spirits indicator; defaults to WHISKY SPECIALTIES |
| 5 | `rawText` | 0.60 | low | Full text scan — higher false positive risk |

```
classType="IPA"  →  beer / ALE / ALE (family) / 0.95 / high
varietal="Pinot Noir"  →  wine / TABLE RED WINE / TABLE WINE / 0.90 / high
appellation="Napa Valley"  →  wine / TABLE WHITE WINE / TABLE WINE / 0.85 / medium
ageStatement="Aged 12 Years"  →  spirits / WHISKY SPECIALTIES / WHISKY / 0.80 / medium
rawText (contains "ale")  →  beer / ALE / ALE / 0.60 / low
```

### Two-Tier Output

Agents get **two levels** of subcategory for different decision needs:

| Field | Description | Accuracy | Use Case |
|-------|-------------|----------|----------|
| `subcategory` | Specific official TTB class/type code | **60%** exact match | Pre-fill form fields, detailed review |
| `subcategoryFamily` | Broad family grouping | **73%** family match | Quick triage, routing, validation |

**Family Mapping (`toFamily()`):**

| Category | subcategory Example | subcategoryFamily |
|----------|-------------------|------------------|
| beer | `ALE`, `STOUT` | `ALE` |
| beer | `MALT BEVERAGES SPECIALITIES - FLAVORED` | `MALT BEVERAGES` |
| beer | `LAGER`, `PILSNER` | `BEER` |
| wine | `TABLE RED WINE`, `TABLE WHITE WINE` | `TABLE WINE` |
| wine | `ROSE WINE` | `TABLE WINE` |
| wine | `DESSERT /PORT/SHERRY/(COOKING) WINE` | `DESSERT WINE` |
| wine | `SPARKLING WINE/CHAMPAGNE` | `SPARKLING WINE` |
| spirits | `STRAIGHT BOURBON WHISKY`, `WHISKY SPECIALTIES` | `WHISKY` |
| spirits | `RUM` | `RUM` |
| spirits | `TEQUILA`, `MEZCAL`, `AGAVE SPIRITS` | `AGAVE` |
| spirits | `VODKA` | `VODKA` |
| spirits | `GIN` | `GIN` |
| spirits | `BRANDY`, `GRAPPA`, `PISCO` | `BRANDY` |
| spirits | `LIQUEUR` | `LIQUEUR` |
| spirits | `SAKE` | `SAKE` |
| spirits | `OTHER COCKTAILS` | `COCKTAILS` |

### Confidence Tiers for Agents

| Tier | Confidence Range | Trigger | Agent Guidance |
|------|-----------------|---------|----------------|
| **high** | ≥ 0.90 | `classType` or `varietal` matched directly | Trust the result — auto-fill is safe |
| **medium** | 0.70 – 0.89 | `appellation` or `ageStatement` used | Review before accepting — type is inferred, not read |
| **low** | ≤ 0.69 | `rawText` fallback | Manual verification required — high false-positive risk |
| **null** | 0 | No match at all | No inference possible — agent must classify manually |

### ABV-Based Wine Classification

**Rule:** Per 27 CFR 4.21(b)(3), wine with >14% ABV is dessert wine.

```
If category = "wine" AND subcategory starts with "TABLE " AND ABV > 14%:
  → Upgrade subcategory to "DESSERT /PORT/SHERRY/(COOKING) WINE"
  → subcategoryFamily remains unchanged (preserves original family context)
```

**`parseAbv()` helper** handles:
- Percentage: `"12.5%"`, `"12.5% ABV"`, `"12.5% ALC/VOL"`
- Proof: `"80 proof"` → 40% ABV

**Important:** ABV upgrade only affects TABLE wines. Sparkling, rosé, and wines already classified as dessert/port/sherry are not modified.

**Impact:** +5 correct classifications in wine subcategory (67% → 78% exact match).

### SUBCATEGORY_MAP

**Location:** `frontend/src/lib/categoryMatch.ts` lines 16–255  
**Size:** 100+ entries mapping signal words → official TTB COLA class/type codes

The map is ordered from most specific to most general per category. The `matchText()` function iterates the map and returns on first match — so order matters.

**Structure:**
```typescript
{ term: "straight bourbon", pattern: /\bstraight\s+bourbon\b/i, parent: "spirits", subcategory: "STRAIGHT BOURBON WHISKY" }
```

**Coverage by category:**
- **Beer:** Hard seltzer, cider, wine cooler, IPA variants, stout, porter, pilsner, wheat, sour, Belgian styles, lager, schwarzbier, ESB, shandy, etc.
- **Wine:** Red/white/rosé/sparkling/champagne/port/sherry/vermouth/mead/cava/prosecco/ice wine, 30+ varietals (with Unicode: ñ, è, ü, ö)
- **Spirits:** Bourbon/rye/scotch/blended whisky, vodka, gin, rum, tequila/mezcal/agave, brandy/cognac/armagnac/calvados/grappa/pisco, liqueur/cordial/amaro, sake, cocktails/RTD, moonshine, baijiu, schnapps

### Accuracy Metrics (114 products, 204 images)

| Metric | Overall | Beer | Wine | Spirits |
|--------|---------|------|------|---------|
| **Category correct** | 89% (102/114) | 97% (31/32) | 90% (44/49) | 82% (27/33) |
| **Subcategory exact** | 60% (68/114) | 75% (24/32) | 78% (38/49) | 18% (6/33) |
| **Subcategory family** | 73% (83/114) | 75% (24/32) | 90% (44/49) | 45% (15/33) |
| **No extraction** | 7% (8/114) | — | — | — |

**Key gaps:**
- Spirits exact match is low (18%) because many TTB codes are highly specific (e.g., "STRAIGHT BOURBON WHISKY BLENDS") while OCR extracts generic terms ("bourbon")
- Spirits family match (45%) is the main area for improvement — expanding patterns for proof statements, aged/barrel terms, and RTD indicators would help

Full evaluation report: `docs/CLASSTYPE_EVAL.md`

---

## Related Documentation

- **Pipeline Overview:** `docs/OCR_ARCHITECTURE.md`
- **Performance Metrics:** `docs/OCR_PERFORMANCE.md`
- **Class/Type Evaluation:** `docs/CLASSTYPE_EVAL.md`
- **Fuzzy Matching:** `frontend/src/lib/fuzzyMatch.ts`
- **Validation Rules:** `frontend/src/lib/validation.ts`

---

**Last Updated:** February 18, 2026  
**Parser Version:** v3.0 (two-tier output, ABV classification, confidence tiers)
