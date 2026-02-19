#!/usr/bin/env node
/**
 * 6-extract-abv-volume.mjs
 * 
 * Uses Gemini 2.0 Flash vision to extract ABV and Net Contents from label images.
 * These fields are NOT available on the COLA detail page, so we need vision extraction.
 * 
 * Results are merged into sample_labels/enriched_cola_fields.json
 * 
 * Usage:
 *   node scripts/pipeline/6-extract-abv-volume.mjs [--id TTB_ID] [--resume]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..', '..');

const ENRICHED_PATH = join(ROOT, 'sample_labels', 'enriched_cola_fields.json');
const IMAGES_DIR = join(ROOT, 'frontend', 'public', 'ttb-labels');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY environment variable is required');
  process.exit(1);
}
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const singleId = args.includes('--id') ? args[args.indexOf('--id') + 1] : null;
const resume = args.includes('--resume');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function imageToBase64(filePath) {
  const buf = readFileSync(filePath);
  return buf.toString('base64');
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Send label images to Gemini and ask for ABV and Net Contents.
 * Returns { alcoholContent, netContents } or null on failure.
 */
async function extractFromImages(ttbId, imageFiles) {
  // Build image parts
  const imageParts = imageFiles.map(f => {
    const path = join(IMAGES_DIR, f);
    const base64 = imageToBase64(path);
    return {
      inlineData: {
        mimeType: 'image/png',
        data: base64,
      },
    };
  });

  const prompt = `You are analyzing alcohol beverage label images. Extract ONLY these two fields from the label:

1. **Alcohol Content (ABV)**: The alcohol percentage as shown on the label. Include the full statement, e.g. "Alc. 13% By Vol." or "40% ABV" or "80 Proof". If not visible, return null.

2. **Net Contents (Volume)**: The volume/size as shown on the label, e.g. "750 mL", "1.5L", "12 FL. OZ.", "355 mL". If not visible, return null.

Return ONLY a JSON object with these two fields. Do not include any other text or explanation.
Example: {"alcoholContent": "Alc. 13.5% By Vol.", "netContents": "750 mL"}
If a field is not found, use null for that field.`;

  const body = {
    contents: [{
      parts: [
        ...imageParts,
        { text: prompt },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 256,
    },
  };

  const resp = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${err.slice(0, 200)}`);
  }

  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  // Extract JSON from response (may be wrapped in markdown code block)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn(`  ⚠ No JSON in response for ${ttbId}: ${text.slice(0, 100)}`);
    return null;
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      alcoholContent: parsed.alcoholContent || null,
      netContents: parsed.netContents || null,
    };
  } catch (e) {
    console.warn(`  ⚠ JSON parse error for ${ttbId}: ${e.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Load enriched data
  let enriched = {};
  try {
    enriched = JSON.parse(readFileSync(ENRICHED_PATH, 'utf-8'));
  } catch {
    console.error('❌ Cannot read enriched_cola_fields.json');
    process.exit(1);
  }

  // Build image map: ttbId → [filenames]
  const imageFiles = readdirSync(IMAGES_DIR).filter(f => f.endsWith('.png'));
  const imageMap = {};
  for (const f of imageFiles) {
    const match = f.match(/^(\d+)-(\d+)\.png$/);
    if (!match) continue;
    const ttbId = match[1];
    if (!imageMap[ttbId]) imageMap[ttbId] = [];
    imageMap[ttbId].push(f);
  }

  // Determine which IDs to process
  let ids;
  if (singleId) {
    ids = [singleId];
  } else {
    ids = Object.keys(imageMap).sort();
  }

  console.log(`🔍 Processing ${ids.length} TTB IDs with Gemini vision...`);

  let processed = 0;
  let extracted = 0;
  let skipped = 0;
  let failed = 0;

  for (const ttbId of ids) {
    const rec = enriched[ttbId];
    if (!rec) {
      console.log(`  ⏭ ${ttbId} — not in enriched data, skipping`);
      skipped++;
      continue;
    }

    // Skip if already has vision-extracted data (unless --id override)
    if (resume && rec._visionExtracted && !singleId) {
      skipped++;
      continue;
    }

    const files = imageMap[ttbId];
    if (!files || files.length === 0) {
      skipped++;
      continue;
    }

    // Sort files so lower numbers (front labels) come first
    files.sort();

    process.stdout.write(`  [${processed + 1}/${ids.length}] ${ttbId} (${files.length} images)...`);

    try {
      const result = await extractFromImages(ttbId, files);
      if (result) {
        if (result.alcoholContent) rec.alcoholContent = result.alcoholContent;
        if (result.netContents) rec.netContents = result.netContents;
        rec._visionExtracted = true;
        extracted++;
        console.log(` ✅ ABV=${result.alcoholContent || '—'} | Vol=${result.netContents || '—'}`);
      } else {
        failed++;
        console.log(` ⚠ no data`);
      }
    } catch (err) {
      failed++;
      console.log(` ❌ ${err.message.slice(0, 80)}`);
    }

    processed++;

    // Save after every 10 items
    if (processed % 10 === 0) {
      writeFileSync(ENRICHED_PATH, JSON.stringify(enriched, null, 2));
    }

    // Rate limit: 1 second between requests
    await sleep(1000);
  }

  // Final save
  writeFileSync(ENRICHED_PATH, JSON.stringify(enriched, null, 2));

  console.log(`\n✅ Done! ${extracted} extracted, ${failed} failed, ${skipped} skipped`);
  console.log(`💾 Saved to ${ENRICHED_PATH}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
