"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Circle,
  Wine,
  Upload,
  Move,
  ScanSearch,
  ClipboardCheck,
  FileText,
  GitCompare,
  Send,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Walkthrough Step Definitions
// ---------------------------------------------------------------------------

export interface WalkthroughStep {
  id: string;
  title: string;
  description: string;
  detail: string;
  icon: React.ReactNode;
  highlightSelector?: string;
}

const STEPS: WalkthroughStep[] = [
  {
    id: "category",
    title: "Choose Beverage Category",
    description: "Select whether the label is for beer, wine, or spirits.",
    detail:
      "TTB regulations differ by beverage type. Beer labels don't require ABV in most cases. Wine and spirits have different net contents rules. Choosing the right category ensures the correct validation rules are applied.",
    icon: <Wine size={18} />,
    highlightSelector: "[data-walkthrough='category']",
  },
  {
    id: "upload",
    title: "Upload Label Image",
    description: "Drag and drop a label image, or click to browse.",
    detail:
      "Supports PNG, JPEG, and WebP. You can upload photos taken at angles — the next step will help you correct perspective distortion. If your image contains both front and back labels, the system will ask if you want to split them.",
    icon: <Upload size={18} />,
    highlightSelector: "[data-walkthrough='upload']",
  },
  {
    id: "editor",
    title: "Correct Perspective",
    description: "Use corner points or mesh warp to flatten the label.",
    detail:
      'Drag the corner handles to align the label edges. For curved surfaces (bottles, cans), switch to Mesh mode and add control points along the curves. The "Auto" button estimates curvature automatically. This step improves OCR accuracy significantly.',
    icon: <Move size={18} />,
    highlightSelector: "[data-walkthrough='editor']",
  },
  {
    id: "ocr",
    title: "Run OCR Extraction",
    description: "Choose Quick Check (browser) or AI Extract (server).",
    detail:
      "Quick Check uses Tesseract.js entirely in your browser — fast but less accurate. AI Extract sends the image to Claude 3.5 Sonnet for structured field extraction — slower but highly accurate. The extracted fields populate the checklist automatically.",
    icon: <ScanSearch size={18} />,
    highlightSelector: "[data-walkthrough='ocr']",
  },
  {
    id: "checklist",
    title: "Review Checklist",
    description: "Check validation results for each required field.",
    detail:
      "Green checkmarks indicate passing fields. Red X marks show validation failures with explanations. Yellow warnings suggest potential issues. Click any item to see details, or edit detected values inline if the OCR made a mistake.",
    icon: <ClipboardCheck size={18} />,
    highlightSelector: "[data-walkthrough='checklist']",
  },
  {
    id: "data",
    title: "Inspect Data Tab",
    description: "View and edit all extracted fields, re-run validation.",
    detail:
      'The Data tab shows every field extracted by OCR in editable text boxes. You can correct any misread values and click "Re-validate" to update the checklist. The raw OCR text and full JSON response are also available for inspection.',
    icon: <FileText size={18} />,
    highlightSelector: "[data-walkthrough='data']",
  },
  {
    id: "compare",
    title: "Compare with Application",
    description: "Enter form values and fuzzy-match against the label.",
    detail:
      'Type the values from the COLA application form (brand name, ABV, etc.) and the system compares them against what OCR extracted from the label. It uses Levenshtein distance for fuzzy matching — so "STONE\'S THROW" vs "Stone\'s Throw" scores as a match.',
    icon: <GitCompare size={18} />,
    highlightSelector: "[data-walkthrough='compare']",
  },
  {
    id: "submit",
    title: "Submit for Review",
    description: "Send the label to the review queue for agent decision.",
    detail:
      "Once you're satisfied with the validation results, the label can be submitted to the review queue. Agents access the queue at /queue, where they can approve, reject, or request revisions. The full review history is tracked with timing and findings.",
    icon: <Send size={18} />,
    highlightSelector: "[data-walkthrough='queue']",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface WalkthroughPanelProps {
  onClose: () => void;
  steps?: WalkthroughStep[];
  title?: string;
}

export { STEPS as SUBMITTER_STEPS };

export default function WalkthroughPanel({ onClose, steps, title }: WalkthroughPanelProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([0]));

  const activeSteps = steps || STEPS;
  const step = activeSteps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === activeSteps.length - 1;
  const progress = ((currentStep + 1) / activeSteps.length) * 100;

  const goNext = useCallback(() => {
    if (!isLast) {
      const next = currentStep + 1;
      setCurrentStep(next);
      setVisitedSteps((prev) => new Set(prev).add(next));
    }
  }, [currentStep, isLast]);

  const goPrev = useCallback(() => {
    if (!isFirst) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep, isFirst]);

  const goTo = useCallback((idx: number) => {
    setCurrentStep(idx);
    setVisitedSteps((prev) => new Set(prev).add(idx));
  }, []);

  // Highlight effect
  useEffect(() => {
    if (!step.highlightSelector) return;

    const el = document.querySelector(step.highlightSelector);
    if (!el) return;

    el.classList.add("walkthrough-highlight");
    el.scrollIntoView({ behavior: "smooth", block: "center" });

    return () => {
      el.classList.remove("walkthrough-highlight");
    };
  }, [step]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onClose]);

  return (
    <>
      {/* Panel */}
      <div
        id="walkthrough-panel"
        className="fixed top-0 right-0 w-[380px] h-full bg-white border-l border-gray-200 shadow-2xl z-40 flex flex-col"
        style={{ animation: "walkthroughSlideIn 0.3s ease-out" }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-800">{title || "Walkthrough"}</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Step {currentStep + 1} of {activeSteps.length}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1">
              <X size={18} />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step Navigation (vertical step indicators) */}
        <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0 overflow-x-auto">
          <div className="flex gap-1">
            {activeSteps.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => goTo(idx)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition whitespace-nowrap ${
                  idx === currentStep
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : visitedSteps.has(idx)
                      ? "text-gray-500 hover:bg-gray-50"
                      : "text-gray-400 hover:bg-gray-50"
                }`}
                title={s.title}
              >
                {visitedSteps.has(idx) && idx !== currentStep ? (
                  <CheckCircle2 size={10} className="text-emerald-500" />
                ) : idx === currentStep ? (
                  <Circle size={10} className="text-blue-500 fill-blue-500" />
                ) : (
                  <Circle size={10} />
                )}
                {idx + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Current Step Content */}
        <div className="flex-1 overflow-auto px-5 py-5">
          <div className="mb-6">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4">
              {step.icon}
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">{step.title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">{step.description}</p>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <p className="text-xs text-gray-600 leading-relaxed">{step.detail}</p>
            </div>
          </div>

          {/* Step-specific tips */}
          <div className="space-y-3">
            {currentStep === 0 && (
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                <p className="text-[11px] text-amber-700 font-medium mb-1">Tip</p>
                <p className="text-[11px] text-amber-600">
                  The category selector is in the top-right of the header bar. Click it before uploading to ensure
                  correct validation rules.
                </p>
              </div>
            )}
            {currentStep === 3 && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <p className="text-[11px] text-blue-700 font-medium mb-1">Performance</p>
                <p className="text-[11px] text-blue-600">
                  Quick Check: ~2-3 seconds (no network). AI Extract: ~3-5 seconds (requires server). AI Extract is
                  recommended for accuracy.
                </p>
              </div>
            )}
            {currentStep === 6 && (
              <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                <p className="text-[11px] text-emerald-700 font-medium mb-1">Dave&apos;s Use Case</p>
                <p className="text-[11px] text-emerald-600">
                  The fuzzy matcher handles cases like &quot;STONE&apos;S THROW&quot; vs &quot;Stone&apos;s Throw&quot;
                  — they&apos;ll score as a high match even with different capitalization and punctuation.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <button
            onClick={goPrev}
            disabled={isFirst}
            className="flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft size={14} />
            Previous
          </button>

          {isLast ? (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition shadow-sm"
            >
              <CheckCircle2 size={14} />
              Done
            </button>
          ) : (
            <button
              onClick={goNext}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm"
            >
              Next
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
