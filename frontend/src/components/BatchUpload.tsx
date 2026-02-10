"use client";

import React, { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileImage,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Download,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { runTesseractOcr, parseOcrText, runServerOcr, ExtractedFields, TESSERACT_ENABLED } from "@/lib/ocr";
import { BeverageCategory } from "@/lib/types";
import { validateExtractedFields, ValidationResult } from "@/lib/validation";

export type OcrTier = "quick" | "ai";

export interface BatchItem {
  id: string;
  file: File;
  fileName: string;
  status: "queued" | "processing" | "done" | "error";
  /** Thumbnail data URL */
  thumbnail: string | null;
  extractedFields: ExtractedFields | null;
  validationResults: ValidationResult[] | null;
  error: string | null;
  /** Counts */
  passCount: number;
  failCount: number;
  fieldCount: number;
}

interface BatchUploadProps {
  category: BeverageCategory;
  ocrTier: OcrTier;
  onClose: () => void;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function fileToThumbnail(file: File, maxSize = 80): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => resolve("");
    img.src = URL.createObjectURL(file);
  });
}

export default function BatchUpload({ category, ocrTier, onClose }: BatchUploadProps) {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const abortRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const newItems: BatchItem[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const thumb = await fileToThumbnail(file);
      newItems.push({
        id: generateId(),
        file,
        fileName: file.name,
        status: "queued",
        thumbnail: thumb,
        extractedFields: null,
        validationResults: null,
        error: null,
        passCount: 0,
        failCount: 0,
        fieldCount: 0,
      });
    }
    setItems((prev) => [...prev, ...newItems]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    setExpandedId(null);
  }, []);

  const processItem = useCallback(
    async (item: BatchItem): Promise<Partial<BatchItem>> => {
      try {
        const canvas = await fileToCanvas(item.file);
        let fields: ExtractedFields;

        if (ocrTier === "quick" && TESSERACT_ENABLED) {
          const rawText = await runTesseractOcr(canvas);
          fields = parseOcrText(rawText);
        } else {
          const dataUrl = canvas.toDataURL("image/png");
          const base64 = dataUrl.split(",")[1];
          fields = await runServerOcr(base64, "image/png");
          // If server returned raw text but no structured fields, try heuristic
          if (fields.rawText && !fields.brandName && !fields.classType) {
            const parsed = parseOcrText(fields.rawText);
            fields = { ...parsed, ...fields };
          }
        }

        const foundFields = Object.entries(fields).filter(
          ([k, v]) => k !== "rawText" && v && String(v).trim().length > 0
        );

        const validationResults = validateExtractedFields(fields, category, "front");
        const passCount = validationResults.filter((r) => r.pass).length;
        const failCount = validationResults.filter((r) => !r.pass).length;

        return {
          status: "done",
          extractedFields: fields,
          validationResults,
          passCount,
          failCount,
          fieldCount: foundFields.length,
        };
      } catch (err) {
        return {
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    },
    [category, ocrTier]
  );

  const runBatch = useCallback(async () => {
    setIsRunning(true);
    abortRef.current = false;

    for (let i = 0; i < items.length; i++) {
      if (abortRef.current) break;
      if (items[i].status !== "queued") continue;

      // Mark as processing
      setItems((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: "processing" as const } : it))
      );

      const result = await processItem(items[i]);

      setItems((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, ...result } : it))
      );
    }

    setIsRunning(false);
  }, [items, processItem]);

  const stopBatch = useCallback(() => {
    abortRef.current = true;
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  // Stats
  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;
  const totalPass = items.reduce((s, i) => s + i.passCount, 0);
  const totalFail = items.reduce((s, i) => s + i.failCount, 0);

  // CSV export
  const exportCsv = useCallback(() => {
    const headers = ["File", "Status", "Fields", "Pass", "Fail", "Brand", "Class/Type", "ABV", "Net Contents", "Name/Address"];
    const rows = items.map((i) => [
      i.fileName,
      i.status,
      i.fieldCount,
      i.passCount,
      i.failCount,
      i.extractedFields?.brandName ?? "",
      i.extractedFields?.classType ?? "",
      i.extractedFields?.alcoholContent ?? "",
      i.extractedFields?.netContents ?? "",
      i.extractedFields?.nameAddress ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `batch-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [items]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Batch Upload</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Upload multiple label images for bulk OCR processing ({ocrTier === "quick" ? "Quick Check" : "AI Extract"})
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={20} />
          </button>
        </div>

        {/* Drop zone */}
        {items.length === 0 && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="m-5 border-2 border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition"
          >
            <Upload size={36} className="text-gray-400" />
            <p className="text-sm text-gray-600 font-medium">
              Drag &amp; drop label images here, or click to browse
            </p>
            <p className="text-xs text-gray-400">
              Accepts PNG, JPEG, WebP. Select multiple files at once.
            </p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {/* Items list */}
        {items.length > 0 && (
          <div className="flex-1 overflow-auto px-5 py-3 space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className={`border rounded-lg transition ${
                  item.status === "processing" ? "border-blue-300 bg-blue-50/50" :
                  item.status === "done" ? "border-gray-200 bg-white" :
                  item.status === "error" ? "border-red-200 bg-red-50/50" :
                  "border-gray-200 bg-gray-50/50"
                }`}
              >
                <div className="flex items-center gap-3 px-3 py-2">
                  {/* Thumbnail */}
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center shrink-0">
                      <FileImage size={16} className="text-gray-400" />
                    </div>
                  )}

                  {/* File name + status */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{item.fileName}</p>
                    <p className="text-[10px] text-gray-500">
                      {item.status === "queued" && "Queued"}
                      {item.status === "processing" && "Processing..."}
                      {item.status === "done" && `${item.fieldCount} fields, ${item.passCount} pass, ${item.failCount} issues`}
                      {item.status === "error" && (item.error || "Error")}
                    </p>
                  </div>

                  {/* Status icon */}
                  {item.status === "processing" && <Loader2 size={16} className="text-blue-500 animate-spin shrink-0" />}
                  {item.status === "done" && <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />}
                  {item.status === "error" && <XCircle size={16} className="text-red-500 shrink-0" />}

                  {/* Expand/collapse for done items */}
                  {item.status === "done" && (
                    <button
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {expandedId === item.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}

                  {/* Remove */}
                  {item.status === "queued" && (
                    <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500">
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Expanded details */}
                {expandedId === item.id && item.extractedFields && (
                  <div className="px-3 pb-3 border-t border-gray-100 mt-1 pt-2">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                      {Object.entries(item.extractedFields)
                        .filter(([k, v]) => k !== "rawText" && v)
                        .map(([k, v]) => (
                          <div key={k} className="flex gap-1">
                            <span className="font-medium text-gray-500 capitalize">
                              {k.replace(/([A-Z])/g, " $1").trim()}:
                            </span>
                            <span className="text-gray-700 truncate">{String(v)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-200 flex items-center gap-3">
            {/* Add more */}
            <button
              onClick={() => inputRef.current?.click()}
              disabled={isRunning}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
            >
              + Add More
            </button>

            {/* Stats */}
            <div className="flex-1 text-[11px] text-gray-500">
              {items.length} file{items.length !== 1 ? "s" : ""}
              {doneCount > 0 && <> &middot; {doneCount} done</>}
              {errorCount > 0 && <> &middot; <span className="text-red-500">{errorCount} error{errorCount !== 1 ? "s" : ""}</span></>}
              {doneCount > 0 && <> &middot; {totalPass} pass, {totalFail} issues</>}
            </div>

            {/* Export CSV */}
            {doneCount > 0 && (
              <button
                onClick={exportCsv}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
              >
                <Download size={12} />
                CSV
              </button>
            )}

            {/* Clear */}
            <button
              onClick={clearAll}
              disabled={isRunning}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
            >
              Clear
            </button>

            {/* Run / Stop */}
            {isRunning ? (
              <button
                onClick={stopBatch}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition shadow-sm"
              >
                <X size={13} />
                Stop
              </button>
            ) : (
              <button
                onClick={runBatch}
                disabled={items.filter((i) => i.status === "queued").length === 0}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
              >
                <Loader2 size={13} className={isRunning ? "animate-spin" : ""} />
                Process {items.filter((i) => i.status === "queued").length} File{items.filter((i) => i.status === "queued").length !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
