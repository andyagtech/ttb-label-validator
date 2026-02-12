import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchExplanation, clearExplanationCache } from "../explain";

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  clearExplanationCache();
});

// ---------------------------------------------------------------------------
// fetchExplanation
// ---------------------------------------------------------------------------

describe("fetchExplanation", () => {
  it("returns explanation from API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        explanation: "The health warning must be in ALL CAPS per 27 CFR Part 16.",
      }),
    });

    const result = await fetchExplanation("health_warning_caps", "health_warning", "Government Warning: ...");

    expect(result).toBe("The health warning must be in ALL CAPS per 27 CFR Part 16.");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/explain",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("caches results — second call with same args does not fetch", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ explanation: "Cached explanation." }),
    });

    const result1 = await fetchExplanation("abv_present", "alcohol_content");
    const result2 = await fetchExplanation("abv_present", "alcohol_content");

    expect(result1).toBe("Cached explanation.");
    expect(result2).toBe("Cached explanation.");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("different detectedValue bypasses cache", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ explanation: "First." }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ explanation: "Second." }),
      });

    const r1 = await fetchExplanation("abv_present", "alcohol_content", "5% ABV");
    const r2 = await fetchExplanation("abv_present", "alcohol_content", "Alcohol 5%");

    expect(r1).toBe("First.");
    expect(r2).toBe("Second.");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("handles HTTP error gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => "Service unavailable",
    });

    const result = await fetchExplanation("health_warning_caps", "health_warning");
    expect(result).toContain("unavailable");
  });

  it("handles network failure gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchExplanation("health_warning_caps", "health_warning");
    expect(result).toContain("unavailable");
  });

  it("sends excerpt and citation info in request body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ explanation: "Test." }),
    });

    await fetchExplanation(
      "health_warning_caps",
      "health_warning",
      "Government Warning: ...",
      "GOVERNMENT WARNING: ...",
    );

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.ruleId).toBe("health_warning_caps");
    expect(callBody.excerpt).toBeTruthy();
    expect(callBody.detectedValue).toBe("Government Warning: ...");
    expect(callBody.userValue).toBe("GOVERNMENT WARNING: ...");
    expect(callBody.itemLabel).toBeTruthy();
  });
});
