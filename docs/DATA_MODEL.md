# Data Model

This document describes the data structures used in the TTB COLA Label Validator, with a focus on what is stored for each item in the Review Queue.

> **Source of truth**: `frontend/src/lib/types.ts` defines all TypeScript interfaces.
> Sample data is seeded from `frontend/src/lib/store.ts` and `frontend/src/lib/sampleData.ts`.

---

## Entity Relationship Overview

```
Submission (1)
├── SubmissionLabel[] (1..N)    — front, back, other label images
│   └── ChecklistItem[]         — per-label compliance checklist
├── ReviewRecord[] (0..N)       — reviewer decisions + findings
│   └── ReviewFinding[]         — specific compliance issues
├── formFields {}               — submitted COLA application data
└── serverValidation {}         — server-side OCR + auto-validation
```

---

## Submission

The top-level entity representing one COLA label application in the Review Queue.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Internal submission ID (e.g. `"SUB-SU"`) |
| `ttbId` | `string` | No | TTB COLA ID from ttbonline.gov (e.g. `"26003001000001"`). Links to the original TTB record. |
| `submitterId` | `string` | Yes | Name/identifier of the submitter (e.g. `"Pilzer Distillery"`) |
| `createdAt` | `string` (ISO 8601) | Yes | When the submission was created |
| `updatedAt` | `string` (ISO 8601) | Yes | Last modification timestamp |
| `status` | `SubmissionStatus` | Yes | Current workflow state (see below) |
| `beverageCategory` | `BeverageCategory` | Yes | `"beer"`, `"wine"`, or `"spirits"` |
| `productName` | `string` | Yes | Product name or identifier (e.g. `"MANOIR DU CARRA"`) |
| `labels` | `SubmissionLabel[]` | Yes | Uploaded label images with their checklists |
| `reviews` | `ReviewRecord[]` | Yes | Audit trail of reviewer decisions (empty until reviewed) |
| `serverValidation` | `object` | No | Server-side OCR results and auto-validation findings |
| `formFields` | `Record<string, string>` | No | Key-value pairs from the COLA application form (TTB Form 5100.31) |

### Submission Status Lifecycle

```
draft → submitted → in_review → approved
                             → rejected
                             → needs_revision → submitted (resubmission)
```

| Status | Display Label | Meaning |
|--------|--------------|---------|
| `draft` | Draft | Saved but not yet submitted |
| `submitted` | Needs Review | Awaiting agent review — appears in the to-do queue |
| `in_review` | In Review | An agent has opened and is actively reviewing |
| `approved` | Approved | Label meets all TTB requirements |
| `rejected` | Rejected | Label has disqualifying compliance issues |
| `needs_revision` | Needs Revision | Fixable issues found — submitter must resubmit |

### Beverage Categories

The category determines which checklist rules and mandatory fields apply:

| Category | Mandatory Fields | Optional/Conditional Fields |
|----------|-----------------|---------------------------|
| **Beer** | Brand Name, Class/Type, Net Contents, Health Warning, Name & Address | Alcohol Content (optional per 27 CFR §7.71), Sulfite Declaration (if ≥10ppm), Aspartame Declaration (if present) |
| **Wine** | Brand Name, Class/Type, Alcohol Content, Net Contents, Health Warning, Name & Address, Sulfite Declaration | Appellation, Vintage Date, Varietal, Country of Origin, Color Ingredients |
| **Spirits** | Brand Name, Class/Type, Alcohol Content, Net Contents, Health Warning, Name & Address | Age Statement, Country of Origin, Commodity Statement, Color Ingredients |

---

## SubmissionLabel

Each submission contains one or more label images. Label ordering is defined by `TTB_LABEL_IMAGES` in `store.ts`, which maps TTB IDs to label number arrays (e.g. `[3, 2, 4]` meaning label 3 = front, label 2 = back, label 4 = other).

| Field | Type | Description |
|-------|------|-------------|
| `slotId` | `string` | Unique identifier for this label slot (e.g. `"slot-5-0"`) |
| `slotName` | `string` | Display name: `"Front Label"`, `"Back Label"`, or `"Other Label N"` |
| `originalImageUrl` | `string` | URL to the uploaded label image (Vercel Blob CDN or `/ttb-labels/` path) |
| `correctedImageUrl` | `string` | URL to the perspective-corrected version (same as original if no correction applied) |
| `checklist` | `ChecklistItem[]` | Compliance checklist items for this specific label |

### Label Assignment

| Slot Position | Label Name | Typical Content |
|---------------|-----------|----------------|
| 1st (index 0) | Front Label | Brand artwork, logo, product name, class/type |
| 2nd (index 1) | Back Label | Government warning, name & address, barcode, ingredients |
| 3rd+ (index 2+) | Other Label N | Neck strip, side panel, additional information |

---

## ChecklistItem

Each label carries a category-aware compliance checklist. Items are generated from a template based on label position (front/back) and beverage category.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Checklist item identifier (e.g. `"brand_name"`, `"health_warning"`) |
| `label` | `string` | Human-readable label (e.g. `"Brand name visible"`) |
| `description` | `string` | Detailed requirement description with CFR references |
| `appliesTo` | `("front"\|"back"\|"any")[]` | Which label positions this item applies to |
| `categories` | `BeverageCategory[]\|"all"` | Which categories this applies to |
| `autoDetectable` | `"browser"\|"server"\|"both"\|"manual"` | Whether OCR/CV can auto-check this |
| `status` | `CheckStatus` | Current state: `"unchecked"`, `"checked"`, `"auto_pass"`, `"auto_fail"`, `"not_applicable"` |
| `mandatory` | `boolean` | Is this a TTB requirement (vs. quality recommendation)? |
| `extractable` | `boolean` | Does this item expect a text value to be extracted? |
| `confidence` | `number?` | Auto-detection confidence score (0–1) |
| `detectedValue` | `string?` | Value extracted by OCR (e.g. `"Alcohol 13.5% by Volume"`) |
| `userValue` | `string?` | Agent-corrected override value |
| `validationResults` | `ValidationResult[]?` | Detailed validation results with CFR citations |
| `note` | `string?` | Note from auto-detection or reviewer |

### Checklist Item IDs

| ID | Label | Category | Mandatory |
|----|-------|----------|-----------|
| `brand_name` | Brand name visible | All | Yes |
| `class_type` | Class/type designation | All | Yes |
| `alcohol_content` | Alcohol content statement | Wine, Spirits: Yes / Beer: No | Varies |
| `net_contents` | Net contents | All | Yes |
| `health_warning` | Government health warning | All | Yes |
| `name_address` | Name and address | All | Yes |
| `country_origin` | Country of origin | All (imports only) | No |
| `sulfite_declaration` | Sulfite declaration | Wine: Yes / Beer: conditional | Varies |
| `appellation` | Appellation of origin | Wine only | No |
| `vintage_date` | Vintage date | Wine only | No |
| `varietal` | Grape varietal | Wine only | No |
| `age_statement` | Age statement | Spirits only | No |
| `color_ingredients` | Color ingredient disclosures | All (if present) | No |
| `commodity_statement` | Commodity statement | Spirits only | No |
| `aspartame_declaration` | Aspartame declaration | Beer only (if present) | No |
| `image_sharp` | Image is sharp and in focus | All | No |
| `image_lighting` | Even lighting, no glare | All | No |
| `image_complete` | Entire label visible | All | No |
| `corners_aligned` | Corner points aligned | All | No |

---

## Form Fields (COLA Application Data)

The `formFields` property on a Submission holds key-value pairs from the submitter's COLA application (TTB Form 5100.31). These are compared against OCR-detected values in the "Form vs. Label Verification" table.

| Key | Display Label | Source |
|-----|--------------|--------|
| `brandName` | Brand Name | Front label |
| `classType` | Class / Type | Front label |
| `alcoholContent` | Alcohol Content | Front or back label |
| `netContents` | Net Contents | Front or back label |
| `healthWarning` | Health Warning | Back label |
| `nameAddress` | Name & Address | Back label |
| `countryOfOrigin` | Country of Origin | Back label |
| `sulfiteDeclaration` | Sulfite Declaration | Front or back label |
| `appellation` | Appellation | Front label (wine) |
| `vintageDate` | Vintage | Front label (wine) |
| `varietal` | Varietal | Front label (wine) |
| `ageStatement` | Age Statement | Front label (spirits) |
| `colorIngredients` | Color Ingredients | Back label |
| `commodityStatement` | Commodity Statement | Back label (spirits) |
| `aspartameDeclaration` | Aspartame Declaration | Back label (beer) |

### Form vs. Label Comparison

Each field is compared using fuzzy string matching (`fuzzyMatch.ts`), producing a `MatchResult`:

| Verdict | Score | Meaning |
|---------|-------|---------|
| `exact` | 100% | Strings are identical |
| `match` | ≥80% | Close enough to be considered the same (containment, token overlap, or high Levenshtein similarity) |
| `close` | 50–79% | Partial match — needs human review |
| `mismatch` | <50% | Significant differences — likely an error |
| `missing` | — | One or both values are absent |

---

## ReviewRecord

Created when a reviewer submits a decision. A submission may have multiple reviews (primary, secondary, audit).

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Review record ID (e.g. `"REV-42"`) |
| `submissionId` | `string` | Parent submission ID |
| `reviewerId` | `string` | Reviewer name (e.g. `"Jenny Park"`) |
| `startedAt` | `string` (ISO 8601) | When the reviewer opened this submission |
| `completedAt` | `string` (ISO 8601) | When the reviewer submitted their decision |
| `activeSeconds` | `number` | Total active review time (excludes idle/tab-away) |
| `decision` | `ReviewDecision` | `"approve"`, `"reject"`, `"needs_revision"`, or `"escalate"` |
| `findings` | `ReviewFinding[]` | Specific compliance issues found |
| `notes` | `string` | Free-text reviewer notes |
| `reviewType` | `string` | `"primary"`, `"secondary"`, `"audit"`, or `"senior"` |
| `agreedWithOriginal` | `boolean?` | For audit reviews: did reviewer agree with original? |

---

## ReviewFinding

A specific compliance issue identified during review.

| Field | Type | Description |
|-------|------|-------------|
| `checklistItemId` | `string` | Which checklist item this finding relates to (e.g. `"health_warning"`) |
| `severity` | `"error"\|"warning"\|"info"` | How serious the issue is |
| `message` | `string` | Detailed description with CFR references (e.g. `"\"Government Warning:\" must be in ALL CAPS per TTB regulations."`) |
| `region` | `object?` | Bounding box `{x, y, width, height}` on the label image where the issue was found |

---

## Server Validation

Auto-populated after submission. Contains OCR results and automated validation findings.

| Field | Type | Description |
|-------|------|-------------|
| `completedAt` | `string` (ISO 8601) | When server-side validation completed |
| `findings` | `ReviewFinding[]` | Auto-detected compliance issues |
| `ocrResults` | `Record<string, string>?` | Map of checklist item ID → extracted text value |

---

## OCR Extracted Fields

Produced by `parseOcrText()` in `ocr.ts` during browser-side text detection. Stored transiently in the review page state (not persisted).

| Field | Type | Description |
|-------|------|-------------|
| `brandName` | `string?` | Extracted brand name |
| `classType` | `string?` | Class/type designation (e.g. `"India Pale Ale"`, `"Cabernet Sauvignon"`) |
| `alcoholContent` | `string?` | ABV statement (e.g. `"Alcohol 13.5% by Volume"`) |
| `netContents` | `string?` | Volume (e.g. `"750 mL"`, `"12 FL OZ"`) |
| `healthWarning` | `string?` | Government warning text |
| `nameAddress` | `string?` | Producer/importer name and address |
| `countryOfOrigin` | `string?` | Country of origin statement |
| `sulfiteDeclaration` | `string?` | `"Contains Sulfites"` if detected |
| `appellation` | `string?` | Wine appellation (e.g. `"Napa Valley"`) |
| `vintageDate` | `string?` | Vintage year (e.g. `"2022"`) |
| `varietal` | `string?` | Grape variety (e.g. `"Pinot Noir"`) |
| `ageStatement` | `string?` | Spirits aging statement (e.g. `"Aged 12 Years"`) |
| `detectedCategory` | `string?` | Auto-inferred beverage category from label text |
| `detectedSubcategory` | `string?` | Specific subcategory (e.g. `"Straight Bourbon"`, `"Chardonnay"`, `"IPA"`) |
| `rawText` | `string?` | Full raw OCR text output |

---

## Category Inference

The `categoryMatch.ts` module provides two-level classification from OCR text:

**Level 1** — Top-level category: Beer, Wine, Spirits

**Level 2** — Subcategory (100+ terms mapped):
- **Beer**: IPA, Lager, Stout, Porter, Pilsner, Saison, Hazy IPA, Hard Seltzer, Malt Beverage, etc.
- **Wine**: Chardonnay, Pinot Noir, Cabernet Sauvignon, Rosé, Sparkling Wine, Mead, Burgundy, etc.
- **Spirits**: Bourbon, Vodka, Rum, Tequila, Gin, Grappa, Sake, Mezcal, RTD Cocktail, etc.

Inference priority: `classType` (95%) → `varietal` (90%) → `appellation` (85%) → `ageStatement` (80%) → `rawText` (70%)

---

## Validation Results

Produced by the rules engine in `validation.ts`. Each result maps to a checklist item and includes a CFR citation.

| Field | Type | Description |
|-------|------|-------------|
| `ruleId` | `string` | Rule identifier (e.g. `"health_warning_caps"`) |
| `checklistItemId` | `string` | Which checklist item this validates |
| `severity` | `"error"\|"warning"\|"info"` | Severity level |
| `message` | `string` | Human-readable validation message |
| `suggestion` | `string?` | Recommended fix |
| `pass` | `boolean` | Whether the field passed validation |
| `citation` | `Citation?` | Regulatory reference (chapter, section, URL) |

---

## COLA Source Record

Raw TTB COLA record data scraped from ttbonline.gov. Stored in `ttb_cola_records.json` and embedded in `sampleData.ts` as `ColaSource`.

| Field | Type | Description |
|-------|------|-------------|
| `ttbId` | `string` | TTB COLA ID (14-digit, e.g. `"26003001000001"`) |
| `brand` | `string` | Brand name from the COLA application |
| `fancifulName` | `string` | Fanciful/trade name |
| `classCode` | `string` | TTB numeric class code |
| `classType` | `string` | TTB class/type description |
| `originCode` | `string` | Origin code (domestic/imported) |
| `origin` | `string` | Origin description |
| `permit` | `string` | TTB permit number |
| `approved` | `string` | Approval date |

---

## Data Pipeline

Records flow through the following pipeline:

```
1. Crawl records     → scripts/search-ttb-records.mjs  → sample_labels/ttb_cola_records.json
2. Download images   → scripts/download-ttb-images.mjs  → sample_labels/ttb_labels_direct/
3. Classify labels   → scripts/classify-labels.mjs      → sample_labels/label_classifications.json
4. Curate & copy     → (manual)                         → frontend/public/ttb-labels/
5. Generate code     → scripts/generate-sample-data.mjs → frontend/src/lib/sampleData.ts
6. Store integration → (manual edits)                   → frontend/src/lib/store.ts
7. Upload to CDN     → scripts/upload-labels-to-blob.mjs → Vercel Blob
8. Deploy            → git push → Vercel auto-deploy
```

### Current Scale (Feb 2026)

| Metric | Count |
|--------|-------|
| Total products | 115 |
| Beer / Wine / Spirits | 33 / 49 / 33 |
| Total label images | 229 |
| TTB_LABEL_IMAGES entries | 115 |
| SUBMISSIONS entries | 115 |
| Unit tests | 150 |
