#!/usr/bin/env node
/**
 * TTB COLA Label Image Scraper
 * 
 * Navigates to each COLA detail page on ttbonline.gov, clicks "Printable Version",
 * and captures a screenshot of the approved label image.
 * 
 * Usage: node scrape-ttb-labels.mjs [--limit N] [--ttbid XXXX] [--headless]
 *        node scrape-ttb-labels.mjs --rescrape-broken
 * 
 * Flags:
 *   --rescrape-broken  Re-scrape the 3 known broken images (forces re-download)
 *   --force            Re-download even if file already exists
 *   --no-wait          Skip manual "press Enter" confirmation prompt
 *   --headless         Run headless (no browser window, implies --no-wait)
 *   --ttbid XXXX       Scrape only this specific TTB ID
 *   --limit N          Process at most N records
 * 
 * By default runs HEADED so you can solve CAPTCHAs manually.
 * Output: ../sample_labels/ttb_images/<ttbId>.png
 */

import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync, statSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Config ──────────────────────────────────────────────────────────────────
const RECORDS_PATH = join(__dirname, '..', 'sample_labels', 'ttb_cola_records.json');
const OUTPUT_DIR = join(__dirname, '..', 'sample_labels', 'ttb_images');
const COLA_DETAIL_BASE = 'https://www.ttbonline.gov/colasonline/viewColaDetails.do';
const DELAY_BETWEEN_REQUESTS_MS = 6000; // Polite delay to avoid CAPTCHA triggers
const MIN_VALID_FILE_SIZE = 100_000;     // CAPTCHA screenshots are ~28KB, real COLAs are 200KB+
const CAPTCHA_WAIT_TIMEOUT_MS = 120_000; // 2 minutes to solve CAPTCHA manually
const IMAGE_LOAD_TIMEOUT_MS = 30_000;    // 30s for label images to load

// Known broken images that need re-scraping
const BROKEN_IDS = [
  '23312001000445',  // Anchor Brewing
  '24051001000312',  // Samuel Adams / Castle Brewing
  '24023001000567',  // Heineken / Monsieur Touton
];

// ── Parse CLI args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let limit = Infinity;
let singleTtbId = null;
let headless = false; // Default: HEADED so user can solve CAPTCHAs
let forceRescrape = false;
let rescrapeBroken = false;
let manualWait = true; // Pause for user to confirm images loaded

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit' && args[i + 1]) limit = parseInt(args[i + 1], 10);
  if (args[i] === '--ttbid' && args[i + 1]) singleTtbId = args[i + 1];
  if (args[i] === '--headless') { headless = true; manualWait = false; }
  if (args[i] === '--force') forceRescrape = true;
  if (args[i] === '--rescrape-broken') { rescrapeBroken = true; forceRescrape = true; }
  if (args[i] === '--no-wait') manualWait = false;
}

/** Prompt user to press Enter in terminal */
function askUser(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
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

async function waitForCaptchaSolve(pageOrPopup, label) {
  console.log(`     🔒 CAPTCHA detected! Please solve it in the browser window.`);
  console.log(`     ⏳ Waiting up to ${CAPTCHA_WAIT_TIMEOUT_MS / 1000}s for you to solve it...`);
  
  const start = Date.now();
  while (Date.now() - start < CAPTCHA_WAIT_TIMEOUT_MS) {
    await pageOrPopup.waitForTimeout(2000);
    const stillCaptcha = await isCaptchaPage(pageOrPopup);
    if (!stillCaptcha) {
      console.log(`     ✅ CAPTCHA solved! Continuing...`);
      await pageOrPopup.waitForTimeout(2000); // Let the page finish loading
      return true;
    }
  }
  console.log(`     ❌ CAPTCHA timeout — skipping this record`);
  return false;
}

function validateScreenshot(filePath) {
  try {
    const stats = statSync(filePath);
    if (stats.size < MIN_VALID_FILE_SIZE) {
      console.log(`     ⚠️  File too small (${(stats.size / 1024).toFixed(0)}KB) — likely a CAPTCHA page, deleting`);
      unlinkSync(filePath);
      return false;
    }
    console.log(`     ✅ Valid screenshot: ${(stats.size / 1024).toFixed(0)}KB`);
    return true;
  } catch { return false; }
}

// ── Scrape a single COLA ────────────────────────────────────────────────────
async function scrapeCola(page, record, outputDir) {
  const { ttbId, brandName, fancifulName, category } = record;
  const label = `${brandName}${fancifulName ? ' ' + fancifulName : ''}`;
  const outputPath = join(outputDir, `${ttbId}.png`);

  // Skip if already downloaded and valid (unless --force)
  if (existsSync(outputPath)) {
    const stats = statSync(outputPath);
    if (stats.size >= MIN_VALID_FILE_SIZE && !forceRescrape) {
      console.log(`  ⏭️  [${ttbId}] ${label} — already exists (${(stats.size / 1024).toFixed(0)}KB), skipping`);
      return { ttbId, status: 'skipped', label };
    } else {
      console.log(`  🗑️  [${ttbId}] ${label} — removing ${forceRescrape ? '(--force)' : 'invalid'} file (${(stats.size / 1024).toFixed(0)}KB)`);
      unlinkSync(outputPath);
    }
  }

  const detailUrl = `${COLA_DETAIL_BASE}?action=publicDisplaySearchBasic&ttbid=${ttbId}`;
  console.log(`  🔍 [${ttbId}] ${label} (${category})`);
  console.log(`     URL: ${detailUrl}`);

  try {
    // Step 1: Navigate to COLA detail page
    await page.goto(detailUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Check for CAPTCHA on the detail page itself
    if (await isCaptchaPage(page)) {
      const solved = await waitForCaptchaSolve(page, label);
      if (!solved) return { ttbId, status: 'captcha_timeout', label };
      // After solving, the page may need to be reloaded
      await page.goto(detailUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);
    }

    // Step 2: Look for "Printable Version" link
    const printableLink = await page.locator('a:has-text("Printable Version")').first();
    const printableLinkExists = await printableLink.count() > 0;

    if (printableLinkExists) {
      console.log(`     ✅ Found "Printable Version" link`);

      // The printable version opens in a popup
      const [popup] = await Promise.all([
        page.waitForEvent('popup', { timeout: 15000 }).catch(() => null),
        printableLink.click()
      ]);

      if (popup) {
        console.log(`     📄 Popup opened: ${popup.url()}`);
        await popup.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
        await popup.waitForTimeout(2000);

        // Check for CAPTCHA on the popup
        if (await isCaptchaPage(popup)) {
          const solved = await waitForCaptchaSolve(popup, label);
          if (!solved) {
            await popup.close().catch(() => {});
            return { ttbId, status: 'captcha_timeout', label };
          }
        }

        // Wait for ALL label images to fully load in the printable view.
        // The TTB form lazy-loads label images — they can arrive after networkidle.
        // We wait for every <img> tag to have naturalWidth > 0 (loaded).
        console.log(`     ⏳ Waiting for label images to fully render...`);
        try {
          await popup.waitForFunction(() => {
            const imgs = document.querySelectorAll('img');
            if (imgs.length === 0) return true;
            return Array.from(imgs).every(img => img.complete && img.naturalWidth > 0);
          }, { timeout: IMAGE_LOAD_TIMEOUT_MS });
        } catch {
          console.log(`     ⚠️  Some images may not have loaded (timeout after ${IMAGE_LOAD_TIMEOUT_MS/1000}s)`);
        }
        // Extra settle time after images load — some render lazily via JS
        await popup.waitForTimeout(3000);

        // Manual wait: let user visually confirm images loaded
        if (manualWait) {
          await askUser('     👀 Check the browser — are label images visible? Press ENTER to screenshot...');
        }

        // Screenshot the printable version
        await popup.screenshot({
          path: outputPath,
          fullPage: true,
          type: 'png'
        });
        await popup.close();

        // Validate the screenshot is real (not a CAPTCHA page)
        if (validateScreenshot(outputPath)) {
          console.log(`     💾 Saved: ${outputPath}`);
          return { ttbId, status: 'captured_printable', label, path: outputPath };
        }
        return { ttbId, status: 'captcha_screenshot', label };
      } else {
        console.log(`     ⚠️  No popup detected`);
      }
    } else {
      // Check if this TTB ID simply doesn't exist in the registry
      const pageContent = await page.content();
      if (pageContent.includes('No records found') || 
          pageContent.includes('no matching') ||
          (!pageContent.includes('COLA Detail') && !pageContent.includes('Printable'))) {
        console.log(`     ℹ️  TTB ID not found in registry (fabricated ID)`);
        return { ttbId, status: 'not_found', label };
      }
      console.log(`     ⚠️  No "Printable Version" link found`);
    }

    // Fallback: Screenshot the detail page
    const pageContent = await page.content();
    if (pageContent.includes('COLA Detail') || pageContent.includes('colaDetail')) {
      console.log(`     📸 Taking screenshot of detail page as fallback`);
      await page.screenshot({ path: outputPath, fullPage: true, type: 'png' });
      if (validateScreenshot(outputPath)) {
        console.log(`     💾 Saved (detail page): ${outputPath}`);
        return { ttbId, status: 'captured_detail', label, path: outputPath };
      }
    }

    console.log(`     ❌ Page appears empty or didn't load properly`);
    return { ttbId, status: 'empty_page', label };

  } catch (err) {
    console.error(`     ❌ Error: ${err.message}`);
    return { ttbId, status: 'error', label, error: err.message };
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🏛️  TTB COLA Label Image Scraper');
  console.log('═'.repeat(60));

  // Create output directory
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Load records
  let records = loadRecords();
  console.log(`📦 Loaded ${records.length} records from ${RECORDS_PATH}`);

  // Filter: --rescrape-broken targets only the known broken IDs
  if (rescrapeBroken) {
    records = records.filter(r => BROKEN_IDS.includes(r.ttbId));
    console.log(`🔄 Re-scraping ${records.length} broken images: ${BROKEN_IDS.join(', ')}`);
  }

  // Filter by single TTB ID if specified
  if (singleTtbId) {
    records = records.filter(r => r.ttbId === singleTtbId);
    if (records.length === 0) {
      console.error(`❌ TTB ID ${singleTtbId} not found in records`);
      process.exit(1);
    }
  }

  // Apply limit
  if (limit < records.length) {
    records = records.slice(0, limit);
    console.log(`🔢 Limited to ${limit} records`);
  }

  console.log(`🎯 Will scrape ${records.length} COLA records`);
  console.log('═'.repeat(60));

  // Launch browser
  const browser = await chromium.launch({
    headless,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  // First, visit the main search page to establish a session
  console.log('🌐 Establishing session with TTB Online...');
  await page.goto('https://www.ttbonline.gov/colasonline/publicSearchColasBasic.do', {
    waitUntil: 'networkidle',
    timeout: 30000
  });
  await page.waitForTimeout(2000);
  console.log('✅ Session established\n');

  // Scrape each record
  const results = [];
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    console.log(`\n[${i + 1}/${records.length}] ─────────────────────────────────`);

    const result = await scrapeCola(page, record, OUTPUT_DIR);
    results.push(result);

    // Polite delay between requests
    if (i < records.length - 1) {
      await page.waitForTimeout(DELAY_BETWEEN_REQUESTS_MS);
    }
  }

  await browser.close();

  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(60));

  const captured = results.filter(r => r.status.startsWith('captured'));
  const skipped = results.filter(r => r.status === 'skipped');
  const errors = results.filter(r => r.status === 'error' || r.status === 'empty_page');

  console.log(`  ✅ Captured: ${captured.length}`);
  console.log(`  ⏭️  Skipped (already exists): ${skipped.length}`);
  console.log(`  ❌ Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n  Failed records:');
    errors.forEach(r => console.log(`    - [${r.ttbId}] ${r.label}: ${r.error || r.status}`));
  }

  console.log(`\n📁 Output directory: ${OUTPUT_DIR}`);
  console.log('Done! 🎉');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
