#!/usr/bin/env node
/**
 * TTB COLA Record Search — uses the Advanced Search form instead of brute-force probing.
 *
 * Navigates to the TTB Public COLA Registry Advanced Search, fills in date range
 * and status filters, and extracts approved records from search results.
 *
 * Usage:
 *   node scripts/search-ttb-records.mjs --target 15
 *   node scripts/search-ttb-records.mjs --target 15 --category beer
 *   node scripts/search-ttb-records.mjs --target 15 --headless
 *
 * The script will:
 *   1. Open the Advanced Search page
 *   2. Discover available form fields
 *   3. Search for approved COLAs in the specified date range
 *   4. Extract records from search results
 *   5. Merge new records into ttb_cola_records.json
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'sample_labels', 'ttb_cola_records.json');
const ADVANCED_SEARCH_URL = 'https://www.ttbonline.gov/colasonline/publicSearchColasAdvanced.do';
const CAPTCHA_WAIT_TIMEOUT_MS = 120_000;

const args = process.argv.slice(2);
let headless = args.includes('--headless');
let TARGET = 15;
const targetIdx = args.indexOf('--target');
if (targetIdx >= 0 && args[targetIdx + 1]) TARGET = parseInt(args[targetIdx + 1]);
let categoryFilter = null;
const catIdx = args.indexOf('--category');
if (catIdx >= 0 && args[catIdx + 1]) categoryFilter = args[catIdx + 1].toLowerCase();
const discoverOnly = args.includes('--discover');

// ── CAPTCHA handling ────────────────────────────────────────────────────────
async function isCaptchaPage(page) {
  const body = await page.textContent('body').catch(() => '');
  return body.includes('unusual traffic') || body.includes('captcha') ||
         body.includes('CAPTCHA') || body.includes('robot');
}

async function waitForCaptchaSolve(page) {
  console.log('\n  🔒 CAPTCHA detected! Please solve it in the browser window...');
  const start = Date.now();
  while (Date.now() - start < CAPTCHA_WAIT_TIMEOUT_MS) {
    await page.waitForTimeout(2000);
    if (!(await isCaptchaPage(page))) {
      console.log('  ✅ CAPTCHA solved!');
      await page.waitForTimeout(1000);
      return true;
    }
  }
  console.log('  ❌ CAPTCHA timeout');
  return false;
}

// ── Classify a COLA record into beer/wine/spirits ───────────────────────────
function classifyCategory(classType) {
  if (!classType) return 'spirits';
  const ct = classType.toUpperCase().trim();

  // Handle numeric TTB class/type codes
  const num = parseInt(ct.replace(/\D/g, ''));
  if (!isNaN(num)) {
    // TTB code ranges: 80-89 = wine, 900-999 = beer/malt, 600-799 = spirits specialties
    if (num >= 80 && num <= 89) return 'wine';
    if (num >= 900 && num <= 999) return 'beer';
    if (num >= 1 && num <= 79) return 'spirits';   // whisky, brandy, rum, etc.
    if (num >= 600 && num <= 799) return 'spirits'; // cocktails, RTDs
  }

  const beerTerms = ['ALE', 'LAGER', 'STOUT', 'PORTER', 'IPA', 'PILSNER', 'MALT',
    'BEER', 'SAISON', 'WHEAT', 'KOLSCH', 'GOSE', 'SOUR', 'AMBER', 'BLONDE',
    'PALE ALE', 'CREAM ALE', 'HEFEWEIZEN', 'BOCK', 'DUNKEL', 'MARZEN',
    'CIDER', 'HARD SELTZER', 'SELTZER'];
  const wineTerms = ['WINE', 'CABERNET', 'CHARDONNAY', 'MERLOT', 'PINOT',
    'SAUVIGNON', 'RIESLING', 'ZINFANDEL', 'SYRAH', 'SHIRAZ', 'MALBEC',
    'TEMPRANILLO', 'SANGIOVESE', 'GRENACHE', 'VIOGNIER', 'ROSE', 'ROSÉ',
    'CHAMPAGNE', 'PROSECCO', 'SPARKLING', 'MOSCATO', 'PORT', 'SHERRY',
    'VERMOUTH', 'TABLE WINE', 'RED WINE', 'WHITE WINE', 'BLEND'];
  for (const t of beerTerms) { if (ct.includes(t)) return 'beer'; }
  for (const t of wineTerms) { if (ct.includes(t)) return 'wine'; }
  return 'spirits';
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🏛️  TTB COLA Record Search (Advanced Search form)');
  console.log('═'.repeat(60));
  console.log(`🎯 Target: ${TARGET} new records`);
  if (categoryFilter) console.log(`🏷️  Category filter: ${categoryFilter}`);
  console.log();

  const browser = await chromium.launch({ headless, slowMo: 200 });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  // Load existing records
  let existing = { beer: [], wine: [], spirits: [] };
  if (existsSync(OUTPUT_PATH)) {
    existing = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'));
    console.log(`📂 Loaded existing: ${existing.beer.length} beer, ${existing.wine.length} wine, ${existing.spirits.length} spirits`);
  }
  const existingIds = new Set();
  const seenBrands = new Set();
  for (const cat of ['beer', 'wine', 'spirits']) {
    for (const r of (existing[cat] || [])) {
      existingIds.add(r.ttbId);
      seenBrands.add(r.brandName.split(' ').slice(0, 2).join(' '));
    }
  }
  console.log(`   ${existingIds.size} existing IDs to skip\n`);

  // Navigate to Advanced Search
  console.log('🌐 Loading Advanced Search page...');
  await page.goto(ADVANCED_SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  if (await isCaptchaPage(page)) {
    const solved = await waitForCaptchaSolve(page);
    if (!solved) { await browser.close(); return; }
    await page.goto(ADVANCED_SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
  }

  // Discover form fields
  console.log('🔍 Discovering form fields...');
  const formFields = await page.evaluate(() => {
    const fields = [];
    // Inputs
    for (const el of document.querySelectorAll('input[type="text"], input[type="date"], input[type="hidden"]')) {
      fields.push({
        tag: 'input', type: el.type, name: el.name, id: el.id,
        value: el.value, placeholder: el.placeholder,
        label: el.closest('tr')?.querySelector('td')?.textContent?.trim()?.slice(0, 60) || ''
      });
    }
    // Selects
    for (const el of document.querySelectorAll('select')) {
      const options = [...el.options].map(o => ({ value: o.value, text: o.text.trim() }));
      fields.push({
        tag: 'select', name: el.name, id: el.id, options,
        label: el.closest('tr')?.querySelector('td')?.textContent?.trim()?.slice(0, 60) || ''
      });
    }
    // Submit buttons
    for (const el of document.querySelectorAll('input[type="submit"], button[type="submit"]')) {
      fields.push({ tag: 'submit', name: el.name, id: el.id, value: el.value });
    }
    return fields;
  });

  console.log(`\n📋 Found ${formFields.length} form fields:`);
  for (const f of formFields) {
    if (f.tag === 'select') {
      const optList = f.options.slice(0, 5).map(o => `${o.value}="${o.text}"`).join(', ');
      console.log(`  [${f.tag}] name="${f.name}" id="${f.id}" label="${f.label}" options=[${optList}${f.options.length > 5 ? '...' : ''}]`);
    } else {
      console.log(`  [${f.tag}] name="${f.name}" id="${f.id}" type="${f.type || ''}" value="${f.value || ''}" label="${f.label || ''}" placeholder="${f.placeholder || ''}"`);
    }
  }

  if (discoverOnly) {
    console.log('\n🔍 Discovery mode — not searching. Use this info to configure search.');
    await browser.close();
    return;
  }

  // ── Fill in the search form with exact TTB field names ──────────────────
  const fromDate = '01/01/2026';
  const toDate = '02/18/2026';

  // Clear and fill date range (narrowed to 2026 only)
  await page.fill('#datecompletedfrom', '');
  await page.fill('#datecompletedfrom', fromDate);
  console.log(`\n📅 Set date from: ${fromDate}`);

  await page.fill('#datecompletedto', '');
  await page.fill('#datecompletedto', toDate);
  console.log(`📅 Set date to: ${toDate}`);

  // Submit search
  console.log('\n🔎 Submitting search...');
  await page.click('input[type="submit"][value="Search"]');

  await page.waitForTimeout(3000);
  if (await isCaptchaPage(page)) {
    const solved = await waitForCaptchaSolve(page);
    if (!solved) { await browser.close(); return; }
  }

  // Parse results
  const found = new Map();
  let pageNum = 0;
  const MAX_PAGES = 20;

  while (found.size < TARGET && pageNum < MAX_PAGES) {
    pageNum++;
    console.log(`\n📄 Parsing results page ${pageNum}...`);

    // Check for results table or "no results" message
    const bodyText = await page.textContent('body').catch(() => '');
    if (bodyText.includes('No results') || bodyText.includes('no matching') || bodyText.includes('Your search returned 0')) {
      console.log('  ⚠️  No results found. Try adjusting date range or search criteria.');
      break;
    }

    // Try to extract data from the results table
    const rows = await page.evaluate(() => {
      const results = [];
      // Look for result table rows — TTB uses various table layouts
      const tables = document.querySelectorAll('table');
      for (const table of tables) {
        const trs = table.querySelectorAll('tr');
        if (trs.length < 2) continue; // Skip tables with no data rows

        // Find header row to understand column layout
        const headerRow = trs[0];
        const headers = [...headerRow.querySelectorAll('th, td')].map(h => h.textContent.trim().toLowerCase());

        // Skip non-data tables
        if (!headers.some(h => h.includes('brand') || h.includes('ttb') || h.includes('cola'))) continue;

        for (let i = 1; i < trs.length; i++) {
          const cells = [...trs[i].querySelectorAll('td')];
          if (cells.length < 3) continue;

          const row = {};
          for (let j = 0; j < headers.length && j < cells.length; j++) {
            row[headers[j]] = cells[j].textContent.trim();
          }

          // Also look for links (TTB ID links to detail page)
          const link = trs[i].querySelector('a[href*="ttbid"]') || trs[i].querySelector('a[href*="viewCola"]');
          if (link) {
            row._href = link.href;
            const idMatch = link.href.match(/ttbid=(\d+)/i);
            if (idMatch) row._ttbId = idMatch[1];
          }

          // Try to extract TTB ID from first cell link if not found above
          if (!row._ttbId) {
            const firstLink = cells[0]?.querySelector('a');
            if (firstLink) {
              const text = firstLink.textContent.trim().replace(/\D/g, '');
              if (text.length >= 14) row._ttbId = text;
              row._href = firstLink.href;
            }
          }

          if (row._ttbId || Object.keys(row).length >= 3) {
            results.push(row);
          }
        }
      }
      return results;
    });

    console.log(`  Found ${rows.length} rows on this page`);

    if (rows.length === 0) {
      // Maybe the results are displayed differently — let's dump some page info
      const pageInfo = await page.evaluate(() => {
        const tables = document.querySelectorAll('table');
        return {
          tableCount: tables.length,
          url: window.location.href,
          title: document.title,
          bodyLength: document.body.textContent.length,
          firstTableHtml: tables[0]?.outerHTML?.slice(0, 500) || 'no tables',
          links: [...document.querySelectorAll('a')].slice(0, 10).map(a => ({
            text: a.textContent.trim().slice(0, 50),
            href: a.href
          })),
        };
      });
      console.log('  📊 Page info:', JSON.stringify(pageInfo, null, 2));
      break;
    }

    // Process each row
    for (const row of rows) {
      if (found.size >= TARGET) break;

      const ttbId = row._ttbId || row['ttb id'] || row['cola id'] || '';
      if (!ttbId || existingIds.has(ttbId)) continue;
      if (!ttbId.startsWith('26')) continue; // Only 2026 records

      // Extract what we can from the table row
      const brandName = row['brand name'] || row['brand'] || '';
      const fancifulName = row['fanciful name'] || row['fanciful'] || '';
      const classType = row['class/type'] || row['class type'] || row['class/type code'] || '';
      const origin = row['origin'] || row['origin code'] || '';
      const approvalDate = row['approval date'] || row['completed date'] || '';
      const status = row['status'] || '';

      if (!brandName) continue;

      // Skip if we already have this brand
      const brandKey = brandName.split(' ').slice(0, 2).join(' ');
      if (seenBrands.has(brandKey)) continue;

      // Category filter
      const cat = classifyCategory(classType);
      if (categoryFilter && cat !== categoryFilter) continue;

      seenBrands.add(brandKey);
      existingIds.add(ttbId);

      const record = { ttbId, brandName, fancifulName, classType, origin, approvalDate };
      found.set(ttbId, { ...record, category: cat });
      console.log(`  ✅ [${cat}] ${brandName} — ${fancifulName || '(no fanciful)'} [${ttbId}]`);
    }

    // If we have a detail page link and need more info, we could click through
    // But first let's see if the table has enough data

    // Pagination: look for "Next" link
    if (found.size < TARGET) {
      const nextLink = await page.$('a:text("Next")') ||
                        await page.$('a:text("next")') ||
                        await page.$('a:text(">>")') ||
                        await page.$('a:text(">")') ||
                        await page.$('a[href*="page"]:has-text("Next")');
      if (nextLink) {
        console.log('  ➡️  Clicking next page...');
        await nextLink.click();
        await page.waitForTimeout(3000);
        if (await isCaptchaPage(page)) {
          const solved = await waitForCaptchaSolve(page);
          if (!solved) break;
        }
      } else {
        console.log('  🏁 No more result pages');
        break;
      }
    }
  }

  // If we didn't get enough from table data, try clicking through to detail pages
  // for rows that have links but incomplete data
  if (found.size < TARGET) {
    console.log(`\n📊 Got ${found.size}/${TARGET} from search results.`);
    console.log('   If this is insufficient, try broadening the date range or removing category filter.');
  }

  await browser.close();

  // Merge new records into existing
  for (const [, record] of found) {
    const cat = record.category;
    delete record.category;
    existing[cat].push(record);
  }

  const totalExisting = existing.beer.length + existing.wine.length + existing.spirits.length;
  console.log('\n' + '═'.repeat(60));
  console.log(`📊 RESULTS:`);
  console.log(`   Found: ${found.size} new records`);
  console.log(`   Total: ${totalExisting} (beer: ${existing.beer.length}, wine: ${existing.wine.length}, spirits: ${existing.spirits.length})`);

  if (found.size > 0) {
    writeFileSync(OUTPUT_PATH, JSON.stringify(existing, null, 2));
    console.log(`\n💾 Saved to ${OUTPUT_PATH}`);
  } else {
    console.log('\n⚠️  No new records found — file not updated');
  }
}

main().catch(console.error);
