#!/usr/bin/env node
/**
 * Scrape structured form fields from TTB COLA detail pages (Form 5100.31).
 *
 * Navigates to the "Printable Version" of each COLA detail page and extracts
 * ALL structured HTML fields — no OCR. These are the text fields that an
 * applicant fills out when submitting their COLA application.
 *
 * Usage:
 *   node scripts/scrape-form-fields.mjs              # scrape our 51 active IDs
 *   node scripts/scrape-form-fields.mjs --ttbid XXXX  # scrape a single ID
 *   node scripts/scrape-form-fields.mjs --headless     # run headless (no browser)
 *   node scripts/scrape-form-fields.mjs --force        # re-scrape even if already have data
 *
 * Output: sample_labels/ttb_cola_form_fields.json
 *
 * Requires: npx playwright install chromium
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_PATH = join(__dirname, '..', 'sample_labels', 'ttb_cola_form_fields.json');
const COLA_DETAIL_BASE = 'https://www.ttbonline.gov/colasonline/viewColaDetails.do';
const DELAY_MS = 4000;
const CAPTCHA_WAIT_MS = 120_000;

// ── Our 51 active TTB IDs ───────────────────────────────────────────────────
const ACTIVE_IDS = [
  "23312001000445", "23356001000155", "24003001000001", "24003001000008",
  "24003001000078", "24003001000085", "24003001000113", "24003001000169",
  "24003001000190", "24003001000200", "24003001000225", "24003001000281",
  "24003001000325", "24003001000330", "24003001000350", "24003001000393",
  "24003001000414", "24003001000421", "24003001000477", "24003001000484",
  "24003001000525", "24003001000561", "24003001000582", "24003001000600",
  "24003001000638", "24003001000645", "24003001000666", "24003001000700",
  "24003001000701", "24003001000715", "24003001000722", "24003001000736",
  "24012001000123", "24012001000345", "24012001000567", "24012001000891",
  "24023001000345", "24023001000567", "24023001000678", "24034001000123",
  "24045001000123", "24045001000234", "24045001000567", "24045001000891",
  "24067001000456", "24078001000345", "24078001000678", "24078001000891",
  "24089001000156", "24089001000456", "24089001000678",
];

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let headless = args.includes('--headless');
let force = args.includes('--force');
let singleId = null;
const idIdx = args.indexOf('--ttbid');
if (idIdx >= 0 && args[idIdx + 1]) singleId = args[idIdx + 1];

// ── CAPTCHA handling ────────────────────────────────────────────────────────
async function isCaptchaPage(p) {
  try {
    const c = await p.content();
    return c.includes('What code is in the image') ||
           c.includes('spam submission') ||
           c.includes('human visitor');
  } catch { return false; }
}

async function waitForCaptchaSolve(p) {
  console.log(`     🔒 CAPTCHA! Solve it in the browser window...`);
  const start = Date.now();
  while (Date.now() - start < CAPTCHA_WAIT_MS) {
    await p.waitForTimeout(2000);
    if (!(await isCaptchaPage(p))) {
      console.log(`     ✅ CAPTCHA solved!`);
      await p.waitForTimeout(5000);
      return true;
    }
  }
  console.log(`     ❌ CAPTCHA timeout`);
  return false;
}

// ── Field extraction from printable form ────────────────────────────────────
async function extractFormFields(popup) {
  return await popup.evaluate(() => {
    const result = {};
    const tds = document.querySelectorAll('td');

    // Collect all non-trivial cell text (smallest cells only — avoid nested dupes)
    const cells = [];
    for (const td of tds) {
      // Only use leaf-ish cells (no child tables)
      if (td.querySelector('table')) continue;
      const text = td.textContent.trim().replace(/\s+/g, ' ');
      if (text.length >= 3 && text.length <= 600) cells.push(text);
    }

    // Also collect from parent cells that contain the full merged content
    for (const td of tds) {
      const text = td.textContent.trim().replace(/\s+/g, ' ');
      if (text.length >= 10 && text.length <= 600 && !cells.includes(text)) {
        cells.push(text);
      }
    }

    // ── Regex-based field extraction ──────────────────────────────────────
    // TTB form fields follow patterns like:
    //   "6. BRAND NAME (Required) SIERRA NEVADA"
    //   "TTB ID 24003001000645"
    //   "12. PHONE NUMBER (530) 899-6141"

    for (const text of cells) {
      // TTB ID
      let m;
      if ((m = text.match(/^TTB ID\s+(\d{14})/))) {
        result.ttbId = m[1];
      }

      // REP ID
      if ((m = text.match(/REP\.?\s*ID\.?\s*NO\.?\s*\(If any\)\s*(.*)/i))) {
        const val = m[1].trim();
        if (val && val.length > 1 && val.length < 50) result.repId = val;
      }

      // 2. Plant Registry / Basic Permit / Brewer's No.
      if (text.includes('PLANT REGISTRY') && (m = text.match(/Required\)\s+([A-Z]{2}-[A-Z]+-[A-Z0-9-]+(?:\s+[A-Z]{2}-[A-Z]+-[A-Z0-9-]+)*)/))) {
        result.permitNumber = m[1].trim();
      }

      // 3. Source of Product — the form lists both options but only one is "checked".
      // We check for standalone short cells: just "Domestic" or "Imported"
      if (text === 'Domestic' && !result.sourceOfProduct) result.sourceOfProduct = 'Domestic';
      if (text === 'Imported' && !result.sourceOfProduct) result.sourceOfProduct = 'Imported';

      // 4. Serial Number
      if ((m = text.match(/SERIAL NUMBER\s*\(Required\)\s*(\w+)/))) {
        result.serialNumber = m[1];
      }

      // 5. Type of Product — need to figure out which is checked
      // The cell lists all options: "WINE DISTILLED SPIRITS MALT BEVERAGE"
      // We'll infer from the class type later

      // 6. Brand Name
      if ((m = text.match(/^6\.\s*BRAND NAME\s*\(Required\)\s+(.+)/))) {
        result.brandName = m[1].trim();
      }

      // 7. Fanciful Name
      if ((m = text.match(/^7\.\s*FANCIFUL NAME\s*\(If any\)\s+(.+)/))) {
        const val = m[1].trim();
        if (val && val !== 'N/A' && val.length > 0) result.fancifulName = val;
      }

      // 8. Applicant Name and Address
      if (text.includes('NAME AND ADDRESS OF APPLICANT')) {
        // Extract the actual address after the label text
        const afterLabel = text.replace(/.*?(?:Required\)\s*)/i, '').trim();
        if (afterLabel && afterLabel.length > 5) {
          result.applicantNameAddress = afterLabel;
          // Try to parse into company name and address
          const zipMatch = afterLabel.match(/(.+?)\s+(\d+\s+.+?\b[A-Z]{2}\s+\d{5}(?:-\d{4})?)/);
          if (zipMatch) {
            result.applicantName = zipMatch[1].trim();
            result.applicantStreetAddress = zipMatch[2].trim();
          }
          // Extract "Used on label" trade name
          const tradeMatch = afterLabel.match(/([A-Z][A-Z\s&'.]+?)\s*\(Used on label\)/);
          if (tradeMatch) {
            result.tradeName = tradeMatch[1].trim();
          }
        }
      }

      // 8a. Mailing Address — only capture if there's a real address after the label
      if (text.includes('MAILING ADDRESS') && (m = text.match(/MAILING ADDRESS.*?DIFFERENT\s+(.+?)\s*\(If different from above\)/))) {
        result.mailingAddress = m[1].trim();
      }

      // 9. Formula
      if ((m = text.match(/^9\.\s*FORMULA\s+(.+)/))) {
        const val = m[1].trim();
        if (val && val.length > 0) result.formula = val;
      }

      // 10. Grape Varietal(s)
      if (text.includes('GRAPE VARIETAL') && (m = text.match(/GRAPE VARIETAL\(S\)\s*(?:\(Wine Only\))?\s*(.+?)\s*(?:\(N\/A\)|\(N\/A\))?\s*$/))) {
        const val = m[1].trim();
        if (val && val !== 'N/A' && val.length > 1) result.grapeVarietal = val;
      }

      // 11. Wine Appellation
      if ((m = text.match(/WINE APPELLATION.*?\)\s+(.+)/i))) {
        const val = m[1].trim();
        if (val && val !== 'N/A' && val.length > 0) result.wineAppellation = val;
      }
      // Simpler pattern: just "11. WINE APPELLATION ..." at start
      if (!result.wineAppellation && (m = text.match(/^11\.\s*WINE APPELLATION\s*(?:\(.*?\))?\s+([A-Z].+)/))) {
        const val = m[1].trim();
        if (val && val !== 'N/A') result.wineAppellation = val;
      }

      // 12. Phone Number
      if ((m = text.match(/PHONE NUMBER\s*(.+)/i))) {
        const val = m[1].trim();
        const phone = val.match(/\(?\d{3}\)?\s*[-.]?\s*\d{3}\s*[-.]?\s*\d{4}/);
        if (phone) result.phoneNumber = phone[0];
      }

      // 13. Email Address
      if ((m = text.match(/EMAIL ADDRESS\s+(\S+@\S+)/i))) {
        result.emailAddress = m[1].trim();
      }

      // 14. Type of Application — short standalone cells indicate the checked option
      if (text === 'CERTIFICATE OF LABEL APPROVAL') {
        result.applicationType = 'Certificate of Label Approval';
      }
      if (text === 'CERTIFICATE OF EXEMPTION FROM LABEL APPROVAL') {
        result.applicationType = 'Certificate of Exemption';
      }

      // 15. Embossed/Blown info (includes net contents sometimes!)
      if (text.includes('SHOW ANY INFORMATION') && text.includes('BLOWN')) {
        // Extract text after "...ON LABELS." or "...APPEARING ON LABELS"
        const afterLabel = text.replace(/.*?(?:ON LABELS\.?|APPEARING ON LABELS\.?)\s*/i, '').trim();
        // Also try after "...FOREIGN LANGUAGE TEXT APPEARING ON LABELS."
        const afterFull = text.replace(/.*?LABELS\.\s*/g, '').trim();
        const val = afterLabel.length > afterFull.length ? afterFull : afterLabel;
        if (val && val.length > 2 && !val.startsWith('PART ')) {
          result.embossedInfo = val;
          // Try to extract net contents from embossed info
          const netMatch = val.match(/(?:NET CONTENTS?|STATED AS)\s*["']?([^"'\n,]+?(?:FL\.?\s*OZ|mL|LITER|GALLON|L\b)[^"'\n,]*)/i);
          if (netMatch) result.netContents = netMatch[1].trim().replace(/["']/g, '');
        }
      }

      // 16. Date of Application
      if ((m = text.match(/DATE OF APPLICATION\s+(\d{1,2}\/\d{1,2}\/\d{4})/))) {
        result.applicationDate = m[1];
      }

      // 18. Print Name of Applicant
      if ((m = text.match(/PRINT NAME OF APPLICANT.*?AGENT\s+(.+)/))) {
        const val = m[1].trim();
        if (val && val.length > 1) result.applicantContactName = val;
      }

      // 19. Date Issued
      if ((m = text.match(/DATE ISSUED\s+(\d{1,2}\/\d{1,2}\/\d{4})/))) {
        result.dateIssued = m[1];
      }

      // STATUS
      if (text.startsWith('STATUS') || text.match(/^STATUS\s/)) {
        // Will be extracted below from body text
      }

      // EXPIRATION DATE
      if ((m = text.match(/EXPIRATION DATE.*?(\d{1,2}\/\d{1,2}\/\d{4})/))) {
        result.expirationDate = m[1];
      }
    }

    // ── Extract from full body text ───────────────────────────────────────
    const body = document.body.textContent.replace(/\s+/g, ' ');

    // STATUS + INDUSTRY/TYPE DESCRIPTION block (appears near bottom of form)
    const statusMatch = body.match(/STATUS\s+(APPROVED|EXPIRED|SURRENDERED|REVOKED)/i);
    if (statusMatch) result.status = statusMatch[1].toUpperCase();

    const industryMatch = body.match(/INDUSTRY\/TYPE DESCRIPTION\s+([A-Z][A-Z\s/(),-]+?)(?:\s{2,}|AFFIX|COMPLETED)/);
    if (industryMatch) result.industryTypeDescription = industryMatch[1].trim();

    const completedMatch = body.match(/COMPLETED DATE\s+(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (completedMatch) result.completedDate = completedMatch[1];

    // ── Grab raw cells for debugging ─────────────────────────────────────
    const rawCells = [];
    for (const td of tds) {
      const text = td.textContent.trim().replace(/\s+/g, ' ');
      if (text.length >= 3 && text.length <= 600 &&
          !text.startsWith('For TTB Use') &&
          !text.includes('GOVERNMENT WARNING')) {
        rawCells.push(text);
      }
    }
    result._rawCells = rawCells;

    return result;
  });
}

// ── Scrape one TTB ID ───────────────────────────────────────────────────────
async function scrapeOne(page, ttbId) {
  const detailUrl = `${COLA_DETAIL_BASE}?action=publicDisplaySearchBasic&ttbid=${ttbId}`;

  try {
    await page.goto(detailUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    if (await isCaptchaPage(page)) {
      const solved = await waitForCaptchaSolve(page);
      if (!solved) return null;
      await page.goto(detailUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);
    }

    // Click "Printable Version" to get the full Form 5100.31
    const printableLink = await page.locator('a:has-text("Printable Version")').first();
    if ((await printableLink.count()) === 0) {
      console.log(`     ⚠️  No "Printable Version" link`);

      // Try extracting from the detail page itself as fallback
      const fallbackData = await extractFormFields(page);
      return { ...fallbackData, _source: 'detail_page' };
    }

    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 15000 }).catch(() => null),
      printableLink.click()
    ]);

    if (!popup) {
      console.log(`     ⚠️  No popup opened, trying detail page`);
      const fallbackData = await extractFormFields(page);
      return { ...fallbackData, _source: 'detail_page' };
    }

    await popup.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await popup.waitForTimeout(2000);

    if (await isCaptchaPage(popup)) {
      const solved = await waitForCaptchaSolve(popup);
      if (!solved) { await popup.close().catch(() => {}); return null; }
    }

    // Wait for page to fully render
    await popup.waitForTimeout(1000);

    const data = await extractFormFields(popup);
    await popup.close().catch(() => {});

    return { ...data, _source: 'printable_form' };
  } catch (err) {
    console.log(`     ❌ Error: ${err.message}`);
    return null;
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const idsToScrape = singleId ? [singleId] : ACTIVE_IDS;
  console.log(`🏛️  TTB COLA Form Field Scraper`);
  console.log(`═`.repeat(60));
  console.log(`🎯 ${idsToScrape.length} TTB IDs to scrape\n`);

  // Load existing data
  let existing = {};
  if (existsSync(OUTPUT_PATH) && !force) {
    existing = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'));
    console.log(`📂 Loaded ${Object.keys(existing).length} existing records`);
  }

  // Filter out already-scraped IDs (unless --force)
  const todo = idsToScrape.filter(id => force || !existing[id]);
  console.log(`📋 ${todo.length} IDs to scrape (${idsToScrape.length - todo.length} already done)\n`);

  if (todo.length === 0) {
    console.log('✅ All IDs already scraped. Use --force to re-scrape.');
    process.exit(0);
  }

  const browser = await chromium.launch({ headless, slowMo: 100 });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  // Establish session
  console.log('🌐 Establishing session...');
  await page.goto('https://www.ttbonline.gov/colasonline/publicSearchColasBasic.do', {
    waitUntil: 'networkidle', timeout: 30000
  });
  await page.waitForTimeout(2000);
  if (await isCaptchaPage(page)) await waitForCaptchaSolve(page);
  console.log('✅ Session established\n');

  let scraped = 0;
  let failed = 0;

  for (const ttbId of todo) {
    process.stdout.write(`  [${scraped + failed + 1}/${todo.length}] ${ttbId}...`);

    const data = await scrapeOne(page, ttbId);
    if (data) {
      existing[ttbId] = { ttbId, ...data, scrapedAt: new Date().toISOString() };
      scraped++;
      const fields = Object.keys(data).filter(k => !k.startsWith('_') && data[k]);
      console.log(` ✅ ${fields.length} fields`);
    } else {
      failed++;
      console.log(` ❌ failed`);
    }

    // Save after each successful scrape
    writeFileSync(OUTPUT_PATH, JSON.stringify(existing, null, 2) + '\n', 'utf-8');

    // Delay between requests
    if (todo.indexOf(ttbId) < todo.length - 1) {
      await page.waitForTimeout(DELAY_MS);
    }
  }

  await browser.close();

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ Scraped: ${scraped}, Failed: ${failed}`);
  console.log(`📄 Saved to ${OUTPUT_PATH}`);

  // Summary of field coverage
  const allRecords = Object.values(existing);
  const fieldCounts = {};
  for (const rec of allRecords) {
    for (const [k, v] of Object.entries(rec)) {
      if (k.startsWith('_') || !v) continue;
      fieldCounts[k] = (fieldCounts[k] || 0) + 1;
    }
  }
  console.log(`\n📊 Field coverage (${allRecords.length} records):`);
  for (const [field, count] of Object.entries(fieldCounts).sort((a, b) => b[1] - a[1])) {
    const pct = Math.round(100 * count / allRecords.length);
    console.log(`   ${field}: ${count}/${allRecords.length} (${pct}%)`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
