#!/usr/bin/env node
/**
 * Scrape COLA detail pages to extract submitted form field values.
 *
 * The "Submitted" column is the ground truth — it's the data the applicant
 * entered on TTB Form 5100.31. This script scrapes the COLA detail page HTML
 * for each TTB ID to get these official field values.
 *
 * Fields scraped from the COLA detail page:
 *   - Brand Name, Fanciful Name
 *   - Class/Type Code (official TTB class description)
 *   - Origin Code
 *   - Grape Varietal(s), Wine Appellation
 *   - Serial #, Vendor Code
 *   - Approval Date, Status
 *   - Plant Registry / Basic Permit / Brewers No
 *   - Qualifications section (contains class/type description)
 *
 * Uses Playwright (non-headless) so user can solve CAPTCHAs when needed.
 * Supports --resume to continue after CAPTCHA interruptions.
 *
 * Usage:
 *   node scripts/pipeline/5-enrich-cola-fields.mjs [--id TTBID] [--resume] [--headless]
 *
 * Output: sample_labels/enriched_cola_fields.json
 */

import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..', '..');

const RECORDS_PATH = join(ROOT, 'sample_labels', 'ttb_cola_records.json');
const OUTPUT_PATH = join(ROOT, 'sample_labels', 'enriched_cola_fields.json');
const DETAIL_URL = 'https://www.ttbonline.gov/colasonline/viewColaDetails.do';
const CAPTCHA_TIMEOUT_MS = 120_000;

const args = process.argv.slice(2);
const headless = args.includes('--headless');
const resume = args.includes('--resume');
const singleIdIdx = args.indexOf('--id');
const singleId = singleIdIdx >= 0 ? args[singleIdIdx + 1] : null;

// ── Collect all TTB IDs from records ─────────────────────────────────────────
function getAllTtbIds() {
  const records = JSON.parse(readFileSync(RECORDS_PATH, 'utf-8'));
  const ids = [];
  for (const cat of ['beer', 'wine', 'spirits']) {
    for (const r of (records[cat] || [])) {
      ids.push({ ttbId: r.ttbId, category: cat, brand: r.brandName });
    }
  }
  return ids;
}

// ── CAPTCHA detection and handling ───────────────────────────────────────────
async function isCaptchaPage(page) {
  try {
    const text = await page.textContent('body');
    return text.includes('What code is in the image') ||
           text.includes('spam submission') ||
           text.includes('human visitor');
  } catch { return false; }
}

async function waitForCaptchaSolve(page) {
  console.log('\n  🔒 CAPTCHA detected! Please solve it in the browser window.');
  const start = Date.now();
  while (Date.now() - start < CAPTCHA_TIMEOUT_MS) {
    await page.waitForTimeout(2000);
    if (!(await isCaptchaPage(page))) {
      console.log('  ✅ CAPTCHA solved!');
      return true;
    }
  }
  console.log('  ⏰ CAPTCHA timeout — saving progress.');
  return false;
}

// ── Extract all fields from a COLA detail page ──────────────────────────────
async function scrapeColaPage(page, ttbId) {
  const url = `${DETAIL_URL}?action=publicDisplaySearchBasic&ttbid=${ttbId}`;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(600);

    if (await isCaptchaPage(page)) {
      const solved = await waitForCaptchaSolve(page);
      if (!solved) return { error: 'CAPTCHA_TIMEOUT' };
      // Retry the page after solving
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(600);
    }

    const body = await page.textContent('body').catch(() => '');
    if (!body || body.length < 200 || !body.includes('Brand Name')) {
      return { error: 'NO_DATA' };
    }

    // Extract all field values from the detail page.
    // The page structure: <strong>Label:</strong> <img help icon> VALUE
    // We grab text from each table cell that contains a <strong> label.
    const data = await page.evaluate(() => {
      const result = {};
      const cells = document.querySelectorAll('td');

      for (const cell of cells) {
        const strong = cell.querySelector('strong');
        if (!strong) continue;

        let label = strong.textContent.trim().replace(/:$/, '').trim();
        if (!label || label.length > 60) continue;

        // Get the full cell text and strip out the label + help icon text
        let cellText = cell.textContent.trim();
        // Remove the label prefix
        const idx = cellText.indexOf(label);
        if (idx < 0) continue;
        let value = cellText.slice(idx + label.length)
          .replace(/^[:\s]+/, '')
          .replace(/Open help for[^"]*"[^"]*"/g, '')  // remove help icon alt text
          .trim();

        if (value && value.length > 0 && value.length < 500) {
          result[label] = value;
        }
      }

      // Also grab the Qualifications section which has CLASS/TYPE DESCRIPTION
      const allText = document.body.textContent || '';
      const classMatch = allText.match(/CLASS\/TYPE DESCRIPTION\s+([A-Z][A-Z\s/,.'()\-]+?)(?:\s+EXPIRATION|\s*$)/m);
      if (classMatch) {
        result['_classTypeDescription'] = classMatch[1].trim();
      }

      return result;
    });

    // Map to clean field names
    return {
      fields: {
        ttbId,
        brandName: data['Brand Name'] || '',
        fancifulName: data['Fanciful Name'] || '',
        classTypeCode: data['Class/Type Code'] || '',
        originCode: data['Origin Code'] || '',
        status: data['Status'] || '',
        vendorCode: data['Vendor Code'] || '',
        serialNumber: data['Serial #'] || '',
        grapeVarietal: data['Grape Varietal(s)'] || '',
        wineAppellation: data['Wine Appellation'] || '',
        typeOfApplication: data['Type of Application'] || '',
        approvalDate: data['Approval Date'] || '',
        totalBottleCapacity: data['Total Bottle Capacity'] || '',
        forSaleIn: data['For Sale In'] || '',
        formula: data['Formula'] || '',
        plantRegistry: data['Plant Registry/Basic Permit/Brewers No (Principal Place of Business)'] || '',
        classTypeDescription: data['_classTypeDescription'] || '',
      },
    };
  } catch (err) {
    return { error: err.message };
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🏛️  TTB COLA Detail Page Scraper');
  console.log('═'.repeat(60));
  console.log('   Scraping submitted form fields from COLA detail HTML\n');

  const allIds = singleId
    ? [{ ttbId: singleId, category: 'unknown', brand: singleId }]
    : getAllTtbIds();

  // Load existing results if resuming
  let enriched = {};
  if (resume && existsSync(OUTPUT_PATH)) {
    enriched = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'));
    console.log(`📂 Resuming: ${Object.keys(enriched).length} already scraped`);
  }

  // Filter to IDs that still need scraping
  const targets = allIds.filter(({ ttbId }) => {
    if (resume && enriched[ttbId] && enriched[ttbId]._scraped) return false;
    return true;
  });
  console.log(`📋 ${targets.length} TTB IDs to scrape (${allIds.length} total)\n`);

  if (targets.length === 0) {
    console.log('✅ All records already scraped. Nothing to do.');
    return;
  }

  const browser = await chromium.launch({ headless, slowMo: 50 });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  let done = 0;
  let ok = 0;
  let failed = 0;

  for (const { ttbId, category, brand } of targets) {
    done++;
    process.stdout.write(`\r  [${done}/${targets.length}] ${ttbId} (${brand})...                    `);

    const result = await scrapeColaPage(page, ttbId);

    if (result.error) {
      if (result.error === 'CAPTCHA_TIMEOUT') {
        console.log('\n  ⏰ Saving progress. Re-run with --resume to continue.');
        break;
      }
      failed++;
      if (result.error !== 'NO_DATA') {
        console.log(`\n  ❌ ${ttbId} — ${result.error}`);
      }
    } else {
      result.fields._category = category;
      result.fields._scraped = true;
      enriched[ttbId] = result.fields;
      ok++;

      // Log notable fields
      const extras = [];
      if (result.fields.grapeVarietal) extras.push(`varietal: ${result.fields.grapeVarietal}`);
      if (result.fields.wineAppellation) extras.push(`appellation: ${result.fields.wineAppellation}`);
      if (result.fields.classTypeDescription) extras.push(`class: ${result.fields.classTypeDescription}`);
      if (extras.length) {
        console.log(`\n  ✅ ${brand} — ${extras.join(', ')}`);
      }
    }

    // Save progress every 10 records
    if (done % 10 === 0) {
      writeFileSync(OUTPUT_PATH, JSON.stringify(enriched, null, 2));
    }

    // Polite 2s delay between requests
    await page.waitForTimeout(2000);
  }

  await browser.close();

  // Final save
  writeFileSync(OUTPUT_PATH, JSON.stringify(enriched, null, 2));

  // Summary
  console.log('\n\n' + '═'.repeat(60));
  console.log('📊 Scraping Summary:');
  const total = Object.keys(enriched).length;
  let withVarietal = 0, withAppellation = 0, withClassDesc = 0, withPlantReg = 0;
  for (const r of Object.values(enriched)) {
    if (r.grapeVarietal) withVarietal++;
    if (r.wineAppellation) withAppellation++;
    if (r.classTypeDescription) withClassDesc++;
    if (r.plantRegistry) withPlantReg++;
  }
  console.log(`   Scraped:      ${ok} new (${total} total)`);
  console.log(`   Failed:       ${failed}`);
  console.log(`   Varietal:     ${withVarietal}/${total}`);
  console.log(`   Appellation:  ${withAppellation}/${total}`);
  console.log(`   Class desc:   ${withClassDesc}/${total}`);
  console.log(`   Plant reg:    ${withPlantReg}/${total}`);
  console.log(`\n💾 Saved to ${OUTPUT_PATH}`);
}

main().catch(console.error);
