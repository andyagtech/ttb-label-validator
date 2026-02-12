"use client";

import React, { useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  Loader2,
  Upload,
  ImageIcon,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Copy,
  Check,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Sample Labels
// ---------------------------------------------------------------------------

const SAMPLE_LABELS = [
  { name: "Malt Beverage 1", file: "/samples/malt-beverage-alcohol-content-1.png" },
  { name: "Malt Beverage 4", file: "/samples/malt-beverage-alcohol-content-4.png" },
  { name: "Front Label", file: "/samples/front-label-corrected.png" },
  { name: "Back Label", file: "/samples/back-label-corrected.png" },
  { name: "Slide 5", file: "/samples/Slide5.jpg" },
  { name: "Slide 19", file: "/samples/Slide19.jpg" },
];

// ---------------------------------------------------------------------------
// Endpoint Definitions
// ---------------------------------------------------------------------------

interface EndpointDef {
  id: string;
  method: "GET" | "POST" | "PATCH";
  path: string;
  description: string;
  needsImage: boolean;
  needsBody: boolean;
  defaultBody?: string;
  pathParam?: string;
}

const ENDPOINTS: EndpointDef[] = [
  {
    id: "ocr",
    method: "POST",
    path: "/api/ocr",
    description: "Extract structured TTB label fields from an image using AI vision model",
    needsImage: true,
    needsBody: false,
  },
  {
    id: "flatten",
    method: "POST",
    path: "/api/flatten",
    description: "AI Flatten — cylindrical unroll (bottles) or perspective rectify (flat labels) via OpenCV Lambda",
    needsImage: true,
    needsBody: false,
  },
  {
    id: "queue-list",
    method: "GET",
    path: "/api/queue",
    description: "List all submissions in the review queue",
    needsImage: false,
    needsBody: false,
  },
  {
    id: "queue-create",
    method: "POST",
    path: "/api/queue",
    description: "Create a new submission in the review queue",
    needsImage: false,
    needsBody: true,
    defaultBody: JSON.stringify(
      {
        beverageCategory: "spirits",
        productName: "Test Label Submission",
        submitterId: "API Test Page",
      },
      null,
      2
    ),
  },
  {
    id: "queue-get",
    method: "GET",
    path: "/api/queue/{id}",
    description: "Get full detail for a specific submission",
    needsImage: false,
    needsBody: false,
    pathParam: "SUB-RG",
  },
  {
    id: "queue-review",
    method: "POST",
    path: "/api/queue/{id}",
    description: "Submit a review decision for a submission",
    needsImage: false,
    needsBody: true,
    pathParam: "SUB-RG",
    defaultBody: JSON.stringify(
      {
        decision: "approve",
        reviewerId: "API Tester",
        notes: "Approved via API test page",
        findings: [],
        activeSeconds: 60,
      },
      null,
      2
    ),
  },
  {
    id: "queue-patch",
    method: "PATCH",
    path: "/api/queue/{id}",
    description: "Update a submission's status",
    needsImage: false,
    needsBody: true,
    pathParam: "SUB-RG",
    defaultBody: JSON.stringify({ status: "in_review" }, null, 2),
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(",")[1]);
    };
    reader.readAsDataURL(file);
  });
}

async function urlToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);
  const blob = await res.blob();
  const mimeType = blob.type || "image/png";
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve({ base64: dataUrl.split(",")[1], mimeType });
    };
    reader.readAsDataURL(blob);
  });
}

function syntaxHighlight(json: string): string {
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = "text-orange-400"; // number
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = "text-blue-400"; // key
          } else {
            cls = "text-emerald-400"; // string
          }
        } else if (/true|false/.test(match)) {
          cls = "text-purple-400"; // boolean
        } else if (/null/.test(match)) {
          cls = "text-gray-500"; // null
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ApiTestPage() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointDef>(ENDPOINTS[0]);
  const [selectedSample, setSelectedSample] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [bodyText, setBodyText] = useState(ENDPOINTS[0].defaultBody || "");
  const [pathParam, setPathParam] = useState(ENDPOINTS[0].pathParam || "");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{
    status: number;
    statusText: string;
    body: string;
    time: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleEndpointChange = useCallback((ep: EndpointDef) => {
    setSelectedEndpoint(ep);
    setBodyText(ep.defaultBody || "");
    setPathParam(ep.pathParam || "");
    setResponse(null);
  }, []);

  const handleFileUpload = useCallback((file: File) => {
    setUploadedFile(file);
    setSelectedSample(null);
    const url = URL.createObjectURL(file);
    setUploadedPreview(url);
  }, []);

  const handleSampleSelect = useCallback((sampleFile: string) => {
    setSelectedSample(sampleFile);
    setUploadedFile(null);
    setUploadedPreview(null);
  }, []);

  const handleSend = useCallback(async () => {
    setLoading(true);
    setResponse(null);
    const start = performance.now();

    try {
      let url = selectedEndpoint.path;
      if (selectedEndpoint.pathParam !== undefined) {
        url = url.replace("{id}", pathParam);
      }

      const fetchOptions: RequestInit = {
        method: selectedEndpoint.method,
        headers: {} as Record<string, string>,
      };

      if (selectedEndpoint.needsImage) {
        // OCR endpoint — build image body
        let base64: string;
        let mimeType = "image/png";

        if (uploadedFile) {
          base64 = await fileToBase64(uploadedFile);
          mimeType = uploadedFile.type || "image/png";
        } else if (selectedSample) {
          const result = await urlToBase64(selectedSample);
          base64 = result.base64;
          mimeType = result.mimeType;
        } else {
          setResponse({
            status: 0,
            statusText: "Error",
            body: JSON.stringify({ error: "Please select a sample label or upload an image" }, null, 2),
            time: 0,
          });
          setLoading(false);
          return;
        }

        (fetchOptions.headers as Record<string, string>)["Content-Type"] = "application/json";
        const imageBody: Record<string, string> = { imageBase64: base64, mimeType };
        if (selectedEndpoint.id === "flatten") {
          imageBody.mode = "cylindrical"; // default; user can edit body for "perspective"
        }
        fetchOptions.body = JSON.stringify(imageBody);
      } else if (selectedEndpoint.needsBody) {
        (fetchOptions.headers as Record<string, string>)["Content-Type"] = "application/json";
        fetchOptions.body = bodyText;
      }

      const res = await fetch(url, fetchOptions);
      const text = await res.text();
      const elapsed = Math.round(performance.now() - start);

      let formatted: string;
      try {
        const parsed = JSON.parse(text);
        formatted = JSON.stringify(parsed, null, 2);
      } catch {
        formatted = text;
      }

      setResponse({
        status: res.status,
        statusText: res.statusText,
        body: formatted,
        time: elapsed,
      });
    } catch (err) {
      const elapsed = Math.round(performance.now() - start);
      setResponse({
        status: 0,
        statusText: "Network Error",
        body: JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }, null, 2),
        time: elapsed,
      });
    }

    setLoading(false);
  }, [selectedEndpoint, selectedSample, uploadedFile, bodyText, pathParam]);

  const handleCopy = useCallback(() => {
    if (response) {
      navigator.clipboard.writeText(response.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [response]);

  const currentImage = selectedSample || uploadedPreview;

  return (
    <div id="legacy-api-test-shell" className="min-h-screen bg-gray-50">
      {/* Header */}
      <header id="legacy-api-test-header" className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/legacy" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition">
              <ArrowLeft size={14} />
              Validator
            </Link>
            <div className="h-5 w-px bg-gray-200" />
            <div>
              <h1 id="legacy-api-test-title" className="text-lg font-semibold text-gray-800">API Test Page</h1>
              <p className="text-xs text-gray-500">Test endpoints with sample labels or your own images</p>
            </div>
          </div>
          <Link
            href="/legacy/queue"
            className="text-xs text-gray-500 hover:text-gray-700 transition"
          >
            Queue →
          </Link>
        </div>
      </header>

      <div id="legacy-api-test-main" className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-2 gap-6">
        {/* Left: Request Builder */}
        <div id="legacy-api-test-request-panel" className="space-y-4">
          {/* Endpoint Selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block mb-3">
              Endpoint
            </label>
            <div className="space-y-1.5">
              {ENDPOINTS.map((ep) => (
                <button
                  key={ep.id}
                  onClick={() => handleEndpointChange(ep)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition ${
                    selectedEndpoint.id === ep.id
                      ? "bg-blue-50 border border-blue-200"
                      : "hover:bg-gray-50 border border-transparent"
                  }`}
                >
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                      ep.method === "GET"
                        ? "bg-emerald-100 text-emerald-700"
                        : ep.method === "POST"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {ep.method}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-gray-700">{ep.path}</p>
                    <p className="text-[10px] text-gray-400 truncate">{ep.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Path Parameter */}
          {selectedEndpoint.pathParam !== undefined && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block mb-2">
                Path Parameter: <span className="font-mono text-gray-700">{"{id}"}</span>
              </label>
              <input
                type="text"
                value={pathParam}
                onChange={(e) => setPathParam(e.target.value)}
                placeholder="e.g. SUB-RG"
                className="w-full text-sm font-mono border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Resolved URL: <span className="font-mono text-gray-600">{selectedEndpoint.path.replace("{id}", pathParam || "...")}</span>
              </p>
            </div>
          )}

          {/* Image Selector (for OCR endpoint) */}
          {selectedEndpoint.needsImage && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block mb-3">
                Label Image
              </label>

              {/* Sample gallery */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {SAMPLE_LABELS.map((sample) => (
                  <button
                    key={sample.file}
                    onClick={() => handleSampleSelect(sample.file)}
                    className={`relative rounded-lg overflow-hidden border-2 transition aspect-[4/3] group ${
                      selectedSample === sample.file
                        ? "border-blue-500 ring-2 ring-blue-500/20"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <img
                      src={sample.file}
                      alt={sample.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                      <p className="text-[9px] text-white font-medium truncate">{sample.name}</p>
                    </div>
                    {selectedSample === sample.file && (
                      <div className="absolute top-1 right-1">
                        <CheckCircle2 size={14} className="text-blue-500 bg-white rounded-full" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Upload */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => inputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-dashed border-gray-300 text-gray-600 hover:border-blue-400 hover:bg-blue-50/30 transition flex-1"
                >
                  <Upload size={13} />
                  Upload your own image
                </button>
                {uploadedFile && (
                  <span className="text-[10px] text-gray-500 truncate max-w-[120px]">
                    {uploadedFile.name}
                  </span>
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                  e.target.value = "";
                }}
              />

              {/* Preview */}
              {currentImage && (
                <div className="mt-3 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                  <img
                    src={currentImage}
                    alt="Selected"
                    className="max-h-48 mx-auto object-contain"
                  />
                </div>
              )}
            </div>
          )}

          {/* Body Editor (for POST/PATCH with body) */}
          {selectedEndpoint.needsBody && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block mb-2">
                Request Body (JSON)
              </label>
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={8}
                spellCheck={false}
                className="w-full text-xs font-mono border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-gray-50"
              />
            </div>
          )}

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-xl bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send size={15} />
                Send Request
              </>
            )}
          </button>
        </div>

        {/* Right: Response Viewer */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[400px] flex flex-col">
            {/* Response Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                  Response
                </span>
                {response && (
                  <>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded font-mono ${
                        response.status >= 200 && response.status < 300
                          ? "bg-emerald-100 text-emerald-700"
                          : response.status >= 400
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {response.status} {response.statusText}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-gray-400">
                      <Clock size={10} />
                      {response.time}ms
                    </span>
                  </>
                )}
              </div>
              {response && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition"
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
            </div>

            {/* Response Body */}
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <Loader2 size={24} className="animate-spin text-blue-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">
                      {selectedEndpoint.needsImage ? "Processing image with AI..." : "Fetching..."}
                    </p>
                  </div>
                </div>
              ) : response ? (
                <pre
                  className="p-4 text-xs font-mono leading-relaxed text-gray-300 bg-[#1e1e2e] min-h-full"
                  dangerouslySetInnerHTML={{ __html: syntaxHighlight(response.body) }}
                />
              ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <ImageIcon size={24} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">
                      Select an endpoint and click Send Request
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Reference */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ChevronDown size={13} className="text-gray-400" />
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                Quick Reference
              </span>
            </div>
            <div className="space-y-2 text-[11px] text-gray-600">
              <div>
                <span className="font-medium text-gray-700">OCR Response Fields:</span>{" "}
                brandName, classType, alcoholContent, netContents, healthWarning, nameAddress,
                countryOfOrigin, sulfiteDeclaration, appellation, vintageDate, varietal, ageStatement
              </div>
              <div>
                <span className="font-medium text-gray-700">Queue Statuses:</span>{" "}
                draft, submitted, in_review, approved, rejected, needs_revision
              </div>
              <div>
                <span className="font-medium text-gray-700">Review Decisions:</span>{" "}
                approve, reject, needs_revision, escalate
              </div>
              <div>
                <span className="font-medium text-gray-700">Categories:</span>{" "}
                beer, wine, spirits
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
