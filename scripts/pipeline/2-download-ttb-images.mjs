#!/usr/bin/env node
/**
 * TTB COLA Label Image Downloader
 * 
 * Instead of screenshotting the full form page, this script navigates to the
 * TTB printable version and downloads the actual <img> elements directly.
 * Each label image is saved individually — no cropping pipeline needed.
 * 
 * Usage: node download-ttb-images.mjs [--ttbid XXXX] [--headless] [--all]
 *        node download-ttb-images.mjs --broken
 * 
 * Flags:
 *   --broken    Download images for the 3 known broken IDs
 *   --ttbid X   Download images for a specific TTB ID
 *   --all       Download images for ALL records in ttb_cola_records.json
 *   --headless  Run headless (no browser window)
 *   --force     Re-download even if files already exist
 *   --limit N   Stop after successfully downloading N new records
 */

import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Config ──────────────────────────────────────────────────────────────────
const RECORDS_PATH = join(__dirname, '..', 'sample_labels', 'ttb_cola_records.json');
const OUTPUT_DIR = join(__dirname, '..', 'sample_labels', 'ttb_labels_direct');
const COLA_DETAIL_BASE = 'https://www.ttbonline.gov/colasonline/viewColaDetails.do';
const DELAY_BETWEEN_REQUESTS_MS = 4000;
const IMAGE_LOAD_TIMEOUT_MS = 45_000;
const CAPTCHA_WAIT_TIMEOUT_MS = 120_000;

const BROKEN_IDS = [
  // Cleared — previously listed IDs were re-inspected and images are fine.
  // 23312001000445 (Crafted Cask) and 24023001000567 (Tenute Capaldo) have valid images.
  // 24051001000312 (Samuel Adams) was never in ttb_cola_records.json.
];

// No longer need a hardcoded REAL_IDS filter — all records in the file are now real
// (fabricated data was removed by the crawler rewrite)

// ── Parse CLI args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let singleTtbId = null;
let headless = false;
let force = false;
let downloadBroken = false;
let downloadAll = false;
let downloadLimit = Infinity;
let prefixFilter = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--ttbid' && args[i + 1]) singleTtbId = args[i + 1];
  if (args[i] === '--headless') headless = true;
  if (args[i] === '--force') force = true;
  if (args[i] === '--broken') downloadBroken = true;
  if (args[i] === '--all') downloadAll = true;
  if (args[i] === '--limit' && args[i + 1]) downloadLimit = parseInt(args[i + 1]);
  if (args[i] === '--prefix' && args[i + 1]) prefixFilter = args[i + 1];
}

// ── Load records ────────────────────────────────────────────────────────────
function loadRecords() {
  const raw = JSON.parse(readFileSync(RECORDS_PATH, 'utf-8'));
  const records = [];
  for (const category of ['beer', 'wine', 'spirits']) {
    if (raw[category]) {
      for (const rec of raw[category]) {
        records.push({ ...rec, category });
      }
    }
  }
  return records;
}

// ── CAPTCHA detection ───────────────────────────────────────────────────────
async function isCaptchaPage(pageOrPopup) {
  try {
    const content = await pageOrPopup.content();
    return content.includes('What code is in the image') ||
           content.includes('spam submission') ||
           content.includes('human visitor');
  } catch { return false; }
}

async function waitForCaptchaSolve(pageOrPopup) {
  console.log(`     🔒 CAPTCHA detected! Solve it in the browser window.`);
  console.log(`     ⏳ Waiting up to ${CAPTCHA_WAIT_TIMEOUT_MS / 1000}s...`);
  const start = Date.now();
  while (Date.now() - start < CAPTCHA_WAIT_TIMEOUT_MS) {
    await pageOrPopup.waitForTimeout(2000);
    if (!(await isCaptchaPage(pageOrPopup))) {
      console.log(`     ✅ CAPTCHA solved!`);
      await pageOrPopup.waitForTimeout(5000); // longer cooldown after CAPTCHA
      return true;
    }
  }
  console.log(`     ❌ CAPTCHA timeout`);
  return false;
}

// ── Extract and download individual label images ────────────────────────────
async function downloadLabelImages(page, ttbId, label) {
  const detailUrl = `${COLA_DETAIL_BASE}?action=publicDisplaySearchBasic&ttbid=${ttbId}`;
  console.log(`  🔍 [${ttbId}] ${label}`);

  // Check if we already have images for this ID
  if (!force) {
    const existing = readdirSync(OUTPUT_DIR).filter(f => f.startsWith(ttbId) && f.endsWith('.png'));
    if (existing.length > 0) {
      console.log(`     ⏭️  Already have ${existing.length} image(s), skipping (use --force to re-download)`);
      return existing.length;
    }
  }

  try {
    // Navigate to COLA detail page
    await page.goto(detailUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    if (await isCaptchaPage(page)) {
      const solved = await waitForCaptchaSolve(page);
      if (!solved) return 0;
      await page.goto(detailUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);
    }

    // Click "Printable Version"
    const printableLink = await page.locator('a:has-text("Printable Version")').first();
    if ((await printableLink.count()) === 0) {
      console.log(`     ⚠️  No "Printable Version" link`);
      return 0;
    }

    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 15000 }).catch(() => null),
      printableLink.click()
    ]);

    if (!popup) {
      console.log(`     ⚠️  No popup opened`);
      return 0;
    }

    await popup.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await popup.waitForTimeout(2000);

    if (await isCaptchaPage(popup)) {
      const solved = await waitForCaptchaSolve(popup);
      if (!solved) { await popup.close().catch(() => {}); return 0; }
    }

    // Wait for images to load
    console.log(`     ⏳ Waiting for images to load...`);
    try {
      await popup.waitForFunction(() => {
        const imgs = document.querySelectorAll('img');
        if (imgs.length === 0) return true;
        return Array.from(imgs).every(img => img.complete && img.naturalWidth > 0);
      }, { timeout: IMAGE_LOAD_TIMEOUT_MS });
    } catch {
      console.log(`     ⚠️  Some images may not have loaded (timeout)`);
    }
    await popup.waitForTimeout(3000);

    // Extract all label images from the page.
    // TTB label images are large <img> tags (naturalWidth > 100).
    // Skip tiny icons, logos, spacer GIFs, etc.
    const imageDataList = await popup.evaluate(() => {
      const imgs = document.querySelectorAll('img');
      const results = [];
      for (const img of imgs) {
        // Skip tiny images (icons, spacers)
        if (img.naturalWidth < 100 || img.naturalHeight < 100) continue;
        // Skip images that failed to load
        if (!img.complete || img.naturalWidth === 0) continue;

        // Draw to canvas to get pixel data
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        
        // Check if image is mostly white (signature or blank)
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let whiteCount = 0;
        const totalPixels = canvas.width * canvas.height;
        for (let p = 0; p < imgData.length; p += 4) {
          const avg = (imgData[p] + imgData[p+1] + imgData[p+2]) / 3;
          if (avg > 235) whiteCount++;
        }
        const whiteFrac = whiteCount / totalPixels;

        results.push({
          src: img.src,
          width: img.naturalWidth,
          height: img.naturalHeight,
          dataUrl,
          alt: img.alt || '',
          whiteFrac,
        });
      }
      return results;
    });

    await popup.close().catch(() => {});

    if (imageDataList.length === 0) {
      console.log(`     ⚠️  No label images found on page`);
      return 0;
    }

    // Save each image
    let saved = 0;
    // Remove old files for this ID if --force
    if (force) {
      for (const f of readdirSync(OUTPUT_DIR).filter(f => f.startsWith(ttbId))) {
        unlinkSync(join(OUTPUT_DIR, f));
      }
    }

    for (let i = 0; i < imageDataList.length; i++) {
      const img = imageDataList[i];
      const base64 = img.dataUrl.replace(/^data:image\/png;base64,/, '');
      const buf = Buffer.from(base64, 'base64');
      
      // Skip very small files (probably broken/placeholder)
      if (buf.length < 5000) {
        console.log(`     ⚠️  Image ${i + 1}: too small (${buf.length} bytes), skipping`);
        continue;
      }

      // Skip signatures and blank images (>95% white pixels)
      // Real labels with white backgrounds are typically <95%; signatures are 97%+
      if (img.whiteFrac > 0.95) {
        console.log(`     ⚠️  Image ${i + 1}: ${img.width}×${img.height} — skipped (${(img.whiteFrac * 100).toFixed(0)}% white, likely signature)`);
        continue;
      }

      saved++;
      const outPath = join(OUTPUT_DIR, `${ttbId}-${saved}.png`);
      writeFileSync(outPath, buf);
      console.log(`     ✅ Label ${saved}: ${img.width}×${img.height} (${(img.whiteFrac * 100).toFixed(0)}% white) → ${outPath}`);
    }

    return saved;

  } catch (err) {
    console.error(`     ❌ Error: ${err.message}`);
    return 0;
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🏛️  TTB COLA Label Image Downloader (direct <img> extraction)');
  console.log('═'.repeat(60));

  mkdirSync(OUTPUT_DIR, { recursive: true });

  let records = loadRecords();
  console.log(`📦 Loaded ${records.length} records`);

  if (downloadBroken) {
    records = records.filter(r => BROKEN_IDS.includes(r.ttbId));
    console.log(`🔄 Targeting ${records.length} broken IDs: ${BROKEN_IDS.join(', ')}`);
  } else if (singleTtbId) {
    records = records.filter(r => r.ttbId === singleTtbId);
  } else if (!downloadAll && !prefixFilter) {
    console.error('❌ Specify --broken, --ttbid XXXX, --prefix XX, or --all');
    process.exit(1);
  }

  // Filter by prefix (e.g. --prefix 26 for 2026 records)
  if (prefixFilter) {
    records = records.filter(r => r.ttbId.startsWith(prefixFilter));
    console.log(`🔍 Filtered to ${records.length} records with prefix '${prefixFilter}'`);
  }

  // When using --limit, shuffle to get a diverse category mix
  if (downloadLimit < Infinity) {
    // Interleave categories: pick from beer, wine, spirits round-robin
    const byCategory = { beer: [], wine: [], spirits: [] };
    for (const r of records) byCategory[r.category]?.push(r) || (byCategory.spirits.push(r));
    const interleaved = [];
    const cats = ['beer', 'wine', 'spirits'];
    let idx = 0;
    while (interleaved.length < records.length) {
      const cat = cats[idx % 3];
      if (byCategory[cat].length > 0) interleaved.push(byCategory[cat].shift());
      idx++;
      if (cats.every(c => byCategory[c].length === 0)) break;
    }
    records = interleaved;
    console.log(`🔀 Shuffled for category diversity (limit: ${downloadLimit})`);
  }

  console.log(`🎯 Will download images for ${records.length} COLA records`);
  console.log('═'.repeat(60));

  const browser = await chromium.launch({
    headless,
    slowMo: 200,
  });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  // Establish session
  console.log('🌐 Establishing session with TTB Online...');
  await page.goto('https://www.ttbonline.gov/colasonline/publicSearchColasBasic.do', {
    waitUntil: 'networkidle', timeout: 30000
  });
  await page.waitForTimeout(2000);
  if (await isCaptchaPage(page)) {
    await waitForCaptchaSolve(page);
  }
  console.log('✅ Session established\n');

  let totalImages = 0;
  let successForms = 0;
  let newDownloads = 0;
  let skippedForms = 0;

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const label = `${rec.brandName}${rec.fancifulName ? ' ' + rec.fancifulName : ''}`;
    console.log(`\n[${i + 1}/${records.length}] ${'─'.repeat(40)}`);

    // Check if already downloaded (before calling downloadLabelImages)
    const existingBefore = readdirSync(OUTPUT_DIR).filter(f => f.startsWith(rec.ttbId) && f.endsWith('.png')).length;

    const count = await downloadLabelImages(page, rec.ttbId, label);
    totalImages += count;
    if (count > 0) successForms++;

    // Only count as "new" if we didn't have images before
    if (existingBefore === 0 && count > 0) {
      newDownloads++;
    } else if (existingBefore > 0) {
      skippedForms++;
    }

    if (newDownloads >= downloadLimit) {
      console.log(`\n  🎯 Reached limit of ${downloadLimit} NEW downloads`);
      break;
    }

    // Only delay between actual network requests (not skips)
    if (existingBefore === 0 && i < records.length - 1) {
      await page.waitForTimeout(DELAY_BETWEEN_REQUESTS_MS);
    }
  }

  await browser.close();

  console.log('\n' + '═'.repeat(60));
  console.log(`📊 SUMMARY:`);
  console.log(`   New downloads: ${newDownloads}`);
  console.log(`   Skipped (already had): ${skippedForms}`);
  console.log(`   Total forms with images: ${successForms}`);
  console.log(`   Images downloaded: ${totalImages}`);
  console.log(`📁 Output: ${OUTPUT_DIR}`);
}

main().catch(console.error);
