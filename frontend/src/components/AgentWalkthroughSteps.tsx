import React from "react";
import { ListFilter, Eye, ImageIcon, ClipboardCheck, GitCompare, History, Scale, Timer } from "lucide-react";
import { WalkthroughStep } from "./WalkthroughPanel";

// ---------------------------------------------------------------------------
// Agent Review Walkthrough — covers the /queue dashboard and /queue/[id] page
// ---------------------------------------------------------------------------

export const AGENT_QUEUE_STEPS: WalkthroughStep[] = [
  {
    id: "queue-overview",
    title: "Queue Dashboard",
    description: "View and filter all pending submissions.",
    detail:
      "The queue dashboard lists every COLA submission with its status, beverage category, submitter, and timestamps. Use the filter tabs (All / Pending / Reviewed) to focus on what needs attention. Submissions are sorted with the most recent first.",
    icon: <ListFilter size={18} />,
    highlightSelector: "[data-walkthrough='queue-filters']",
  },
  {
    id: "open-submission",
    title: "Open a Submission",
    description: "Click any row to open the full review workspace.",
    detail:
      "Each row links to a detailed review page for that submission. You'll see the label artwork, extracted data, checklist, form comparison, and review history — everything you need to make a decision.",
    icon: <Eye size={18} />,
    highlightSelector: "[data-walkthrough='queue-table']",
  },
];

export const AGENT_REVIEW_STEPS: WalkthroughStep[] = [
  {
    id: "label-data",
    title: "Label + Data (Side-by-Side)",
    description: "View the label artwork alongside the extracted fields.",
    detail:
      "The first tab shows the corrected label image on the left and all OCR-extracted fields on the right. Fields that match the application form are marked green; mismatches are flagged. Use the label selector to switch between front and back labels if available.",
    icon: <ImageIcon size={18} />,
    highlightSelector: "[data-walkthrough='tab-label-data']",
  },
  {
    id: "checklist",
    title: "Compliance Checklist",
    description: "Review auto-validated checklist items per label.",
    detail:
      "Each required field (brand name, ABV, net contents, government warning, etc.) is automatically checked against TTB regulations. Green items passed automatically, red items failed. Yellow items need manual judgment. Click any item to see the specific rule and suggestion.",
    icon: <ClipboardCheck size={18} />,
    highlightSelector: "[data-walkthrough='tab-checklist']",
  },
  {
    id: "form-comparison",
    title: "Form vs. Label Comparison",
    description: "Fuzzy-match COLA application fields against the label.",
    detail:
      'This tab compares what the applicant wrote on their COLA form with what OCR extracted from the label. Each field gets a verdict: exact match, close match, or mismatch. The system uses Levenshtein distance — so "STONE\'S THROW" vs "Stone\'s Throw" scores as an exact match after normalization.',
    icon: <GitCompare size={18} />,
    highlightSelector: "[data-walkthrough='tab-form-comparison']",
  },
  {
    id: "history",
    title: "Review History",
    description: "See previous review decisions and findings.",
    detail:
      "If this submission has been reviewed before (e.g., a resubmission or an escalation), the History tab shows every past decision, the reviewer, their findings, notes, and time spent. This provides full audit traceability.",
    icon: <History size={18} />,
    highlightSelector: "[data-walkthrough='tab-history']",
  },
  {
    id: "decision",
    title: "Make Your Decision",
    description: "Approve, reject, request revision, or escalate.",
    detail:
      "The decision panel on the right lets you enter your reviewer name, select a decision, add findings with severity levels, and write notes. The review timer tracks how long you've spent. Once submitted, the decision is recorded in the audit trail.",
    icon: <Scale size={18} />,
    highlightSelector: "[data-walkthrough='decision-panel']",
  },
  {
    id: "stats-bar",
    title: "Header Stats",
    description: "At-a-glance summary of pass/fail/mismatch counts.",
    detail:
      "The colored stats bar at the top of the review page shows how many checklist items passed, failed, or need manual review, plus form comparison mismatch alerts. This helps you quickly gauge whether a submission is likely clean or has issues.",
    icon: <Timer size={18} />,
    highlightSelector: "[data-walkthrough='stats-bar']",
  },
];
