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
 * Generate 14 realistic mock submissions from the sampleData product catalog.
 *
 * Every submission has BOTH front and back labels. Most have no OCR
 * extracted fields yet — suitable for testing Tesseract.js field extraction.
 *
 * Status distribution:
 *   - 8 submitted (no OCR — Tesseract testing targets)
 *   - 2 in_review (with OCR)
 *   - 2 approved (with review)
 *   - 1 rejected (with review)
 *   - 1 needs_revision (with review)
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
  ];

  const subs = products.map((product, idx) => {
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
      formFields: o.formFields,
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

  // -----------------------------------------------------------------------
  // Additional submissions (beyond sampleData) for pagination testing
  // -----------------------------------------------------------------------
  const extras: Array<{
    productName: string;
    category: BeverageCategory;
    status: SubmissionStatus;
    submitter: string;
    daysAgo: number;
    review?: { decision: string; reviewer: string; notes: string; findings: ReviewFinding[] };
  }> = [
    { productName: "Bell's Two Hearted Ale", category: "beer", status: "submitted", submitter: "Bell's Brewery, Inc.", daysAgo: 0 },
    { productName: "Caymus Cabernet Sauvignon 2021", category: "wine", status: "submitted", submitter: "Caymus Vineyards", daysAgo: 1 },
    { productName: "Woodford Reserve Double Oaked", category: "spirits", status: "in_review", submitter: "Brown-Forman Corporation", daysAgo: 2 },
    { productName: "Founders All Day IPA", category: "beer", status: "submitted", submitter: "Founders Brewing Co.", daysAgo: 0 },
    { productName: "Josh Cellars Chardonnay 2022", category: "wine", status: "submitted", submitter: "Deutsch Family Wine & Spirits", daysAgo: 1 },
    { productName: "Casamigos Blanco Tequila", category: "spirits", status: "approved", submitter: "Diageo North America", daysAgo: 8,
      review: { decision: "approve", reviewer: "Jenny Park", notes: "All fields compliant. Approved.", findings: [] } },
    { productName: "Yuengling Traditional Lager", category: "beer", status: "submitted", submitter: "D.G. Yuengling & Son, Inc.", daysAgo: 0 },
    { productName: "Whispering Angel Rosé 2023", category: "wine", status: "needs_revision", submitter: "Sacha Lichine", daysAgo: 3,
      review: { decision: "needs_revision", reviewer: "Dave Morrison", notes: "Vintage date not visible on front label. Resubmit with legible date.", findings: [{ checklistItemId: "vintage_date", severity: "warning", message: "Vintage date is illegible or missing from front label." }] } },
    { productName: "Grey Goose Vodka", category: "spirits", status: "submitted", submitter: "Bacardi Limited", daysAgo: 1 },
    { productName: "New Belgium Fat Tire Amber Ale", category: "beer", status: "submitted", submitter: "New Belgium Brewing Company", daysAgo: 0 },
  ];

  extras.forEach((ex, i) => {
    const idx = products.length + i;
    const created = daysAgo(ex.daysAgo);
    const [bgC, txtC] = COLOR_MAP[ex.category];

    const frontImg = makeLabelSvg(bgC, txtC, ex.productName, "Front Label", ["Brand Name", "Class/Type", "Net Contents"]);
    const backImg = makeLabelSvg(bgC, txtC, ex.productName, "Back Label", ["Government Warning", "Name & Address"]);

    const sub: Submission = {
      id: `SUB-${(1000 + idx).toString(36).toUpperCase()}`,
      submitterId: ex.submitter,
      createdAt: created,
      updatedAt: created,
      status: ex.status,
      beverageCategory: ex.category,
      productName: ex.productName,
      labels: [
        { slotId: `slot-${idx}-0`, slotName: "Front Label", originalImageUrl: frontImg, correctedImageUrl: frontImg, checklist: [] },
        { slotId: `slot-${idx}-1`, slotName: "Back Label", originalImageUrl: backImg, correctedImageUrl: backImg, checklist: [] },
      ],
      reviews: [],
    };

    if (ex.review) {
      sub.reviews.push({
        id: `REV-${idx}`,
        submissionId: sub.id,
        reviewerId: ex.review.reviewer,
        startedAt: created,
        completedAt: new Date(new Date(created).getTime() + 300_000).toISOString(),
        activeSeconds: 180 + Math.floor(Math.random() * 120),
        decision: ex.review.decision as ReviewRecord["decision"],
        findings: ex.review.findings,
        notes: ex.review.notes,
        reviewType: "primary",
      });
    }

    subs.push(sub);
  });

  return subs;
}
