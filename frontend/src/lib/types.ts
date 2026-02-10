/**
 * Shared types for TTB COLA label validation system.
 *
 * Covers: checklist items, review records, submissions, and validation tiers.
 */

// ---------------------------------------------------------------------------
// Beverage category — determines which checklist rules apply
// ---------------------------------------------------------------------------
export type BeverageCategory = "wine" | "beer" | "spirits";

// ---------------------------------------------------------------------------
// Checklist items — per-label pre-submission quality nudges
// ---------------------------------------------------------------------------

export type CheckStatus = "unchecked" | "checked" | "auto_pass" | "auto_fail" | "not_applicable";

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  /** Which label positions this item applies to */
  appliesTo: ("front" | "back" | "any")[];
  /** Which beverage categories this item applies to */
  categories: BeverageCategory[] | "all";
  /** Can this be auto-detected by browser-side or server-side analysis? */
  autoDetectable: "browser" | "server" | "both" | "manual";
  /** Current status — starts as unchecked, user or system can update */
  status: CheckStatus;
  /** If auto-detected, confidence score 0-1 */
  confidence?: number;
  /** Optional note from auto-detection or reviewer */
  note?: string;
  /** Is this a mandatory TTB requirement (vs. quality recommendation)? */
  mandatory: boolean;
  /** Value detected by CV/OCR (e.g., "Blueberry Wine", "11-14% by Vol.") */
  detectedValue?: string;
  /** User-corrected value (overrides detectedValue if set) */
  userValue?: string;
  /** Does this item expect a text value to be extracted? */
  extractable: boolean;
}

// ---------------------------------------------------------------------------
// Checklist templates — the canonical set of items for each label type
// ---------------------------------------------------------------------------

export function getChecklistTemplate(
  labelPosition: "front" | "back" | "other",
  category: BeverageCategory
): ChecklistItem[] {
  const pos = labelPosition === "other" ? "any" : labelPosition;

  const ALL_ITEMS: Omit<ChecklistItem, "status">[] = [
    // --- Front label (Brand Label) items ---
    {
      id: "brand_name",
      label: "Brand name visible",
      description: "The brand name must be clearly legible in the image.",
      appliesTo: ["front"],
      categories: "all",
      autoDetectable: "both",
      mandatory: true,
      extractable: true,
    },
    {
      id: "class_type",
      label: "Class/type designation",
      description:
        'Class and type of the product (e.g., "Red Wine", "Blended Whiskey", "Lager").',
      appliesTo: ["front"],
      categories: "all",
      autoDetectable: "server",
      mandatory: true,
      extractable: true,
    },
    {
      id: "alcohol_content",
      label: "Alcohol content statement",
      description:
        'Must read "Alcohol __% by volume" or "__% Alc. By Vol." — "ABV" alone is not allowed.',
      appliesTo: ["front", "any"],
      categories: ["wine", "spirits"],
      autoDetectable: "server",
      mandatory: true,
      extractable: true,
    },
    {
      id: "alcohol_content",
      label: "Alcohol content statement",
      description:
        'Optional for malt beverages unless required by state law. If present, must read "Alcohol __% by volume" or "__% Alc. By Vol."',
      appliesTo: ["front", "any"],
      categories: ["beer"],
      autoDetectable: "server",
      mandatory: false,
      extractable: true,
    },
    {
      id: "net_contents",
      label: "Net contents",
      description:
        "Volume statement (e.g., 750 mL, 1 L, 12 FL OZ). Must appear on front or back.",
      appliesTo: ["front", "back"],
      categories: ["wine", "spirits"],
      autoDetectable: "server",
      mandatory: true,
      extractable: true,
    },
    {
      id: "net_contents",
      label: "Net contents",
      description:
        "Must be in American measure (FL OZ, PINT, QUART, GALLON). Metric may also appear. Must be on front or back.",
      appliesTo: ["front", "back"],
      categories: ["beer"],
      autoDetectable: "server",
      mandatory: true,
      extractable: true,
    },
    {
      id: "appellation",
      label: "Appellation of origin",
      description:
        "Geographic origin (e.g., Napa Valley, Willamette Valley). Required when grape variety or vintage is stated.",
      appliesTo: ["front"],
      categories: ["wine"],
      autoDetectable: "server",
      mandatory: false,
      extractable: true,
    },
    {
      id: "vintage_date",
      label: "Vintage date",
      description:
        "Year of harvest. Optional, but if present, appellation rules apply.",
      appliesTo: ["front"],
      categories: ["wine"],
      autoDetectable: "server",
      mandatory: false,
      extractable: true,
    },
    {
      id: "varietal",
      label: "Grape varietal",
      description:
        "Grape variety (e.g., Pinot Noir). If stated, at least 75% of grapes must be that variety.",
      appliesTo: ["front"],
      categories: ["wine"],
      autoDetectable: "server",
      mandatory: false,
      extractable: true,
    },
    {
      id: "age_statement",
      label: "Age statement",
      description:
        "Required for certain spirits types. States minimum aging period.",
      appliesTo: ["front"],
      categories: ["spirits"],
      autoDetectable: "server",
      mandatory: false,
      extractable: true,
    },

    // --- Back label (Other Label) items ---
    {
      id: "health_warning",
      label: "Government health warning",
      description:
        '"GOVERNMENT WARNING:" must appear in all caps and bold. The rest of the warning must NOT be bold.',
      appliesTo: ["back"],
      categories: "all",
      autoDetectable: "both",
      mandatory: true,
      extractable: true,
    },
    {
      id: "name_address",
      label: "Name and address",
      description:
        "Name and address of the bottler, packer, or importer. Must include city and state. Required on the front label for domestic malt beverages.",
      appliesTo: ["front", "back"],
      categories: "all",
      autoDetectable: "server",
      mandatory: true,
      extractable: true,
    },
    {
      id: "country_origin",
      label: "Country of origin",
      description:
        'Required for imported products. Must state "Product of [Country]" or equivalent.',
      appliesTo: ["back"],
      categories: "all",
      autoDetectable: "server",
      mandatory: false,
      extractable: true,
    },
    {
      id: "sulfite_declaration",
      label: "Sulfite declaration",
      description:
        '"Contains Sulfites" — required if the product contains 10+ ppm of sulfur dioxide.',
      appliesTo: ["back", "front"],
      categories: ["wine", "beer"],
      autoDetectable: "server",
      mandatory: false,
      extractable: true,
    },

    // --- Image quality items (both labels) ---
    {
      id: "image_sharp",
      label: "Image is sharp and in focus",
      description:
        "Text on the label should be clearly readable, not blurry or motion-blurred.",
      appliesTo: ["front", "back", "any"],
      categories: "all",
      autoDetectable: "browser",
      mandatory: false,
      extractable: false,
    },
    {
      id: "image_lighting",
      label: "Even lighting, no glare",
      description:
        "The label should be evenly lit without harsh reflections or shadows obscuring text.",
      appliesTo: ["front", "back", "any"],
      categories: "all",
      autoDetectable: "browser",
      mandatory: false,
      extractable: false,
    },
    {
      id: "image_complete",
      label: "Entire label visible",
      description:
        "No part of the label should be cropped or hidden. All edges must be within the image.",
      appliesTo: ["front", "back", "any"],
      categories: "all",
      autoDetectable: "browser",
      mandatory: false,
      extractable: false,
    },
    {
      id: "corners_aligned",
      label: "Corner points aligned to label edges",
      description:
        "The 4 corner markers should tightly match the actual corners of the label.",
      appliesTo: ["front", "back", "any"],
      categories: "all",
      autoDetectable: "browser",
      mandatory: false,
      extractable: false,
    },
  ];

  return ALL_ITEMS
    .filter((item) => {
      const matchesPosition =
        item.appliesTo.includes(pos as "front" | "back") ||
        item.appliesTo.includes("any");
      const matchesCategory =
        item.categories === "all" || item.categories.includes(category);
      return matchesPosition && matchesCategory;
    })
    .map((item) => ({ ...item, status: "unchecked" as CheckStatus }));
}

// ---------------------------------------------------------------------------
// Review system types
// ---------------------------------------------------------------------------

export type ReviewDecision = "approve" | "reject" | "needs_revision" | "escalate";

export interface ReviewFinding {
  checklistItemId: string;
  severity: "error" | "warning" | "info";
  message: string;
  /** Bounding box region on the label image where the issue was found, if applicable */
  region?: { x: number; y: number; width: number; height: number };
}

export interface ReviewRecord {
  id: string;
  submissionId: string;
  reviewerId: string;
  /** When the reviewer opened this submission */
  startedAt: string; // ISO 8601
  /** When the reviewer submitted their decision */
  completedAt: string; // ISO 8601
  /** Total active time in seconds (excludes idle/tab-away time) */
  activeSeconds: number;
  decision: ReviewDecision;
  findings: ReviewFinding[];
  /** Free-text notes from reviewer */
  notes: string;
  /** Was this a primary review, secondary (dual-review), or audit? */
  reviewType: "primary" | "secondary" | "audit" | "senior";
  /** For audit reviews: did reviewer agree with original decision? */
  agreedWithOriginal?: boolean;
}

export interface SubmissionLabel {
  slotId: string;
  slotName: string;
  originalImageUrl: string;
  correctedImageUrl: string;
  checklist: ChecklistItem[];
}

export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "approved"
  | "rejected"
  | "needs_revision";

export interface Submission {
  id: string;
  /** Who submitted this */
  submitterId: string;
  createdAt: string;
  updatedAt: string;
  status: SubmissionStatus;
  beverageCategory: BeverageCategory;
  /** Product name or identifier */
  productName: string;
  labels: SubmissionLabel[];
  reviews: ReviewRecord[];
  /** Server-side validation results (populated after submission) */
  serverValidation?: {
    completedAt: string;
    findings: ReviewFinding[];
    ocrResults?: Record<string, string>; // checklistItemId -> extracted text
  };
}
