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
 * Vercel Blob CDN base URL for TTB label images.
 * Images are stored as ttb-labels/{ttbId}-{N}.png in the Blob store.
 */
const BLOB_BASE = "https://rcptligvu3vbkguv.public.blob.vercel-storage.com/ttb-labels";

/**
 * Real TTB COLA label images scraped from ttbonline.gov and cropped to
 * individual labels. The numbers are label indices from the COLA form page.
 *
 * Array order determines assignment:
 *   - First element  → Front Label
 *   - Second element → Back Label
 *   - Third+ elements → Other Label N
 */
const TTB_LABEL_IMAGES: Record<string, number[]> = {
  "23312001000445": [1, 2],  // CRAFTED CASK
  "23356001000155": [2],  // DOGFISH HEAD
  "24003001000001": [2, 3],  // 813
  "24003001000078": [2],  // KÜNSTLER BREWING
  "24003001000085": [2],  // PHANTASM
  "24003001000113": [2],  // BURIAL BEER CO.
  "24003001000169": [2, 3, 4],  // BARLEY & BOAR
  "24003001000190": [1, 2],  // CHANDLER PLAZA
  "24003001000200": [1, 2],  // CIMINO
  "24003001000225": [2, 3],  // THE EDGE
  "24003001000281": [2],  // ONDA
  "24003001000325": [3, 2],  // CRAIG AND CARLA HAWKINS (3=front artwork, 2=info/back)
  "24003001000330": [2, 3],  // RUTHERFORD HILL
  "24003001000350": [2],  // CAMP FUEL
  "24003001000393": [1, 2],  // TENUTA MARA
  "24003001000414": [1],  // LOGYARD BREWING
  "24003001000421": [2, 3],  // LONGHORN CELLARS
  "24003001000477": [1],  // TRISKELION
  "24003001000484": [1],  // CERVEZA COMPLICE
  "24003001000525": [1],  // SAVE ME #1
  "24003001000561": [2],  // ECLIPSE
  "24003001000582": [1],  // HOPFLY BREWING COMPANY
  "24003001000600": [1, 2],  // ARTHUR'S GRAND RESERVE
  "24003001000638": [2],  // HOPS N DROPS
  "24003001000645": [1],  // SIERRA NEVADA
  "24003001000666": [3, 2],  // LASORDA FAMILY WINES (3=front artwork, 2=info/back)
  "24003001000700": [2, 3],  // FILO DE TRINCHERA MEZCAL ARTESANAL
  "24003001000701": [1],  // HOP BUTCHER FOR THE WORLD
  "24003001000715": [2, 3],  // GRAPE BEGINNINGS WINERY
  "24003001000736": [2, 3],  // CAT WHISKERS
  "24012001000123": [1],  // LAS PERDICES
  "24012001000345": [2],  // STRATA DATA
  "24012001000567": [2, 3, 4],  // PA'LANTE
  "24012001000891": [1],  // CELLARMAKER BREWING CO
  "24023001000345": [1, 2],  // SHAMROCK HILLS VINEYARD AND WINERY
  "24023001000567": [1, 2],  // TENUTE CAPALDO
  "24023001000678": [2, 3],  // DE TIERRA
  "24034001000123": [1, 2],  // LUNA HART
  "24045001000123": [1],  // HUMMDINGER
  "24045001000234": [2, 3, 4],  // TURKS HEAD
  "24045001000567": [3, 2],  // LE FRAGHE (3=front artwork, 2=info/back)
  "24045001000891": [1, 2, 3, 4],  // BEATBOX
  "24067001000456": [2, 3],  // DOC SWINSON'S
  "24078001000345": [1, 2],  // ANNE DE K
  "24078001000678": [2, 3],  // MANOIR DU CARRA
  "24078001000891": [2, 3, 4, 5],  // WINE CONNOISSEUR
  "24089001000156": [2],  // DOMAINE CHANTEPIERRE
  "24089001000456": [2, 3],  // DOMAINE DES FLORETS
  "24089001000678": [2],  // LOST CAUSE MEADERY
  "25335001000029": [1, 2],  // VOLADA
  "25335001000078": [1],  // 450 NORTH BREWING CO.
  "25335001000085": [1],  // AMERICAN SOLERA
  "25335001000169": [2],  // FREE WILL BREWING
  "25335001000197": [1],  // CZECH 10°
  "25335001000267": [1],  // LAMPLIGHTER BREWING CO.
  "25335001000295": [2, 3],  // POINT
  "25335001000316": [2],  // RAPID LIBERTIES HAZY DIPA
  "25335001000325": [1],  // BOREAL DAWN BLACK IPA
  "25335001000386": [1],  // FOCAL POINT
  "25335001000393": [1, 2],  // CUPCAKE
  "25335001000421": [1],  // NICE SIZED MOUNTAINS
  "25335001000428": [1],  // OUT OF ORDER: HERE GOES NOTHING
  "25335001000463": [1, 2],  // MONSIER GENUINE BLACK
  "25335001000484": [1, 2],  // HERITAGE
  "25335001000491": [3, 2],  // LAVANTI (3=front artwork, 2=info/back)
  "25335001000533": [1, 2, 3],  // CAIAROSSA
  "25335001000547": [1],  // MOTH:
  "25335001000561": [3, 2],  // SENORIO DE ODON (3=front artwork, 2=info/back)
  "25335001000603": [1],  // EMCEE
  "25335001000624": [2, 3],  // LA SOUFFRANDIERE
  "25335001000650": [2, 3],  // AMATECO
  "25335001000652": [2, 3],  // CASCADIA MANOR
  "25335001000666": [2, 3],  // CHAMBERS
  "25335001000694": [2],  // SOLE PURPOSE CASCADE
  "25335001000708": [2],  // SAN FELICE
  "25335001000736": [1, 2],  // L'OUVERTURE
  "25335001000820": [2],  // MAC & JACKS BREWING CO.
  "25335001000850": [1, 2],  // TUPPS SPIRITS
  "25335001000875": [1],  // FOUR HOUNDS DISTILLING
  "25335001000932": [1, 2],  // L'ECU
  "25335001000946": [1],  // MADWOMAN
  "25335001000960": [3, 2],  // DAISY CREEK (3=front artwork, 2=info/back)
  "25335001000981": [1, 2],  // NEW BELGIUM
  "25335001000995": [1, 2, 3],  // THE REVERIES
  "25336001000162": [1],  // TENNESSEE SHINE CO
  "25336001000302": [1, 2, 3],  // MAHOGANY FOX
  "25336001000456": [1, 2],  // ELEVACION
  "25338001000250": [1, 2],  // PADDY
  "25338001000428": [1, 2, 3],  // CASA LAS JARAS
};

/**
 * Load persisted Blob URLs from the manifest and apply them to matching
 * submissions. Also applies real TTB label images for submissions whose
 * TTB ID has scraped images in /public/ttb-labels/.
 *
 * Called lazily on first getAllSubmissions / getSubmission if
 * not already applied, and eagerly after populate generates new images.
 */
export async function applyManifestToSubmissions(): Promise<number> {
  ensureSeeded();

  // 1. Apply real TTB label images to all submissions
  const products = getSampleProducts();
  let ttbApplied = 0;
  for (const sub of submissions) {
    const product = products.find((p) => p.productName === sub.productName);
    if (!product) continue;
    const labelNums = TTB_LABEL_IMAGES[product.ttbId];
    if (!labelNums || labelNums.length === 0) continue;

    const front = sub.labels.find((l) => l.slotName === "Front Label");
    const back = sub.labels.find((l) => l.slotName === "Back Label");

    // Array order determines assignment: [0]=front, [1]=back, [2+]=other
    if (front && labelNums.length >= 1) {
      const url = `${BLOB_BASE}/${product.ttbId}-${labelNums[0]}.png`;
      front.originalImageUrl = url;
      front.correctedImageUrl = url;
    }
    if (back && labelNums.length >= 2) {
      const url = `${BLOB_BASE}/${product.ttbId}-${labelNums[1]}.png`;
      back.originalImageUrl = url;
      back.correctedImageUrl = url;
    }
    // Assign URLs to "Other Label N" slots (3rd+ images)
    for (let li = 2; li < labelNums.length; li++) {
      const otherLabel = sub.labels.find((l) => l.slotName === `Other Label ${li - 1}`);
      if (otherLabel) {
        const url = `${BLOB_BASE}/${product.ttbId}-${labelNums[li]}.png`;
        otherLabel.originalImageUrl = url;
        otherLabel.correctedImageUrl = url;
      }
    }
    ttbApplied++;
  }

  // 2. Apply Blob manifest URLs (AI-generated images) for remaining products
  const manifest = await loadManifest();
  let blobApplied = 0;
  if (manifest) {
    for (const entry of manifest.labels) {
      const sub = submissions.find((s) => s.productName === entry.productName);
      if (!sub) continue;
      const product = products.find((p) => p.productName === sub.productName);
      const hasTtbImage = product && product.ttbId in TTB_LABEL_IMAGES;
      // Don't overwrite TTB label images with AI-generated ones
      const front = sub.labels.find((l) => l.slotName === "Front Label");
      const back = sub.labels.find((l) => l.slotName === "Back Label");
      if (front && !hasTtbImage) {
        front.originalImageUrl = entry.frontUrl;
        front.correctedImageUrl = entry.frontUrl;
      }
      if (back && !(hasTtbImage && TTB_LABEL_IMAGES[product!.ttbId]?.includes(2))) {
        back.originalImageUrl = entry.backUrl;
        back.correctedImageUrl = entry.backUrl;
      }
      blobApplied++;
    }
  }

  manifestApplied = true;
  return ttbApplied + blobApplied;
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
  if (back.health_warning) ff.healthWarning = back.health_warning;
  if (back.sulfite_declaration) ff.sulfiteDeclaration = back.sulfite_declaration;
  if (back.color_ingredients) ff.colorIngredients = back.color_ingredients;
  if (back.commodity_statement) ff.commodityStatement = back.commodity_statement;
  if (back.aspartame_declaration) ff.aspartameDeclaration = back.aspartame_declaration;
  // Also check front label for these fields (can appear on either)
  if (!ff.sulfiteDeclaration && front.sulfite_declaration) ff.sulfiteDeclaration = front.sulfite_declaration;
  if (!ff.colorIngredients && front.color_ingredients) ff.colorIngredients = front.color_ingredients;
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
    color_ingredients: "color_ingredients",
    commodity_statement: "commodity_statement",
    aspartame_declaration: "aspartame_declaration",
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
 * Submission catalog — the single source of truth for all mock submissions.
 *
 * Each entry references a product by ttbId (from sampleData.ts) and defines
 * the submission's status, submitter, and optional review data. No index
 * coupling — entries can be added, removed, or reordered freely.
 *
 * Every product has real TTB label images in /public/ttb-labels/.
 *
 * Status distribution (49 total):
 *   - 19 submitted   (pending review — to-do queue)
 *   - 8  in_review   (assigned, being examined)
 *   - 10 approved    (passed all checks)
 *   - 6  rejected    (failed compliance, specific CFR findings)
 *   - 6  needs_revision (fixable issues, resubmission required)
 */
interface SubmissionDef {
  ttbId: string;
  status: SubmissionStatus;
  submitter: string;
  daysAgo: number;
  review?: {
    decision: string;
    reviewer: string;
    notes: string;
    findings: ReviewFinding[];
  };
}

const SUBMISSIONS: SubmissionDef[] = [
  // ── Beer ────────────────────────────────────────────────────────────────
  { ttbId: "24003001000484", status: "submitted", submitter: "Cerveza Complice LLC", daysAgo: 0 },
  { ttbId: "24003001000638", status: "submitted", submitter: "Hops N Drops Brewing LLC", daysAgo: 0 },
  { ttbId: "24003001000414", status: "needs_revision", submitter: "Logyard Brewing Co.", daysAgo: 6,
    review: { decision: "needs_revision", reviewer: "Jenny Park",
      notes: "Government Warning uses title case instead of ALL CAPS. Must resubmit with corrected label.",
      findings: [{ checklistItemId: "health_warning", severity: "error", message: "\"Government Warning:\" found in title case — must be \"GOVERNMENT WARNING:\" in ALL CAPS per TTB regulations." }] } },
  { ttbId: "24003001000582", status: "in_review", submitter: "Hopfly Brewing Company", daysAgo: 2 },
  { ttbId: "24003001000078", status: "submitted", submitter: "Künstler Brewing LLC", daysAgo: 1 },
  { ttbId: "23356001000155", status: "approved", submitter: "Dogfish Head Craft Brewery", daysAgo: 10,
    review: { decision: "approve", reviewer: "Jenny Park",
      notes: "All mandatory fields present and compliant. ABV, net contents, and health warning verified.", findings: [] } },
  { ttbId: "24003001000645", status: "in_review", submitter: "Sierra Nevada Brewing Co.", daysAgo: 2 },
  { ttbId: "24012001000345", status: "needs_revision", submitter: "Steele Hall Brewing Co.", daysAgo: 4,
    review: { decision: "needs_revision", reviewer: "Dave Morrison",
      notes: "Class/type on label reads 'IPA' but COLA application specifies 'India Pale Ale'. Must be consistent per 27 CFR 7.24.",
      findings: [{ checklistItemId: "class_type", severity: "warning", message: "Class/type on label ('IPA') does not match COLA application ('India Pale Ale'). Must be consistent per 27 CFR 7.24." }] } },
  { ttbId: "24012001000891", status: "in_review", submitter: "Cellarmaker Brewing Co.", daysAgo: 3 },
  { ttbId: "24045001000123", status: "approved", submitter: "Rubber Soul Brewing Co.", daysAgo: 8,
    review: { decision: "approve", reviewer: "Dave Morrison",
      notes: "Clean label, all fields verified. Approved.", findings: [] } },
  { ttbId: "24045001000891", status: "submitted", submitter: "BeatBox Beverages LLC", daysAgo: 0 },
  // New beer
  { ttbId: "24003001000113", status: "in_review", submitter: "Burial Beer Co.", daysAgo: 2 },
  { ttbId: "24003001000477", status: "submitted", submitter: "Triskelion Brewing Co.", daysAgo: 0 },
  { ttbId: "24003001000525", status: "approved", submitter: "Save Me Brewing LLC", daysAgo: 9,
    review: { decision: "approve", reviewer: "Jenny Park",
      notes: "All mandatory fields compliant. Health warning, ABV, net contents verified.", findings: [] } },
  { ttbId: "24003001000701", status: "submitted", submitter: "Hop Butcher Brewing Co.", daysAgo: 1 },
  // New beer (batch 2)
  { ttbId: "25335001000078", status: "submitted", submitter: "450 North Brewing Co.", daysAgo: 0 },
  { ttbId: "25335001000085", status: "in_review", submitter: "American Solera Brewing", daysAgo: 2 },
  { ttbId: "25335001000197", status: "approved", submitter: "Czech Import Group LLC", daysAgo: 9,
    review: { decision: "approve", reviewer: "Jenny Park",
      notes: "All mandatory fields present. ABV, net contents, health warning verified. Approved.", findings: [] } },
  { ttbId: "25335001000267", status: "submitted", submitter: "Lamplighter Brewing Co.", daysAgo: 1 },
  { ttbId: "25335001000325", status: "needs_revision", submitter: "Boreal Dawn Brewing LLC", daysAgo: 4,
    review: { decision: "needs_revision", reviewer: "Dave Morrison",
      notes: "Health warning text uses title case. Must be 'GOVERNMENT WARNING:' in ALL CAPS per TTB regulations.",
      findings: [{ checklistItemId: "health_warning", severity: "error", message: "\"Government Warning:\" must be in ALL CAPS per TTB regulations." }] } },
  { ttbId: "25335001000386", status: "in_review", submitter: "Focal Point Brewing Co.", daysAgo: 3 },
  { ttbId: "25335001000603", status: "submitted", submitter: "Emcee Brewing LLC", daysAgo: 0 },
  { ttbId: "25335001000981", status: "approved", submitter: "New Belgium Brewing Co.", daysAgo: 11,
    review: { decision: "approve", reviewer: "Dave Morrison",
      notes: "Clean label, all fields verified. Approved.", findings: [] } },

  // ── Wine ────────────────────────────────────────────────────────────────
  { ttbId: "24012001000123", status: "approved", submitter: "Las Perdices Winery", daysAgo: 12,
    review: { decision: "approve", reviewer: "Jenny Park",
      notes: "Country of origin, importer statement, sulfite declaration, and all mandatory fields verified. Approved.", findings: [] } },
  { ttbId: "24023001000345", status: "needs_revision", submitter: "Shamrock Hills Vineyard and Winery", daysAgo: 3,
    review: { decision: "needs_revision", reviewer: "Dave Morrison",
      notes: "Vintage date not visible on front label. Resubmit with legible date.",
      findings: [{ checklistItemId: "vintage_date", severity: "warning", message: "Vintage date is illegible or missing from front label." }] } },
  { ttbId: "24023001000567", status: "rejected", submitter: "Tenute Capaldo S.r.l.", daysAgo: 6,
    review: { decision: "reject", reviewer: "Jenny Park",
      notes: "Country of origin reads 'Italia' instead of 'Italy'. TTB requires country of origin in English on US market labels (27 CFR 4.39(a)).",
      findings: [{ checklistItemId: "country_origin", severity: "error", message: "Country of origin must be stated in English. Label shows 'Italia' — must read 'Italy' or 'Product of Italy' (27 CFR 4.39(a))." }] } },
  { ttbId: "24023001000678", status: "needs_revision", submitter: "De Tierra Vineyards", daysAgo: 4,
    review: { decision: "needs_revision", reviewer: "Jenny Park",
      notes: "Net contents shown in metric only. Wine labels must include US customary measure. Resubmit with corrected label.",
      findings: [{ checklistItemId: "net_contents", severity: "error", message: "Net contents must include US customary measure (27 CFR 4.37). Metric-only is insufficient." }] } },
  { ttbId: "24034001000123", status: "submitted", submitter: "Luna Hart Wines", daysAgo: 0 },
  { ttbId: "24045001000234", status: "in_review", submitter: "Turks Head Vineyards", daysAgo: 2 },
  { ttbId: "24045001000567", status: "submitted", submitter: "Le Fraghe Winery", daysAgo: 1 },
  { ttbId: "24078001000345", status: "approved", submitter: "Anne De K Wines", daysAgo: 9,
    review: { decision: "approve", reviewer: "Dave Morrison",
      notes: "Appellation, varietal, vintage, and all mandatory fields verified. Sulfite declaration present. Approved.", findings: [] } },
  { ttbId: "24078001000678", status: "submitted", submitter: "Manoir Du Carra", daysAgo: 0 },
  { ttbId: "24078001000891", status: "rejected", submitter: "Wine Connoisseur LLC", daysAgo: 5,
    review: { decision: "reject", reviewer: "Dave Morrison",
      notes: "Sulfite declaration ('Contains Sulfites') not found on either label. Required for all wines containing ≥10 ppm sulfites (27 CFR 4.32(e)).",
      findings: [{ checklistItemId: "sulfite_declaration", severity: "error", message: "Sulfite declaration required on wine labels containing ≥10 ppm SO₂ (27 CFR 4.32(e)). Statement not detected." }] } },
  { ttbId: "24089001000156", status: "submitted", submitter: "Domaine Chantepierre", daysAgo: 0 },
  { ttbId: "24089001000456", status: "submitted", submitter: "Domaine Des Florets", daysAgo: 1 },
  { ttbId: "24089001000678", status: "rejected", submitter: "Lost Cause Meadery LLC", daysAgo: 5,
    review: { decision: "reject", reviewer: "Jenny Park",
      notes: "Alcohol content stated as '14% ABV'. Wine labels must spell out 'Alcohol XX% by Volume' per 27 CFR 4.36(a).",
      findings: [{ checklistItemId: "alcohol_content", severity: "error", message: "Alcohol content must be stated as 'Alcohol XX% by Volume' on wine labels (27 CFR 4.36(a)). Abbreviation '14% ABV' is non-compliant." }] } },
  // New wine
  { ttbId: "24003001000190", status: "approved", submitter: "Chandler Plaza Winery", daysAgo: 7,
    review: { decision: "approve", reviewer: "Jenny Park",
      notes: "All fields compliant. Domestic wine, sulfite declaration present. Approved.", findings: [] } },
  { ttbId: "24003001000200", status: "submitted", submitter: "Cimino Wine Estates", daysAgo: 0 },
  { ttbId: "24003001000325", status: "in_review", submitter: "Craig and Carla Hawkins Wines", daysAgo: 2 },
  { ttbId: "24003001000330", status: "approved", submitter: "Rutherford Hill Winery", daysAgo: 11,
    review: { decision: "approve", reviewer: "Dave Morrison",
      notes: "Napa Valley appellation, vintage, varietal, and all mandatory fields verified. Approved.", findings: [] } },
  { ttbId: "24003001000393", status: "submitted", submitter: "Tenuta Mara Wines", daysAgo: 1 },
  { ttbId: "24003001000421", status: "needs_revision", submitter: "Longhorn Cellars", daysAgo: 4,
    review: { decision: "needs_revision", reviewer: "Dave Morrison",
      notes: "Net contents format non-compliant. Must include both metric and US customary measure.",
      findings: [{ checklistItemId: "net_contents", severity: "error", message: "Net contents must include US customary measure (27 CFR 4.37). Metric-only is insufficient." }] } },
  { ttbId: "24003001000600", status: "submitted", submitter: "Arthur's Grand Reserve Winery", daysAgo: 0 },
  { ttbId: "24003001000666", status: "rejected", submitter: "Lasorda Family Wines LLC", daysAgo: 6,
    review: { decision: "reject", reviewer: "Jenny Park",
      notes: "Sulfite declaration missing. Required for all wines containing ≥10 ppm SO₂ (27 CFR 4.32(e)).",
      findings: [{ checklistItemId: "sulfite_declaration", severity: "error", message: "Sulfite declaration required for wines containing ≥10 ppm SO₂ (27 CFR 4.32(e)). Not detected on label." }] } },
  { ttbId: "24003001000715", status: "submitted", submitter: "Grape Beginnings Winery", daysAgo: 0 },
  { ttbId: "24003001000225", status: "in_review", submitter: "The Edge Wines", daysAgo: 3 },

  // ── Spirits ─────────────────────────────────────────────────────────────
  { ttbId: "23312001000445", status: "approved", submitter: "Crafted Cask Distillery", daysAgo: 11,
    review: { decision: "approve", reviewer: "Jenny Park",
      notes: "All fields compliant. Class/type, ABV, health warning, and name/address verified. Approved.", findings: [] } },
  { ttbId: "24012001000567", status: "rejected", submitter: "Park Street Imports, Miami FL", daysAgo: 7,
    review: { decision: "reject", reviewer: "Dave Morrison",
      notes: "Country of origin 'Product of Mexico' present on back label but missing from front. Imported spirits must display country of origin conspicuously (27 CFR 5.63(b)).",
      findings: [{ checklistItemId: "country_origin", severity: "error", message: "Country of origin must appear conspicuously on the brand label for imported spirits (27 CFR 5.63(b))." }] } },
  { ttbId: "24067001000456", status: "submitted", submitter: "Doc Swinson's Distillery", daysAgo: 0 },
  // New spirits
  { ttbId: "24003001000001", status: "approved", submitter: "813 Spirits LLC", daysAgo: 10,
    review: { decision: "approve", reviewer: "Dave Morrison",
      notes: "ABV, health warning, class/type, and name/address all compliant. Approved.", findings: [] } },
  { ttbId: "24003001000085", status: "submitted", submitter: "Phantasm Spirits Co.", daysAgo: 0 },
  { ttbId: "24003001000169", status: "needs_revision", submitter: "Barley & Boar Distillery", daysAgo: 5,
    review: { decision: "needs_revision", reviewer: "Jenny Park",
      notes: "Age statement on label reads '2 Years' but must specify type of container per 27 CFR 5.74.",
      findings: [{ checklistItemId: "age_statement", severity: "warning", message: "Age statement must include type of container (e.g., 'Aged 2 Years in Oak Barrels') per 27 CFR 5.74." }] } },
  { ttbId: "24003001000281", status: "submitted", submitter: "Onda Spirits Inc.", daysAgo: 1 },
  { ttbId: "24003001000350", status: "approved", submitter: "Camp Fuel Spirits LLC", daysAgo: 8,
    review: { decision: "approve", reviewer: "Jenny Park",
      notes: "All mandatory fields present. Health warning, ABV, net contents verified. Approved.", findings: [] } },
  { ttbId: "24003001000561", status: "in_review", submitter: "Eclipse Distilling Co.", daysAgo: 2 },
  { ttbId: "24003001000700", status: "submitted", submitter: "Filo De Trinchera Mezcal", daysAgo: 0 },
  { ttbId: "24003001000736", status: "rejected", submitter: "Cat Whiskers Moonshine LLC", daysAgo: 4,
    review: { decision: "reject", reviewer: "Dave Morrison",
      notes: "Importer name and address missing. Required for all imported spirits (27 CFR 5.63(b)).",
      findings: [{ checklistItemId: "name_address", severity: "error", message: "Importer name and address required on imported spirits labels (27 CFR 5.63(b)). Not found on label." }] } },
  // New spirits (batch 2)
  { ttbId: "25335001000029", status: "submitted", submitter: "Volada Spirits LLC", daysAgo: 0 },
  { ttbId: "25335001000463", status: "in_review", submitter: "Monsier Genuine Black Distillery", daysAgo: 2 },
  { ttbId: "25335001000484", status: "approved", submitter: "Heritage Distilling Co.", daysAgo: 8,
    review: { decision: "approve", reviewer: "Jenny Park",
      notes: "ABV, health warning, class/type, and name/address all compliant. Approved.", findings: [] } },
  { ttbId: "25335001000547", status: "submitted", submitter: "Moth Cocktails Inc.", daysAgo: 1 },
  { ttbId: "25335001000850", status: "needs_revision", submitter: "Tupps Spirits LLC", daysAgo: 5,
    review: { decision: "needs_revision", reviewer: "Dave Morrison",
      notes: "Alcohol content must be stated as percentage by volume. Current format non-compliant.",
      findings: [{ checklistItemId: "alcohol_content", severity: "error", message: "Alcohol content must be stated as percentage by volume (27 CFR 5.63(a))." }] } },
  { ttbId: "25335001000875", status: "submitted", submitter: "Four Hounds Distilling LLC", daysAgo: 0 },
  { ttbId: "25335001000946", status: "rejected", submitter: "Madwoman Spirits Co.", daysAgo: 6,
    review: { decision: "reject", reviewer: "Jenny Park",
      notes: "Net contents not stated in US customary measure. Required per 27 CFR 5.67.",
      findings: [{ checklistItemId: "net_contents", severity: "error", message: "Net contents must include US customary measure (27 CFR 5.67)." }] } },
  { ttbId: "25336001000162", status: "submitted", submitter: "Tennessee Shine Co.", daysAgo: 0 },
  { ttbId: "25336001000302", status: "approved", submitter: "Mahogany Fox Spirits", daysAgo: 10,
    review: { decision: "approve", reviewer: "Dave Morrison",
      notes: "All mandatory fields present and compliant. Approved.", findings: [] } },
  { ttbId: "25336001000456", status: "needs_revision", submitter: "Elevacion Tequila LLC", daysAgo: 3,
    review: { decision: "needs_revision", reviewer: "Jenny Park",
      notes: "Country of origin statement missing. Required for imported tequila (27 CFR 5.63(b)).",
      findings: [{ checklistItemId: "country_origin", severity: "error", message: "Country of origin must appear on imported spirits labels (27 CFR 5.63(b))." }] } },
  { ttbId: "25338001000250", status: "submitted", submitter: "Irish Distillers International", daysAgo: 1 },
  { ttbId: "25338001000428", status: "in_review", submitter: "Casa Las Jaras Tequila S.A.", daysAgo: 2 },
];

function generateMockSubmissions(): Submission[] {
  const products = getSampleProducts();

  return SUBMISSIONS.map((def, idx) => {
    const product = products.find((p) => p.ttbId === def.ttbId);
    if (!product) return null;

    const includeOcr = true;
    const created = daysAgo(def.daysAgo);

    const frontLabel = buildLabel(`slot-${idx}-0`, "Front Label", product, "front", includeOcr);
    // Only include a back label when the product has ≥2 real label images.
    // Single-label products (common for beer) should show "No Back Label Provided".
    const realLabelCount = TTB_LABEL_IMAGES[product.ttbId]?.length ?? 0;
    const labels = [frontLabel];
    if (realLabelCount >= 2) {
      labels.push(buildLabel(`slot-${idx}-1`, "Back Label", product, "back", includeOcr));
    }
    // Additional labels (3rd, 4th, ...) get "Other Label N" names
    for (let li = 2; li < realLabelCount; li++) {
      labels.push(buildLabel(`slot-${idx}-${li}`, `Other Label ${li - 1}`, product, "back", false));
    }

    // Build OCR results map from expected fields
    const ocrResults: Record<string, string> = {};
    for (const [k, v] of Object.entries(product.expectedFrontFields)) {
      if (v) ocrResults[k] = v;
    }
    for (const [k, v] of Object.entries(product.expectedBackFields)) {
      if (v) ocrResults[k] = v;
    }

    const sub: Submission = {
      id: `SUB-${(1000 + idx).toString(36).toUpperCase()}`,
      submitterId: def.submitter,
      createdAt: created,
      updatedAt: created,
      status: def.status,
      beverageCategory: product.category,
      productName: product.productName,
      labels,
      reviews: [],
      serverValidation: { completedAt: created, findings: [], ocrResults },
      formFields: buildFormFields(product),
    };

    if (def.review) {
      sub.reviews.push({
        id: `REV-${idx}`,
        submissionId: sub.id,
        reviewerId: def.review.reviewer,
        startedAt: created,
        completedAt: new Date(new Date(created).getTime() + 300_000).toISOString(),
        activeSeconds: 180 + Math.floor(Math.random() * 120),
        decision: def.review.decision as ReviewRecord["decision"],
        findings: def.review.findings,
        notes: def.review.notes,
        reviewType: "primary",
      });
    }

    return sub;
  }).filter((s): s is Submission => s !== null);
}
