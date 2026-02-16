#!/usr/bin/env npx tsx
/**
 * Export sampleData.ts to JSON.
 *
 * Usage:
 *   npx tsx scripts/export-sample-data.mjs                    # compact JSON to stdout
 *   npx tsx scripts/export-sample-data.mjs --pretty            # indented JSON to stdout
 *   npx tsx scripts/export-sample-data.mjs --pretty -o out.json  # write to file
 *   npx tsx scripts/export-sample-data.mjs --products          # export products (paired front+back)
 *   npx tsx scripts/export-sample-data.mjs --labels            # export individual labels (default)
 */

import { parseArgs } from "node:util";
import { writeFileSync } from "node:fs";

// ── Parse CLI flags ─────────────────────────────────────────────────────────
const { values } = parseArgs({
  options: {
    pretty:   { type: "boolean", default: false },
    products: { type: "boolean", default: false },
    labels:   { type: "boolean", default: false },
    output:   { type: "string",  short: "o" },
    help:     { type: "boolean", short: "h", default: false },
  },
  strict: false,
});

if (values.help) {
  console.log(`
Usage: npx tsx scripts/export-sample-data.mjs [options]

Options:
  --pretty       Indented, human-readable JSON (default: compact)
  --products     Export product pairs (front + back combined)
  --labels       Export individual labels (default if neither flag set)
  -o, --output   Write to file instead of stdout
  -h, --help     Show this help
`);
  process.exit(0);
}

const sampleData = await import("../frontend/src/lib/sampleData.ts");

// ── Build export payload ────────────────────────────────────────────────────
let payload;

if (values.products) {
  // Products = paired front+back with all metadata
  const products = sampleData.getSampleProducts();
  payload = {
    exportedAt: new Date().toISOString(),
    count: products.length,
    products: products.map((p) => ({
      productKey: p.productKey,
      productName: p.productName,
      category: p.category,
      ttbId: p.ttbId,
      front: p.front,
      back: p.back,
      expectedFrontFields: p.expectedFrontFields,
      expectedBackFields: p.expectedBackFields,
    })),
  };
} else {
  // Labels = individual SampleLabel entries (default)
  const labels = sampleData.SAMPLE_LABELS;
  payload = {
    exportedAt: new Date().toISOString(),
    count: labels.length,
    labels: labels.map((l) => ({
      key: l.key,
      displayName: l.displayName,
      colaSource: l.colaSource,
      generation: l.generation,
      expectedFields: l.expectedFields,
    })),
  };
}

// ── Output ──────────────────────────────────────────────────────────────────
const indent = values.pretty ? 2 : undefined;
const json = JSON.stringify(payload, null, indent);

if (values.output) {
  writeFileSync(values.output, json + "\n", "utf-8");
  console.error(`✅ Wrote ${payload.count} entries to ${values.output}`);
} else {
  process.stdout.write(json + "\n");
}
