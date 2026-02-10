/**
 * In-memory submission store for the review queue prototype.
 *
 * This is a server-side singleton that persists across API calls within the
 * same process but resets on redeploy. For production, swap this with a
 * database (Postgres, DynamoDB, etc.).
 */

import {
  Submission,
  SubmissionStatus,
  ReviewRecord,
  ReviewFinding,
  BeverageCategory,
  SubmissionLabel,
} from "./types";

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

let submissions: Submission[] = [];
let seeded = false;

function ensureSeeded() {
  if (seeded) return;
  seeded = true;
  submissions = generateMockSubmissions();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getAllSubmissions(): Submission[] {
  ensureSeeded();
  return submissions;
}

export function getSubmission(id: string): Submission | undefined {
  ensureSeeded();
  return submissions.find((s) => s.id === id);
}

export function createSubmission(data: {
  beverageCategory: BeverageCategory;
  productName: string;
  submitterId: string;
  labels: SubmissionLabel[];
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
  };
  submissions.unshift(submission);
  return submission;
}

export function updateSubmissionStatus(
  id: string,
  status: SubmissionStatus
): Submission | undefined {
  ensureSeeded();
  const sub = submissions.find((s) => s.id === id);
  if (!sub) return undefined;
  sub.status = status;
  sub.updatedAt = new Date().toISOString();
  return sub;
}

export function addReview(
  submissionId: string,
  review: ReviewRecord
): Submission | undefined {
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

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60));
  return d.toISOString();
}

function generateMockSubmissions(): Submission[] {
  const mockData: Array<{
    productName: string;
    category: BeverageCategory;
    status: SubmissionStatus;
    submitter: string;
    daysAgo: number;
    labels: Array<{
      slotName: string;
      checklistSnapshot: Array<{ id: string; label: string; status: string }>;
    }>;
    ocrFields?: Record<string, string>;
    review?: {
      decision: string;
      reviewer: string;
      notes: string;
      findings: ReviewFinding[];
    };
  }> = [
    {
      productName: "Old Tom Kentucky Straight Bourbon",
      category: "spirits",
      status: "submitted",
      submitter: "Acme Spirits Inc.",
      daysAgo: 0,
      labels: [
        {
          slotName: "Front Label",
          checklistSnapshot: [
            { id: "brand_name", label: "Brand name", status: "auto_pass" },
            { id: "class_type", label: "Class/type designation", status: "auto_pass" },
            { id: "alcohol_content", label: "Alcohol content", status: "auto_pass" },
            { id: "net_contents", label: "Net contents", status: "auto_pass" },
          ],
        },
        {
          slotName: "Back Label",
          checklistSnapshot: [
            { id: "health_warning", label: "Government health warning", status: "auto_pass" },
            { id: "name_address", label: "Name and address", status: "auto_pass" },
          ],
        },
      ],
      ocrFields: {
        brandName: "OLD TOM DISTILLERY",
        classType: "Kentucky Straight Bourbon Whiskey",
        alcoholContent: "45% Alc./Vol. (90 Proof)",
        netContents: "750 mL",
        healthWarning: "GOVERNMENT WARNING: (1) According to the Surgeon General...",
        nameAddress: "Old Tom Distillery, Louisville, KY 40202",
      },
    },
    {
      productName: "Stone's Throw Pale Ale",
      category: "beer",
      status: "submitted",
      submitter: "Stone's Throw Brewing Co.",
      daysAgo: 1,
      labels: [
        {
          slotName: "Front Label",
          checklistSnapshot: [
            { id: "brand_name", label: "Brand name", status: "auto_pass" },
            { id: "class_type", label: "Class/type designation", status: "auto_pass" },
            { id: "net_contents", label: "Net contents", status: "auto_pass" },
          ],
        },
      ],
      ocrFields: {
        brandName: "STONE'S THROW",
        classType: "Pale Ale",
        netContents: "12 FL OZ (355 mL)",
      },
    },
    {
      productName: "Château Margaux 2019 Bordeaux",
      category: "wine",
      status: "in_review",
      submitter: "Margaux Imports LLC",
      daysAgo: 2,
      labels: [
        {
          slotName: "Front Label",
          checklistSnapshot: [
            { id: "brand_name", label: "Brand name", status: "auto_pass" },
            { id: "class_type", label: "Class/type designation", status: "auto_pass" },
            { id: "alcohol_content", label: "Alcohol content", status: "auto_pass" },
            { id: "net_contents", label: "Net contents", status: "auto_pass" },
          ],
        },
        {
          slotName: "Back Label",
          checklistSnapshot: [
            { id: "health_warning", label: "Government health warning", status: "auto_pass" },
            { id: "name_address", label: "Name and address", status: "auto_pass" },
            { id: "country_origin", label: "Country of origin", status: "auto_pass" },
            { id: "sulfite_declaration", label: "Sulfite declaration", status: "auto_pass" },
          ],
        },
      ],
      ocrFields: {
        brandName: "CHÂTEAU MARGAUX",
        classType: "Red Wine",
        alcoholContent: "Alcohol 13.5% by volume",
        netContents: "750 mL",
        healthWarning: "GOVERNMENT WARNING: (1) According to the Surgeon General...",
        nameAddress: "Margaux Imports LLC, New York, NY 10001",
        countryOfOrigin: "Product of France",
        sulfiteDeclaration: "Contains Sulfites",
      },
    },
    {
      productName: "Sunset Rosé 2023",
      category: "wine",
      status: "submitted",
      submitter: "Napa Valley Vintners",
      daysAgo: 0,
      labels: [
        {
          slotName: "Front Label",
          checklistSnapshot: [
            { id: "brand_name", label: "Brand name", status: "auto_pass" },
            { id: "class_type", label: "Class/type designation", status: "auto_fail" },
            { id: "alcohol_content", label: "Alcohol content", status: "auto_pass" },
            { id: "net_contents", label: "Net contents", status: "auto_pass" },
          ],
        },
      ],
      ocrFields: {
        brandName: "SUNSET",
        classType: "Rosé",
        alcoholContent: "12.5% Alc. By Vol.",
        netContents: "750 mL",
      },
    },
    {
      productName: "Mountain Creek IPA",
      category: "beer",
      status: "approved",
      submitter: "Mountain Creek Brewing",
      daysAgo: 5,
      labels: [
        {
          slotName: "Front Label",
          checklistSnapshot: [
            { id: "brand_name", label: "Brand name", status: "auto_pass" },
            { id: "class_type", label: "Class/type designation", status: "auto_pass" },
            { id: "net_contents", label: "Net contents", status: "auto_pass" },
          ],
        },
      ],
      review: {
        decision: "approve",
        reviewer: "Jenny Park",
        notes: "All fields match application. Clean label.",
        findings: [],
      },
    },
    {
      productName: "Blue Agave Silver Tequila",
      category: "spirits",
      status: "rejected",
      submitter: "Agave Spirits Corp.",
      daysAgo: 3,
      labels: [
        {
          slotName: "Front Label",
          checklistSnapshot: [
            { id: "brand_name", label: "Brand name", status: "auto_pass" },
            { id: "class_type", label: "Class/type designation", status: "auto_pass" },
            { id: "alcohol_content", label: "Alcohol content", status: "auto_fail" },
            { id: "net_contents", label: "Net contents", status: "auto_pass" },
          ],
        },
      ],
      ocrFields: {
        brandName: "BLUE AGAVE",
        classType: "Tequila",
        alcoholContent: "40% ABV",
        netContents: "750 mL",
      },
      review: {
        decision: "reject",
        reviewer: "Dave Morrison",
        notes: 'ABV uses prohibited "ABV" abbreviation instead of "Alc./Vol." or "Alcohol by Volume".',
        findings: [
          {
            checklistItemId: "alcohol_content",
            severity: "error",
            message: '"ABV" abbreviation is not an acceptable format per TTB regulations.',
          },
        ],
      },
    },
    {
      productName: "Golden Harvest Wheat Beer",
      category: "beer",
      status: "submitted",
      submitter: "Harvest Brewing Co.",
      daysAgo: 0,
      labels: [
        {
          slotName: "Front Label",
          checklistSnapshot: [
            { id: "brand_name", label: "Brand name", status: "auto_pass" },
            { id: "class_type", label: "Class/type designation", status: "auto_pass" },
            { id: "net_contents", label: "Net contents", status: "auto_fail" },
          ],
        },
      ],
      ocrFields: {
        brandName: "GOLDEN HARVEST",
        classType: "Wheat Beer",
        netContents: "355 mL",
      },
    },
    {
      productName: "Velvet Reserve Cabernet Sauvignon 2020",
      category: "wine",
      status: "needs_revision",
      submitter: "Velvet Vineyards",
      daysAgo: 4,
      labels: [
        {
          slotName: "Front Label",
          checklistSnapshot: [
            { id: "brand_name", label: "Brand name", status: "auto_pass" },
            { id: "class_type", label: "Class/type designation", status: "auto_pass" },
            { id: "alcohol_content", label: "Alcohol content", status: "auto_pass" },
            { id: "net_contents", label: "Net contents", status: "auto_pass" },
          ],
        },
        {
          slotName: "Back Label",
          checklistSnapshot: [
            { id: "health_warning", label: "Government health warning", status: "auto_fail" },
            { id: "name_address", label: "Name and address", status: "auto_pass" },
          ],
        },
      ],
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

  return mockData.map((m, idx) => {
    const created = daysAgo(m.daysAgo);
    const sub: Submission = {
      id: `SUB-${(1000 + idx).toString(36).toUpperCase()}`,
      submitterId: m.submitter,
      createdAt: created,
      updatedAt: created,
      status: m.status,
      beverageCategory: m.category,
      productName: m.productName,
      labels: m.labels.map((l, li) => ({
        slotId: `slot-${idx}-${li}`,
        slotName: l.slotName,
        originalImageUrl: "",
        correctedImageUrl: "",
        checklist: l.checklistSnapshot.map((c) => ({
          id: c.id,
          label: c.label,
          description: "",
          appliesTo: ["front"] as ("front" | "back" | "any")[],
          categories: "all" as const,
          autoDetectable: "both" as const,
          mandatory: true,
          extractable: true,
          status: c.status as "auto_pass" | "auto_fail" | "unchecked",
          detectedValue: m.ocrFields?.[
            c.id === "health_warning" ? "healthWarning" :
            c.id === "name_address" ? "nameAddress" :
            c.id === "country_origin" ? "countryOfOrigin" :
            c.id === "sulfite_declaration" ? "sulfiteDeclaration" :
            c.id === "alcohol_content" ? "alcoholContent" :
            c.id === "net_contents" ? "netContents" :
            c.id === "brand_name" ? "brandName" :
            c.id === "class_type" ? "classType" :
            c.id
          ],
        })),
      })),
      reviews: [],
      serverValidation: m.ocrFields
        ? {
            completedAt: created,
            findings: [],
            ocrResults: m.ocrFields,
          }
        : undefined,
    };

    if (m.review) {
      sub.reviews.push({
        id: `REV-${idx}`,
        submissionId: sub.id,
        reviewerId: m.review.reviewer,
        startedAt: created,
        completedAt: new Date(new Date(created).getTime() + 300_000).toISOString(),
        activeSeconds: 180 + Math.floor(Math.random() * 120),
        decision: m.review.decision as ReviewRecord["decision"],
        findings: m.review.findings,
        notes: m.review.notes,
        reviewType: "primary",
      });
    }

    return sub;
  });
}
