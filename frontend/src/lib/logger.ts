/**
 * Thin logging utility — structured, level-aware console wrapper.
 *
 * Provides a consistent logging interface that:
 *   - Prefixes every message with a `[TAG]` for easy grep/filtering
 *   - Suppresses debug-level output in production builds
 *   - Outputs structured data as JSON for Vercel log drains
 *
 * Usage:
 *   import { log } from "@/lib/logger";
 *   log.info("QueueAPI", "Fetched submissions", { count: 42 });
 *   log.error("OCR", "Extraction failed", err);
 */

const IS_PROD = process.env.NODE_ENV === "production";

/** Structured log entry shape (useful for JSON log drains). */
interface LogPayload {
  level: "debug" | "info" | "warn" | "error";
  tag: string;
  message: string;
  data?: unknown;
  timestamp: string;
}

function emit(level: LogPayload["level"], tag: string, message: string, data?: unknown) {
  const entry: LogPayload = {
    level,
    tag,
    message,
    data,
    timestamp: new Date().toISOString(),
  };

  // In production, output JSON for log aggregators; in dev, use readable format
  if (IS_PROD) {
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(JSON.stringify(entry));
  } else {
    const prefix = `[${tag}]`;
    switch (level) {
      case "debug":
        console.debug(prefix, message, data ?? "");
        break;
      case "info":
        console.info(prefix, message, data ?? "");
        break;
      case "warn":
        console.warn(prefix, message, data ?? "");
        break;
      case "error":
        console.error(prefix, message, data ?? "");
        break;
    }
  }
}

export const log = {
  /** Debug — suppressed in production. */
  debug: (tag: string, message: string, data?: unknown) => {
    if (!IS_PROD) emit("debug", tag, message, data);
  },
  /** Informational — always emitted. */
  info: (tag: string, message: string, data?: unknown) => {
    emit("info", tag, message, data);
  },
  /** Warning — always emitted. */
  warn: (tag: string, message: string, data?: unknown) => {
    emit("warn", tag, message, data);
  },
  /** Error — always emitted. */
  error: (tag: string, message: string, data?: unknown) => {
    emit("error", tag, message, data);
  },
};
