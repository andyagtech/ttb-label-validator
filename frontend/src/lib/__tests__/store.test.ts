/**
 * Store API tests — covers the in-memory submission store used by API routes.
 *
 * Tests CRUD operations: list, get, create, update status, and add review.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  getAllSubmissions,
  getSubmission,
  createSubmission,
  updateSubmissionStatus,
  addReview,
  reseedSubmissions,
} from "../store";
import type { ReviewRecord } from "../types";

// ---------------------------------------------------------------------------
// Reset store before each test to ensure isolation
// ---------------------------------------------------------------------------

beforeEach(() => {
  reseedSubmissions();
});

// ---------------------------------------------------------------------------
// getAllSubmissions
// ---------------------------------------------------------------------------

describe("getAllSubmissions", () => {
  it("returns seeded mock submissions", () => {
    const subs = getAllSubmissions();
    expect(subs.length).toBeGreaterThan(0);
  });

  it("each submission has required fields", () => {
    const subs = getAllSubmissions();
    for (const sub of subs) {
      expect(sub.id).toBeTruthy();
      expect(sub.productName).toBeTruthy();
      expect(sub.beverageCategory).toMatch(/^(beer|wine|spirits)$/);
      expect(sub.status).toBeTruthy();
      expect(sub.submitterId).toBeTruthy();
      expect(sub.createdAt).toBeTruthy();
      expect(sub.labels).toBeDefined();
      expect(sub.reviews).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// getSubmission
// ---------------------------------------------------------------------------

describe("getSubmission", () => {
  it("returns a submission by ID", () => {
    const all = getAllSubmissions();
    const first = all[0];
    const found = getSubmission(first.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(first.id);
  });

  it("returns undefined for non-existent ID", () => {
    const found = getSubmission("DOES-NOT-EXIST");
    expect(found).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// createSubmission
// ---------------------------------------------------------------------------

describe("createSubmission", () => {
  it("creates a new submission with status 'submitted'", () => {
    const before = getAllSubmissions().length;
    const sub = createSubmission({
      beverageCategory: "wine",
      productName: "Test Chardonnay",
      submitterId: "test-user",
      labels: [],
    });

    expect(sub.id).toBeTruthy();
    expect(sub.status).toBe("submitted");
    expect(sub.productName).toBe("Test Chardonnay");
    expect(sub.beverageCategory).toBe("wine");
    expect(sub.submitterId).toBe("test-user");
    expect(sub.reviews).toEqual([]);

    const after = getAllSubmissions().length;
    expect(after).toBe(before + 1);
  });

  it("prepends new submission to the front of the list", () => {
    const sub = createSubmission({
      beverageCategory: "beer",
      productName: "Front of List Lager",
      submitterId: "test-user",
      labels: [],
    });

    const all = getAllSubmissions();
    expect(all[0].id).toBe(sub.id);
  });
});

// ---------------------------------------------------------------------------
// updateSubmissionStatus
// ---------------------------------------------------------------------------

describe("updateSubmissionStatus", () => {
  it("updates status and updatedAt timestamp", () => {
    const all = getAllSubmissions();
    const target = all[0];
    const oldUpdatedAt = target.updatedAt;

    const updated = updateSubmissionStatus(target.id, "approved");
    expect(updated).toBeDefined();
    expect(updated!.status).toBe("approved");
    expect(updated!.updatedAt).not.toBe(oldUpdatedAt);
  });

  it("returns undefined for non-existent ID", () => {
    const result = updateSubmissionStatus("NOPE", "approved");
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// addReview
// ---------------------------------------------------------------------------

describe("addReview", () => {
  function makeReview(decision: "approve" | "reject" | "needs_revision" | "escalate"): ReviewRecord {
    return {
      id: `REV-TEST-${Date.now()}`,
      submissionId: "",
      reviewerId: "agent-test",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      activeSeconds: 120,
      decision,
      findings: [],
      notes: "Test review",
      reviewType: "primary",
    };
  }

  it("appends a review and transitions status to 'approved'", () => {
    const sub = getAllSubmissions()[0];
    const reviewCount = sub.reviews.length;
    const review = makeReview("approve");
    review.submissionId = sub.id;

    const updated = addReview(sub.id, review);
    expect(updated).toBeDefined();
    expect(updated!.reviews.length).toBe(reviewCount + 1);
    expect(updated!.status).toBe("approved");
  });

  it("transitions status to 'rejected' on reject", () => {
    const sub = getAllSubmissions()[0];
    const review = makeReview("reject");
    review.submissionId = sub.id;

    const updated = addReview(sub.id, review);
    expect(updated!.status).toBe("rejected");
  });

  it("transitions status to 'needs_revision' on needs_revision", () => {
    const sub = getAllSubmissions()[0];
    const review = makeReview("needs_revision");
    review.submissionId = sub.id;

    const updated = addReview(sub.id, review);
    expect(updated!.status).toBe("needs_revision");
  });

  it("keeps status as 'in_review' on escalate", () => {
    const sub = getAllSubmissions()[0];
    const review = makeReview("escalate");
    review.submissionId = sub.id;

    const updated = addReview(sub.id, review);
    expect(updated!.status).toBe("in_review");
  });

  it("returns undefined for non-existent submission", () => {
    const review = makeReview("approve");
    review.submissionId = "NOPE";

    const result = addReview("NOPE", review);
    expect(result).toBeUndefined();
  });
});
