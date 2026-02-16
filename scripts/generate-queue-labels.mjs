#!/usr/bin/env node
/**
 * Generate realistic label images for "submitted" items in the Review Queue.
 *
 * Uses Gemini 2.5 Flash image generation to create front + back labels.
 * 8 of 10 items get the CORRECT exact government warning.
 * 2 of 10 items get misspelled warnings (failure modes for reviewers to catch).
 *
 * Output: frontend/public/ttb-labels/gen-{key}-front.png
 *         frontend/public/ttb-labels/gen-{key}-back.png
 *
 * Usage: GEMINI_API_KEY=... node scripts/generate-queue-labels.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "frontend", "public", "ttb-labels");

const GEMINI_MODEL = "gemini-2.0-flash-exp-image-generation";
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "***REDACTED***";

// ---------------------------------------------------------------------------
// Exact correct government warning
// ---------------------------------------------------------------------------
const GOV_WARNING =
  'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.';

// ---------------------------------------------------------------------------
// Misspelled variants (failure modes)
// ---------------------------------------------------------------------------
const MISSPELLED_1 =
  'GOVERNMANT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.';

const MISSPELLED_2 =
  'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholoc beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholoc beverages impairs your ability to drive a car or opearate machinery, and may cause health problems.';

// ---------------------------------------------------------------------------
// The 10 submitted products
// ---------------------------------------------------------------------------
const PRODUCTS = [
  // BEER
  {
    key: "cerveza-complice",
    brand: "Cerveza Complice",
    classType: "Mexican Style Lager",
    abv: "4.5% Alc. By Vol.",
    net: "12 FL OZ (355 mL)",
    category: "beer",
    origin: "Kentucky",
    nameAddress: "Abettor Brewing Company, 128 North Highland Street, Winchester, KY 40391",
    govWarning: MISSPELLED_1,  // ← FAILURE MODE
  },
  {
    key: "hops-n-drops",
    brand: "Hops N Drops",
    classType: "Lager",
    abv: "4.3% Alc. By Vol.",
    net: "12 FL OZ (355 mL)",
    category: "beer",
    origin: "Washington",
    nameAddress: "Narrows Brewing, Tacoma, WA",
    govWarning: GOV_WARNING,
  },
  {
    key: "kunstler-brewing",
    brand: "Künstler Brewing",
    classType: "New England Style India Pale Ale",
    abv: "6.0% Alc. By Vol.",
    net: "16 FL OZ (1 PT) 473 mL",
    category: "beer",
    origin: "Texas",
    nameAddress: "Künstler Brewing, 302 E LaChapelle, San Antonio, TX 78204",
    govWarning: GOV_WARNING,
  },
  {
    key: "beatbox",
    brand: "BeatBox",
    classType: "Malt Beverage with Natural Flavors",
    abv: "11.1% Alc. By Vol.",
    net: "16.9 FL OZ (500 mL)",
    category: "beer",
    origin: "Mexico",
    nameAddress: "BeatBox Beverages LLC, Austin, TX",
    govWarning: GOV_WARNING,
  },
  // WINE
  {
    key: "luna-hart",
    brand: "Luna Hart",
    classType: "Sauvignon Blanc",
    abv: "Alcohol 12.2% by Volume",
    net: "750 mL",
    category: "wine",
    origin: "California",
    nameAddress: "Luna Hart Wines, Solvang, CA",
    govWarning: MISSPELLED_2,  // ← FAILURE MODE
  },
  {
    key: "le-fraghe",
    brand: "Le Fraghe",
    classType: "Table Red Wine",
    abv: "Alcohol 13.5% by Volume",
    net: "750 mL",
    category: "wine",
    origin: "Italy",
    nameAddress: "Le Fraghe Winery, Verona, Italy. Imported by Vino Italia LLC, New York, NY",
    countryOfOrigin: "Italy",
    govWarning: GOV_WARNING,
  },
  {
    key: "manoir-du-carra",
    brand: "Manoir Du Carra",
    classType: "Table White Wine",
    abv: "Alcohol 13.0% by Volume",
    net: "750 mL",
    category: "wine",
    origin: "France",
    nameAddress: "Manoir Du Carra, Beaujolais, France. Imported by French Wine Selections, NY",
    countryOfOrigin: "France",
    govWarning: GOV_WARNING,
  },
  {
    key: "domaine-chantepierre",
    brand: "Domaine Chantepierre",
    classType: "Côtes du Rhône",
    abv: "Alcohol 14.0% by Volume",
    net: "750 mL",
    category: "wine",
    origin: "France",
    nameAddress: "Domaine Chantepierre, Châteauneuf-du-Pape, France. Imported by Heritage Wines, Chicago, IL",
    countryOfOrigin: "France",
    govWarning: GOV_WARNING,
  },
  {
    key: "domaine-des-florets",
    brand: "Domaine Des Florets",
    classType: "Vacqueyras Red Wine",
    abv: "Alcohol 14.5% by Volume",
    net: "750 mL",
    category: "wine",
    origin: "France",
    nameAddress: "Domaine Des Florets, Gigondas, France. Imported by Rhône Valley Imports, San Francisco, CA",
    countryOfOrigin: "France",
    govWarning: GOV_WARNING,
  },
  // SPIRITS
  {
    key: "doc-swinsons",
    brand: "Doc Swinson's",
    classType: "Straight Rye Whiskey",
    abv: "45% Alc./Vol. (90 Proof)",
    net: "750 mL",
    category: "spirits",
    origin: "Washington",
    nameAddress: "Doc Swinson's Distillery, Seattle, WA 98101",
    govWarning: GOV_WARNING,
  },
];

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildFrontPrompt(p) {
  const styles = {
    beer: "a flat, print-ready craft beer can label with a modern, colorful design. Include hops or grain artwork elements.",
    wine: "a flat, print-ready wine bottle label with an elegant design, refined typography, and a classic color palette.",
    spirits: "a flat, print-ready premium spirits bottle label with bold typography, gold accents, and a sophisticated design.",
  };

  return `Generate a photorealistic image of ${styles[p.category]}

Show ONLY the label as a flat rectangle — like a design file ready for printing. No bottle or can in the image.

The label MUST clearly and legibly display these EXACT text elements:
- Brand name: "${p.brand}" (prominently displayed, largest text)
- Product type: "${p.classType}"
- Alcohol content: "${p.abv}"
- Net contents: "${p.net}"

ALL text must be clearly legible, spelled correctly, and photographed straight-on. High resolution, studio lighting. The label should look like a real commercial product you'd find in a store.`;
}

function buildBackPrompt(p) {
  let prompt = `Generate a photorealistic image of a flat, print-ready BACK label for a ${p.category} product. Show ONLY the label as a flat white or cream colored rectangle — like a design proof ready for printing.

The back label MUST display these EXACT text elements, clearly legible in black text:

1. Government Warning (the words "GOVERNMENT WARNING:" must be in ALL CAPITALS and bold, followed by the rest in regular weight):
"${p.govWarning}"

2. Name and address: "${p.nameAddress}"`;

  if (p.countryOfOrigin) {
    prompt += `\n3. Country of origin: "Product of ${p.countryOfOrigin}"`;
  }
  if (p.category === "wine") {
    prompt += `\n${p.countryOfOrigin ? "4" : "3"}. "Contains Sulfites"`;
  }

  prompt += `

CRITICAL: The government warning text must be rendered EXACTLY as provided above — every word, every letter must match precisely. This is a legal requirement.

The text must be clearly legible, arranged neatly on the label. Simple, clean typography. White or cream background with black text. Include a small barcode at the bottom right.`;

  return prompt;
}

// ---------------------------------------------------------------------------
// Gemini image generation
// ---------------------------------------------------------------------------

async function generateImage(prompt, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(
        `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ["IMAGE", "TEXT"],
              temperature: 0.4,
            },
          }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        console.error(`  ⚠️  Gemini API error (attempt ${attempt + 1}): ${res.status}`);
        if (attempt < retries) {
          await sleep(5000);
          continue;
        }
        throw new Error(`Gemini API error: ${res.status} ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts || [];

      for (const part of parts) {
        if (part.inlineData) {
          return Buffer.from(part.inlineData.data, "base64");
        }
      }

      // No image in response — sometimes Gemini returns text only
      console.error(`  ⚠️  No image in response (attempt ${attempt + 1})`);
      if (attempt < retries) {
        await sleep(3000);
        continue;
      }
      throw new Error("No image generated by Gemini");
    } catch (err) {
      if (attempt < retries) {
        console.error(`  ⚠️  Error: ${err.message} — retrying...`);
        await sleep(5000);
        continue;
      }
      throw err;
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const failures = PRODUCTS.filter((p) => p.govWarning !== GOV_WARNING);
  const correct = PRODUCTS.filter((p) => p.govWarning === GOV_WARNING);

  console.log(`\n🏷️  Generating labels for ${PRODUCTS.length} submitted products`);
  console.log(`   ✅ ${correct.length} with CORRECT government warning`);
  console.log(`   ❌ ${failures.length} with MISSPELLED government warning (failure modes)`);
  console.log(`   📁 Output: ${OUT_DIR}\n`);

  let generated = 0;
  let skipped = 0;

  for (const p of PRODUCTS) {
    const frontPath = path.join(OUT_DIR, `gen-${p.key}-front.png`);
    const backPath = path.join(OUT_DIR, `gen-${p.key}-back.png`);

    const isFailure = p.govWarning !== GOV_WARNING;
    const tag = isFailure ? "❌ MISSPELLED" : "✅ CORRECT";

    // Skip if both already exist (for incremental re-runs)
    if (fs.existsSync(frontPath) && fs.existsSync(backPath)) {
      console.log(`⏭️  ${p.brand} — already exists, skipping`);
      skipped++;
      continue;
    }

    console.log(`\n🎨 [${generated + skipped + 1}/${PRODUCTS.length}] ${p.brand} (${p.category}) — ${tag}`);

    // Generate front label
    if (!fs.existsSync(frontPath)) {
      console.log(`   📸 Generating front label...`);
      try {
        const frontBuf = await generateImage(buildFrontPrompt(p));
        fs.writeFileSync(frontPath, frontBuf);
        console.log(`   ✅ Front: ${frontPath} (${(frontBuf.length / 1024).toFixed(0)} KB)`);
      } catch (err) {
        console.error(`   ❌ Front FAILED: ${err.message}`);
      }
      await sleep(2000); // Rate limit
    }

    // Generate back label
    if (!fs.existsSync(backPath)) {
      console.log(`   📸 Generating back label...`);
      try {
        const backBuf = await generateImage(buildBackPrompt(p));
        fs.writeFileSync(backPath, backBuf);
        console.log(`   ✅ Back: ${backPath} (${(backBuf.length / 1024).toFixed(0)} KB)`);
      } catch (err) {
        console.error(`   ❌ Back FAILED: ${err.message}`);
      }
      await sleep(2000); // Rate limit
    }

    generated++;
  }

  console.log(`\n✅ Done! Generated ${generated} products, skipped ${skipped}`);

  // Print mapping for store.ts
  console.log(`\n📋 Generated label mapping:`);
  for (const p of PRODUCTS) {
    const hasFront = fs.existsSync(path.join(OUT_DIR, `gen-${p.key}-front.png`));
    const hasBack = fs.existsSync(path.join(OUT_DIR, `gen-${p.key}-back.png`));
    const status = hasFront && hasBack ? "✅" : hasFront ? "⚠️ front only" : hasBack ? "⚠️ back only" : "❌ missing";
    console.log(`  ${status} ${p.key}: front=${hasFront}, back=${hasBack}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
