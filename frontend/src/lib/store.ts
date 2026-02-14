/**
 * In-memory submission store for the review queue prototype.
 *
 * This is a server-side singleton that persists across API calls within the
 * same process but resets on redeploy. For production, swap this with a
 * database (Postgres, DynamoDB, etc.).
 */

import { Submission, SubmissionStatus, ReviewRecord, ReviewFinding, BeverageCategory, SubmissionLabel } from "./types";
import { getSampleProducts, type SampleProduct } from "./sampleData";
import { loadManifest } from "./blobStorage";

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

let submissions: Submission[] = [];
let seeded = false;
let manifestApplied = false;

function ensureSeeded() {
  if (seeded) return;
  seeded = true;
  submissions = generateMockSubmissions();
}

/**
 * Load persisted Blob URLs from the manifest and apply them to matching
 * submissions. Called lazily on first getAllSubmissions / getSubmission if
 * not already applied, and eagerly after populate generates new images.
 */
export async function applyManifestToSubmissions(): Promise<number> {
  ensureSeeded();
  const manifest = await loadManifest();
  if (!manifest) return 0;

  let applied = 0;
  for (const entry of manifest.labels) {
    const sub = submissions.find((s) => s.productName === entry.productName);
    if (!sub) continue;
    const front = sub.labels.find((l) => l.slotName === "Front Label");
    const back = sub.labels.find((l) => l.slotName === "Back Label");
    if (front) {
      front.originalImageUrl = entry.frontUrl;
      front.correctedImageUrl = entry.frontUrl;
    }
    if (back) {
      back.originalImageUrl = entry.backUrl;
      back.correctedImageUrl = entry.backUrl;
    }
    applied++;
  }
  manifestApplied = true;
  return applied;
}

/**
 * Ensure manifest Blob URLs are applied (idempotent, runs once).
 * Non-blocking — if the fetch fails, we fall back to SVG placeholders.
 */
export async function ensureManifestApplied() {
  if (manifestApplied) return;
  try {
    await applyManifestToSubmissions();
  } catch {
    manifestApplied = true; // don't retry on error
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Reset the store and re-generate all mock submissions. Used by the seed API. */
export function reseedSubmissions(): Submission[] {
  seeded = true;
  manifestApplied = false; // re-apply manifest on next access
  submissions = generateMockSubmissions();
  return submissions;
}

/** Return every submission in the store (seeds on first access). */
export function getAllSubmissions(): Submission[] {
  ensureSeeded();
  return submissions;
}

/** Look up a single submission by ID. Returns `undefined` if not found. */
export function getSubmission(id: string): Submission | undefined {
  ensureSeeded();
  return submissions.find((s) => s.id === id);
}

/**
 * Create a new submission and prepend it to the store.
 *
 * Auto-generates a unique ID from the current timestamp and sets the
 * initial status to "submitted". The submission is inserted at the
 * front of the array so it appears first in queue listings.
 */
export function createSubmission(data: {
  beverageCategory: BeverageCategory;
  productName: string;
  submitterId: string;
  labels: SubmissionLabel[];
  serverValidation?: Submission["serverValidation"];
  formFields?: Record<string, string>;
}): Submission {
  ensureSeeded();
  const now = new Date().toISOString();
  const submission: Submission = {
    id: `SUB-${Date.now().toString(36).toUpperCase()}`,
    submitterId: data.submitterId,
    createdAt: now,
    updatedAt: now,
    status: "submitted",
    beverageCategory: data.beverageCategory,
    productName: data.productName,
    labels: data.labels,
    reviews: [],
    serverValidation: data.serverValidation,
    formFields: data.formFields,
  };
  submissions.unshift(submission);
  return submission;
}

/**
 * Replace label images on a submission (used by populate endpoint to swap
 * SVG placeholders with AI-generated images).
 */
export function updateSubmissionLabels(
  id: string,
  labelUpdates: Array<{ slotName: string; imageUrl: string }>,
): Submission | undefined {
  ensureSeeded();
  const sub = submissions.find((s) => s.id === id);
  if (!sub) return undefined;
  for (const update of labelUpdates) {
    const label = sub.labels.find((l) => l.slotName === update.slotName);
    if (label) {
      label.originalImageUrl = update.imageUrl;
      label.correctedImageUrl = update.imageUrl;
    }
  }
  sub.updatedAt = new Date().toISOString();
  return sub;
}

/** Update a submission's status (e.g. "in_review" → "approved"). */
export function updateSubmissionStatus(id: string, status: SubmissionStatus): Submission | undefined {
  ensureSeeded();
  const sub = submissions.find((s) => s.id === id);
  if (!sub) return undefined;
  sub.status = status;
  sub.updatedAt = new Date().toISOString();
  return sub;
}

/**
 * Append a review to a submission and auto-transition its status.
 *
 * Status transitions:
 *   approve        → "approved"
 *   reject         → "rejected"
 *   needs_revision → "needs_revision"
 *   escalate       → "in_review" (stays in review for senior agent)
 */
export function addReview(submissionId: string, review: ReviewRecord): Submission | undefined {
  ensureSeeded();
  const sub = submissions.find((s) => s.id === submissionId);
  if (!sub) return undefined;
  sub.reviews.push(review);
  // Auto-update status based on decision
  if (review.decision === "approve") sub.status = "approved";
  else if (review.decision === "reject") sub.status = "rejected";
  else if (review.decision === "needs_revision") sub.status = "needs_revision";
  else if (review.decision === "escalate") sub.status = "in_review"; // stays in review
  sub.updatedAt = new Date().toISOString();
  return sub;
}

// ---------------------------------------------------------------------------
// Mock Data Generator
// ---------------------------------------------------------------------------

/** Generate an ISO 8601 timestamp `n` days in the past with randomized work hours. */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60));
  return d.toISOString();
}

/**
 * Generate a data-URI SVG label placeholder image.
 *
 * Creates a styled card with the product name, label type, and extracted
 * field values — used as visual stand-ins for actual label artwork in
 * the mock seed data.
 */
function makeLabelSvg(
  bgColor: string,
  textColor: string,
  productName: string,
  labelType: string,
  fields: string[],
): string {
  const lines = fields
    .map(
      (f, i) =>
        `<text x="200" y="${130 + i * 24}" text-anchor="middle" font-size="13" fill="${textColor}" opacity="0.8">${f}</text>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect width="400" height="300" rx="12" fill="${bgColor}"/>
    <rect x="10" y="10" width="380" height="280" rx="8" fill="none" stroke="${textColor}" stroke-width="1" opacity="0.3"/>
    <text x="200" y="50" text-anchor="middle" font-size="22" font-weight="bold" fill="${textColor}">${productName}</text>
    <text x="200" y="80" text-anchor="middle" font-size="11" fill="${textColor}" opacity="0.5">${labelType}</text>
    <line x1="80" y1="95" x2="320" y2="95" stroke="${textColor}" opacity="0.2"/>
    ${lines}
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// Category-specific color schemes for SVG label placeholders
const COLOR_MAP: Record<BeverageCategory, [string, string]> = {
  spirits: ["#2d1b0e", "#d4a76a"],
  beer: ["#f5e6c8", "#5c3d1e"],
  wine: ["#3b0a1e", "#e8c4d0"],
};

/**
 * Build formFields (COLA application form data) from a product's expected fields.
 * Uses camelCase keys to match the Submission.formFields convention.
 * This simulates what the submitter would have entered on TTB Form 5100.31.
 */
function buildFormFields(product: SampleProduct): Record<string, string> {
  const ff: Record<string, string> = {};
  const front = product.expectedFrontFields;
  const back = product.expectedBackFields;
  if (front.brand_name) ff.brandName = front.brand_name;
  if (front.class_type) ff.classType = front.class_type;
  if (front.alcohol_content) ff.alcoholContent = front.alcohol_content;
  if (front.net_contents) ff.netContents = front.net_contents;
  if (front.appellation) ff.appellation = front.appellation;
  if (front.vintage_date) ff.vintageDate = front.vintage_date;
  if (front.varietal) ff.varietal = front.varietal;
  if (front.age_statement) ff.ageStatement = front.age_statement;
  if (back.name_address) ff.nameAddress = back.name_address;
  if (back.country_origin) ff.countryOfOrigin = back.country_origin;
  if (back.health_warning) ff.healthWarning = "GOVERNMENT WARNING: (1) According to the Surgeon General...";
  return ff;
}

/** Map checklist id to the expected-fields key */
function fieldKey(id: string): string {
  const map: Record<string, string> = {
    health_warning: "health_warning",
    name_address: "name_address",
    country_origin: "country_origin",
    sulfite_declaration: "sulfite_declaration",
    alcohol_content: "alcohol_content",
    net_contents: "net_contents",
    brand_name: "brand_name",
    class_type: "class_type",
    appellation: "appellation",
    vintage_date: "vintage_date",
    varietal: "varietal",
    age_statement: "age_statement",
  };
  return map[id] || id;
}

/** Build a SubmissionLabel from a product's expected fields */
function buildLabel(
  slotId: string,
  slotName: string,
  product: SampleProduct,
  side: "front" | "back",
  includeOcr: boolean,
): SubmissionLabel {
  const expected = side === "front" ? product.expectedFrontFields : product.expectedBackFields;
  const [bgC, txtC] = COLOR_MAP[product.category];

  // Build checklist items from expected fields
  const checklistIds = Object.keys(expected);
  const fieldTexts = checklistIds.map((id) => {
    const val = (expected as unknown as Record<string, string | undefined>)[id];
    const label = id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return val ? `${label}: ${val}` : label;
  });

  const imgUrl = makeLabelSvg(bgC, txtC, product.productName, slotName, fieldTexts.slice(0, 6));

  return {
    slotId,
    slotName,
    originalImageUrl: imgUrl,
    correctedImageUrl: imgUrl,
    checklist: checklistIds.map((id) => ({
      id,
      label: id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      description: "",
      appliesTo: [side] as ("front" | "back" | "any")[],
      categories: "all" as const,
      autoDetectable: "both" as const,
      mandatory: ["brand_name", "class_type", "net_contents", "health_warning", "name_address"].includes(id),
      extractable: true,
      status: "unchecked" as const,
      detectedValue: includeOcr ? (expected as unknown as Record<string, string | undefined>)[id] : undefined,
    })),
  };
}

/**
 * Generate 42 realistic mock submissions from the sampleData product catalog.
 *
 * Every submission has BOTH front and back labels. Most have no OCR
 * extracted fields yet — suitable for testing Tesseract.js field extraction.
 *
 * Status distribution (42 total):
 *   - 18 submitted (no OCR — Tesseract testing targets)
 *   - 5  in_review (with OCR)
 *   - 7  approved  (with review)
 *   - 5  rejected  (with review + specific CFR findings)
 *   - 7  needs_revision (with review + specific findings)
 */
function generateMockSubmissions(): Submission[] {
  const products = getSampleProducts();

  // Per-product overrides: status, submitter, daysAgo, review, OCR inclusion
  const overrides: Array<{
    status: SubmissionStatus;
    submitter: string;
    daysAgo: number;
    includeOcr: boolean;
    formFields?: Record<string, string>;
    review?: {
      decision: string;
      reviewer: string;
      notes: string;
      findings: ReviewFinding[];
    };
  }> = [
    // 0: Sierra Nevada Pale Ale — submitted, no OCR
    { status: "submitted", submitter: "Sierra Nevada Brewing Co.", daysAgo: 0, includeOcr: false },
    // 1: Dogfish Head 60 Minute IPA — submitted, no OCR
    { status: "submitted", submitter: "Dogfish Head Craft Brewery", daysAgo: 1, includeOcr: false },
    // 2: Goose Island Bourbon County Stout — in_review, with OCR
    { status: "in_review", submitter: "Anheuser-Busch InBev", daysAgo: 2, includeOcr: true },
    // 3: Blue Moon Belgian White — submitted, no OCR
    { status: "submitted", submitter: "Blue Moon Brewing Company", daysAgo: 0, includeOcr: false },
    // 4: Lagunitas IPNA — approved, with review
    {
      status: "approved", submitter: "Heineken USA Inc.", daysAgo: 5, includeOcr: true,
      review: {
        decision: "approve",
        reviewer: "Jenny Park",
        notes: "All fields match application. Non-alcoholic labeling is compliant.",
        findings: [],
      },
    },
    // 5: Robert Mondavi Cabernet — submitted, no OCR
    { status: "submitted", submitter: "Constellation Brands, Inc.", daysAgo: 0, includeOcr: false },
    // 6: Barefoot Moscato — submitted, no OCR
    { status: "submitted", submitter: "E. & J. Gallo Winery", daysAgo: 1, includeOcr: false },
    // 7: Kim Crawford Sauvignon Blanc — in_review, with OCR
    { status: "in_review", submitter: "Constellation Brands, Inc.", daysAgo: 3, includeOcr: true },
    // 8: Opus One — submitted, no OCR
    { status: "submitted", submitter: "Opus One Winery", daysAgo: 0, includeOcr: false },
    // 9: Jack Daniel's Tennessee Whiskey — submitted, no OCR
    { status: "submitted", submitter: "Brown-Forman Corporation", daysAgo: 1, includeOcr: false },
    // 10: Tito's Handmade Vodka — approved, with review
    {
      status: "approved", submitter: "Fifth Generation, Inc.", daysAgo: 7, includeOcr: true,
      review: {
        decision: "approve",
        reviewer: "Dave Morrison",
        notes: "Clean label, all fields verified. Approved.",
        findings: [],
      },
    },
    // 11: Hennessy V.S Cognac — submitted, no OCR
    { status: "submitted", submitter: "Moet Hennessy USA, Inc.", daysAgo: 0, includeOcr: false },
    // 12: Patron Silver Tequila — rejected, with review
    {
      status: "rejected", submitter: "The Patron Spirits Company", daysAgo: 4, includeOcr: true,
      formFields: {
        brandName: "Patron",
        classType: "Tequila Silver",
        alcoholContent: "40% Alc./Vol.",
        netContents: "750 mL",
      },
      review: {
        decision: "reject",
        reviewer: "Dave Morrison",
        notes: "Country of origin missing from back label. Required for imported product.",
        findings: [
          {
            checklistItemId: "country_origin",
            severity: "error",
            message: "Country of origin statement is required for imported spirits (27 CFR 5.63).",
          },
        ],
      },
    },
    // 13: Maker's Mark Bourbon — needs_revision, with review
    {
      status: "needs_revision", submitter: "Beam Suntory Inc.", daysAgo: 6, includeOcr: true,
      review: {
        decision: "needs_revision",
        reviewer: "Jenny Park",
        notes: "Government Warning uses title case instead of ALL CAPS. Must resubmit with corrected label.",
        findings: [
          {
            checklistItemId: "health_warning",
            severity: "error",
            message: '"Government Warning:" found in title case — must be "GOVERNMENT WARNING:" in ALL CAPS.',
          },
        ],
      },
    },
    // 14: Bell's Two Hearted Ale — submitted, no OCR
    { status: "submitted", submitter: "Bell's Brewery, Inc.", daysAgo: 0, includeOcr: false },
    // 15: Founders All Day IPA — submitted, no OCR
    { status: "submitted", submitter: "Founders Brewing Co.", daysAgo: 0, includeOcr: false },
    // 16: Yuengling Traditional Lager — submitted, no OCR
    { status: "submitted", submitter: "D.G. Yuengling & Son, Inc.", daysAgo: 0, includeOcr: false },
    // 17: New Belgium Fat Tire Amber Ale — submitted, no OCR
    { status: "submitted", submitter: "New Belgium Brewing Company", daysAgo: 0, includeOcr: false },
    // 18: Caymus Cabernet Sauvignon — submitted, no OCR
    { status: "submitted", submitter: "Caymus Vineyards", daysAgo: 1, includeOcr: false },
    // 19: Josh Cellars Chardonnay — submitted, no OCR
    { status: "submitted", submitter: "Deutsch Family Wine & Spirits", daysAgo: 1, includeOcr: false },
    // 20: Whispering Angel Rosé — needs_revision, with review
    {
      status: "needs_revision", submitter: "Sacha Lichine", daysAgo: 3, includeOcr: true,
      review: {
        decision: "needs_revision",
        reviewer: "Dave Morrison",
        notes: "Vintage date not visible on front label. Resubmit with legible date.",
        findings: [{ checklistItemId: "vintage_date", severity: "warning", message: "Vintage date is illegible or missing from front label." }],
      },
    },
    // 21: Woodford Reserve Double Oaked — in_review, with OCR
    { status: "in_review", submitter: "Brown-Forman Corporation", daysAgo: 2, includeOcr: true },
    // 22: Casamigos Blanco Tequila — approved, with review
    {
      status: "approved", submitter: "Diageo North America", daysAgo: 8, includeOcr: true,
      review: {
        decision: "approve",
        reviewer: "Jenny Park",
        notes: "All fields compliant. Approved.",
        findings: [],
      },
    },
    // 23: Grey Goose Vodka — submitted, no OCR
    { status: "submitted", submitter: "Bacardi Limited", daysAgo: 1, includeOcr: false },

    // ---- Expanded catalog (products 24–41) ----

    // 24: Samuel Adams Boston Lager — approved, clean domestic lager
    {
      status: "approved", submitter: "The Boston Beer Company", daysAgo: 10, includeOcr: true,
      review: {
        decision: "approve",
        reviewer: "Jenny Park",
        notes: "All mandatory fields present and compliant. ABV, net contents, and health warning verified.",
        findings: [],
      },
    },
    // 25: Guinness Draught Stout — rejected, missing importer statement
    {
      status: "rejected", submitter: "Diageo North America, Inc.", daysAgo: 5, includeOcr: true,
      formFields: {
        brandName: "Guinness",
        classType: "Stout",
        alcoholContent: "4.2% Alc. By Vol.",
        netContents: "14.9 FL OZ (440 mL)",
      },
      review: {
        decision: "reject",
        reviewer: "Dave Morrison",
        notes: "Back label is missing the mandatory 'Imported by' statement with US importer name and address. Required for all imported malt beverages under 27 CFR 7.63(b).",
        findings: [
          {
            checklistItemId: "name_address",
            severity: "error",
            message: "Imported product must show US importer name and address on the brand or back label (27 CFR 7.63(b)).",
          },
        ],
      },
    },
    // 26: Modelo Especial — needs_revision, net contents format issue
    {
      status: "needs_revision", submitter: "Crown Imports LLC", daysAgo: 3, includeOcr: true,
      formFields: {
        brandName: "Modelo",
        classType: "Pilsner-Style Lager",
        alcoholContent: "4.4% Alc. By Vol.",
        netContents: "355 mL",
      },
      review: {
        decision: "needs_revision",
        reviewer: "Jenny Park",
        notes: "Net contents shown in metric only (355 mL). Malt beverages sold in the US must show net contents in US customary measure, e.g., '12 FL OZ (355 mL)'. Resubmit with corrected label.",
        findings: [
          {
            checklistItemId: "net_contents",
            severity: "error",
            message: "Net contents must include US customary measure for malt beverages (27 CFR 7.70). '355 mL' alone is insufficient — must read '12 FL OZ (355 mL)'.",
          },
        ],
      },
    },
    // 27: Deschutes Fresh Squeezed IPA — submitted, no OCR
    { status: "submitted", submitter: "Deschutes Brewery", daysAgo: 0, includeOcr: false },
    // 28: Athletic Brewing Run Wild — in_review, non-alcoholic labeling under scrutiny
    { status: "in_review", submitter: "Athletic Brewing Company", daysAgo: 2, includeOcr: true },
    // 29: Kendall-Jackson Chardonnay — submitted, no OCR
    { status: "submitted", submitter: "Jackson Family Wines", daysAgo: 1, includeOcr: false },
    // 30: Silver Oak Cabernet — approved, clean premium domestic wine
    {
      status: "approved", submitter: "Silver Oak Cellars", daysAgo: 12, includeOcr: true,
      review: {
        decision: "approve",
        reviewer: "Dave Morrison",
        notes: "Appellation, varietal, vintage, and all mandatory fields verified. Sulfite declaration present. Approved.",
        findings: [],
      },
    },
    // 31: Santa Margherita Pinot Grigio — rejected, country of origin in Italian not English
    {
      status: "rejected", submitter: "Santa Margherita USA", daysAgo: 6, includeOcr: true,
      formFields: {
        brandName: "Santa Margherita",
        classType: "Pinot Grigio",
        alcoholContent: "Alcohol 12.5% by Volume",
        netContents: "750 mL",
      },
      review: {
        decision: "reject",
        reviewer: "Jenny Park",
        notes: "Country of origin reads 'Italia' instead of 'Italy'. TTB requires country of origin in English on US market labels (27 CFR 4.39(a)).",
        findings: [
          {
            checklistItemId: "country_origin",
            severity: "error",
            message: "Country of origin must be stated in English. Label shows 'Italia' — must read 'Italy' or 'Product of Italy' (27 CFR 4.39(a)).",
          },
        ],
      },
    },
    // 32: Cloudy Bay Sauvignon Blanc — needs_revision, sulfite declaration missing
    {
      status: "needs_revision", submitter: "Moet Hennessy USA, Inc.", daysAgo: 4, includeOcr: true,
      formFields: {
        brandName: "Cloudy Bay",
        classType: "Sauvignon Blanc",
        alcoholContent: "Alcohol 13.5% by Volume",
        netContents: "750 mL",
      },
      review: {
        decision: "needs_revision",
        reviewer: "Dave Morrison",
        notes: "Sulfite declaration ('Contains Sulfites') not found on either label. Required for all wines containing ≥10 ppm sulfites (27 CFR 4.32(e)). Resubmit with sulfite statement.",
        findings: [
          {
            checklistItemId: "sulfite_declaration",
            severity: "error",
            message: "Sulfite declaration required on wine labels containing ≥10 ppm SO₂ (27 CFR 4.32(e)). Statement not detected.",
          },
        ],
      },
    },
    // 33: Antinori Tignanello — in_review, imported Italian Super Tuscan
    { status: "in_review", submitter: "Ste. Michelle Wine Estates", daysAgo: 2, includeOcr: true },
    // 34: Buffalo Trace Bourbon — submitted, no OCR
    { status: "submitted", submitter: "Sazerac Company", daysAgo: 0, includeOcr: false },
    // 35: Wild Turkey 101 — rejected, proof statement format non-compliant
    {
      status: "rejected", submitter: "Campari Group", daysAgo: 7, includeOcr: true,
      formFields: {
        brandName: "Wild Turkey",
        classType: "Kentucky Straight Bourbon Whiskey",
        alcoholContent: "101 Proof",
        netContents: "750 mL",
      },
      review: {
        decision: "reject",
        reviewer: "Jenny Park",
        notes: "Alcohol content stated as '101 Proof' only. Spirits labels must show percentage alcohol by volume, e.g., '50.5% Alc./Vol. (101 Proof)'. Proof alone is not sufficient under 27 CFR 5.63(a).",
        findings: [
          {
            checklistItemId: "alcohol_content",
            severity: "error",
            message: "Alcohol content must be stated as percentage by volume. '101 Proof' alone does not satisfy 27 CFR 5.63(a). Must read '50.5% Alc./Vol. (101 Proof)'.",
          },
        ],
      },
    },
    // 36: Hendrick's Gin — approved, imported gin compliant
    {
      status: "approved", submitter: "William Grant & Sons, Inc.", daysAgo: 9, includeOcr: true,
      review: {
        decision: "approve",
        reviewer: "Dave Morrison",
        notes: "Country of origin, importer statement, ABV, and all mandatory fields verified. Label is compliant.",
        findings: [],
      },
    },
    // 37: Bacardi Superior White Rum — submitted, no OCR
    { status: "submitted", submitter: "Bacardi Corporation", daysAgo: 0, includeOcr: false },
    // 38: Don Julio Blanco — needs_revision, class designation incomplete
    {
      status: "needs_revision", submitter: "Diageo North America", daysAgo: 5, includeOcr: true,
      formFields: {
        brandName: "Don Julio",
        classType: "Tequila",
        alcoholContent: "40% Alc./Vol. (80 Proof)",
        netContents: "750 mL",
      },
      review: {
        decision: "needs_revision",
        reviewer: "Jenny Park",
        notes: "Class/type designation reads 'Tequila' but TTB Form 5100.31 application specifies 'Tequila Blanco'. Label must match the approved class/type on the COLA application (27 CFR 5.55).",
        findings: [
          {
            checklistItemId: "class_type",
            severity: "warning",
            message: "Class/type on label ('Tequila') does not match COLA application ('Tequila Blanco'). Must be consistent per 27 CFR 5.55.",
          },
        ],
      },
    },
    // 39: Johnnie Walker Black Label — submitted, no OCR
    { status: "submitted", submitter: "Diageo North America", daysAgo: 1, includeOcr: false },
    // 40: The Macallan 12 Year — rejected, age statement discrepancy
    {
      status: "rejected", submitter: "The Edrington Group USA", daysAgo: 8, includeOcr: true,
      formFields: {
        brandName: "The Macallan",
        classType: "Single Malt Scotch Whisky",
        alcoholContent: "43% Alc./Vol. (86 Proof)",
        netContents: "750 mL",
      },
      review: {
        decision: "reject",
        reviewer: "Dave Morrison",
        notes: "Age statement reads '12 Years' but batch analysis indicates components younger than 12 years. Age statement must reflect the youngest whisky in the blend (27 CFR 5.74). Rejected pending reformulation or label correction.",
        findings: [
          {
            checklistItemId: "age_statement",
            severity: "error",
            message: "Age statement '12 Years' may be misleading if youngest component is under 12 years. Must reflect youngest whisky in bottle (27 CFR 5.74).",
          },
          {
            checklistItemId: "country_origin",
            severity: "warning",
            message: "Country of origin shown as 'Scotland' — TTB prefers full country name 'United Kingdom' or 'Product of Scotland, United Kingdom'.",
          },
        ],
      },
    },
    // 41: Jameson Irish Whiskey — approved, compliant import
    {
      status: "approved", submitter: "Pernod Ricard USA", daysAgo: 11, includeOcr: true,
      review: {
        decision: "approve",
        reviewer: "Jenny Park",
        notes: "All fields compliant. Country of origin, importer statement, health warning, and class/type verified. Approved.",
        findings: [],
      },
    },
  ];

  return products.map((product, idx) => {
    const o = overrides[idx] || { status: "submitted", submitter: "Unknown", daysAgo: 0, includeOcr: false };
    const created = daysAgo(o.daysAgo);

    const frontLabel = buildLabel(`slot-${idx}-0`, "Front Label", product, "front", o.includeOcr);
    const backLabel = buildLabel(`slot-${idx}-1`, "Back Label", product, "back", o.includeOcr);

    // Build OCR results map from expected fields if OCR is included
    let serverValidation: Submission["serverValidation"];
    if (o.includeOcr) {
      const ocrResults: Record<string, string> = {};
      for (const [k, v] of Object.entries(product.expectedFrontFields)) {
        if (v) ocrResults[k] = v;
      }
      for (const [k, v] of Object.entries(product.expectedBackFields)) {
        if (v) ocrResults[k] = v;
      }
      serverValidation = { completedAt: created, findings: [], ocrResults };
    }

    const sub: Submission = {
      id: `SUB-${(1000 + idx).toString(36).toUpperCase()}`,
      submitterId: o.submitter,
      createdAt: created,
      updatedAt: created,
      status: o.status,
      beverageCategory: product.category,
      productName: product.productName,
      labels: [frontLabel, backLabel],
      reviews: [],
      serverValidation,
      formFields: o.formFields || buildFormFields(product),
    };

    if (o.review) {
      sub.reviews.push({
        id: `REV-${idx}`,
        submissionId: sub.id,
        reviewerId: o.review.reviewer,
        startedAt: created,
        completedAt: new Date(new Date(created).getTime() + 300_000).toISOString(),
        activeSeconds: 180 + Math.floor(Math.random() * 120),
        decision: o.review.decision as ReviewRecord["decision"],
        findings: o.review.findings,
        notes: o.review.notes,
        reviewType: "primary",
      });
    }

    return sub;
  });
}
