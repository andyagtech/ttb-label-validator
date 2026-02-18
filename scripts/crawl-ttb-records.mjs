#!/usr/bin/env node
/**
 * TTB COLA Record Crawler
 * 
 * Discovers real COLA records by probing TTB detail pages directly.
 * Uses known good TTB ID prefixes and scans nearby IDs to find valid records.
 * Extracts: brand name, fanciful name, class/type, origin, alcohol, net contents.
 * 
 * Usage: node crawl-ttb-records.mjs [--headless] [--target N]
 * 
 * Output: ../sample_labels/ttb_cola_records.json
 */

import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_PATH = join(__dirname, '..', 'sample_labels', 'ttb_cola_records.json');
const DETAIL_BASE = 'https://www.ttbonline.gov/colasonline/viewColaDetails.do';
const CAPTCHA_WAIT_TIMEOUT_MS = 120_000;

const args = process.argv.slice(2);
let headless = args.includes('--headless');
let TARGET = 50;
const targetIdx = args.indexOf('--target');
if (targetIdx >= 0 && args[targetIdx + 1]) TARGET = parseInt(args[targetIdx + 1]);

// ── TTB ID prefixes to probe ────────────────────────────────────────────────
// Format: YYDDD001000NNN — we vary NNN (last 3 digits)
// These prefixes come from known good IDs across recent years.
// Mix of 2023 and 2024 prefixes for variety.
const PREFIXES = [
  // Jan 2026 — 1-2 months old, many should be approved (PRIORITY)
  '26001001000',  // Jan 1
  '26003001000',  // Jan 3
  '26006001000',  // Jan 6
  '26008001000',  // Jan 8
  '26010001000',  // Jan 10
  '26013001000',  // Jan 13
  '26015001000',  // Jan 15
  '26018001000',  // Jan 18
  '26020001000',  // Jan 20
  '26022001000',  // Jan 22
  '26025001000',  // Jan 25
  '26027001000',  // Jan 27
  '26029001000',  // Jan 29
  '26031001000',  // Jan 31
  // Feb 2026
  '26032001000',  // Feb 1
  '26034001000',  // Feb 3
  '26036001000',  // Feb 5
  '26038001000',  // Feb 7
  '26040001000',  // Feb 9
  '26042001000',  // Feb 11
  '26044001000',  // Feb 13
  '26046001000',  // Feb 15
  // Dec 2025 — ~600 records/day, 2-3 months old, most approved
  '25335001000',  // Dec 1
  '25336001000',  // Dec 2
  '25338001000',  // Dec 4
  '25340001000',  // Dec 6
  '25342001000',  // Dec 8
  '25345001000',  // Dec 11
  '25347001000',  // Dec 13
  '25349001000',  // Dec 15
  '25351001000',  // Dec 17
  '25353001000',  // Dec 19
  '25355001000',  // Dec 21
  '25358001000',  // Dec 24
  '25360001000',  // Dec 26
  '25362001000',  // Dec 28
  '25365001000',  // Dec 31
  // Late Nov 2025
  '25320001000',  // Nov 16
  '25325001000',  // Nov 21
  '25330001000',  // Nov 26
  // 2024 prefixes (kept for backfill)
  '24003001000',  // early Jan 2024
  '24012001000',  // mid Jan
  '24023001000',  // late Jan
  '24034001000',  // early Feb
  '24045001000',  // mid Feb
  '24051001000',  // late Feb
  '24056001000',  // late Feb
  '24067001000',  // early Mar
  '24078001000',  // mid Mar
  '24089001000',  // late Mar
  '24095001000',  // early Apr
  '24101001000',  // mid Apr
  '24112001000',  // late Apr
  '24120001000',  // early May
  '24131001000',  // mid May
  '24145001000',  // late May
  '24156001000',  // early Jun
  '24167001000',  // mid Jun
  '24178001000',  // late Jun
  '24200001000',  // mid Jul
  '24220001000',  // early Aug
  '24240001000',  // late Aug
  '24260001000',  // mid Sep
  '24280001000',  // early Oct
  '24300001000',  // late Oct
  // 2023 prefixes
  '23298001000',
  '23312001000',
  '23330001000',
  '23345001000',
  '23356001000',
];

// ── CAPTCHA handling ────────────────────────────────────────────────────────
async function isCaptchaPage(page) {
  try {
    const content = await page.content();
    return content.includes('What code is in the image') ||
           content.includes('spam submission') ||
           content.includes('human visitor');
  } catch { return false; }
}

async function waitForCaptchaSolve(page) {
  console.log(`\n  🔒 CAPTCHA! Solve it in the browser.`);
  const start = Date.now();
  while (Date.now() - start < CAPTCHA_WAIT_TIMEOUT_MS) {
    await page.waitForTimeout(2000);
    if (!(await isCaptchaPage(page))) {
      console.log(`  ✅ CAPTCHA solved!`);
      await page.waitForTimeout(1000);
      return true;
    }
  }
  return false;
}

// ── Classify a COLA record into beer/wine/spirits based on class code ───────
function classifyCategory(classType) {
  if (!classType) return 'spirits'; // default
  const ct = classType.toUpperCase();
  // Beer keywords
  const beerTerms = ['ALE', 'LAGER', 'STOUT', 'PORTER', 'IPA', 'PILSNER', 'MALT',
    'BEER', 'SAISON', 'WHEAT', 'KOLSCH', 'GOSE', 'SOUR', 'AMBER', 'BLONDE',
    'PALE ALE', 'CREAM ALE', 'HEFEWEIZEN', 'BOCK', 'DUNKEL', 'MARZEN',
    'CIDER', 'HARD SELTZER', 'SELTZER'];
  // Wine keywords
  const wineTerms = ['WINE', 'CABERNET', 'CHARDONNAY', 'MERLOT', 'PINOT',
    'SAUVIGNON', 'RIESLING', 'ZINFANDEL', 'SYRAH', 'SHIRAZ', 'MALBEC',
    'TEMPRANILLO', 'SANGIOVESE', 'GRENACHE', 'VIOGNIER', 'ROSE', 'ROSÉ',
    'CHAMPAGNE', 'PROSECCO', 'SPARKLING', 'MOSCATO', 'PORT', 'SHERRY',
    'VERMOUTH', 'TABLE WINE', 'RED WINE', 'WHITE WINE', 'BLEND'];
  for (const t of beerTerms) { if (ct.includes(t)) return 'beer'; }
  for (const t of wineTerms) { if (ct.includes(t)) return 'wine'; }
  // Numeric codes
  const num = parseInt(ct.replace(/\D/g, '').slice(0, 3)) || 0;
  if (num >= 800 && num <= 899) return 'wine';
  if (num >= 900) return 'beer';
  return 'spirits';
}

// ── Extract record from a COLA detail page ──────────────────────────────────
async function probeId(page, ttbId) {
  const url = `${DETAIL_BASE}?action=publicDisplaySearchBasic&ttbid=${ttbId}`;
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(800);

    if (await isCaptchaPage(page)) {
      const solved = await waitForCaptchaSolve(page);
      if (!solved) return null;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(800);
    }

    // Check if page has COLA detail content
    const body = await page.textContent('body').catch(() => '');
    if (!body || body.includes('No records found') || 
        body.includes('no matching') || body.length < 200 ||
        !body.includes('Brand')) {
      return null;
    }

    // Extract key-value pairs from <td> elements.
    // TTB detail pages put "Label: Value" in single <td> cells.
    const data = await page.evaluate(() => {
      const result = {};
      const tds = document.querySelectorAll('td');
      const fieldMap = {
        'TTB ID': 'ttbId',
        'Status': 'status',
        'Brand Name': 'brandName',
        'Fanciful Name': 'fancifulName',
        'Class/Type Code': 'classType',
        'Origin Code': 'origin',
        'Approval Date': 'approvalDate',
        'Type of Application': 'applicationType',
      };
      for (const td of tds) {
        const text = td.textContent.trim().replace(/\s+/g, ' ');
        for (const [label, key] of Object.entries(fieldMap)) {
          if (text.startsWith(label + ':')) {
            const val = text.slice(label.length + 1).trim();
            if (val && val.length < 200) {
              result[key] = val;
            }
          }
        }
      }
      return result;
    });

    const brandName = data.brandName || '';
    if (!brandName || brandName.length < 2) return null;

    // Only want approved COLAs
    const status = (data.status || '').toLowerCase();
    if (status && !status.includes('approved')) return null;

    return {
      ttbId,
      brandName: brandName.toUpperCase(),
      fancifulName: (data.fancifulName || '').toUpperCase(),
      classType: data.classType || '',
      origin: data.origin || '',
      status: 'APPROVED',
      approvalDate: data.approvalDate || '',
    };
  } catch {
    return null;
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🏛️  TTB COLA Record Crawler (direct probe)');
  console.log('═'.repeat(60));
  console.log(`🎯 Target: ${TARGET} records\n`);

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

  // Load existing records so we skip them
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

  const found = new Map(); // ttbId → record
  let probeCount = 0;

  // Probe IDs: for each prefix, try a spread of suffixes
  const suffixes = [];
  for (let n = 100; n <= 900; n += 25) {
    suffixes.push(String(n).padStart(3, '0'));
  }
  // Also add some specific ranges where we know popular brands cluster
  for (let n = 1; n <= 999; n += 7) {
    const s = String(n).padStart(3, '0');
    if (!suffixes.includes(s)) suffixes.push(s);
  }

  // Use prefixes in order (2026 first, then 2025, then 2024)
  const shuffledPrefixes = [...PREFIXES];

  for (const prefix of shuffledPrefixes) {
    if (found.size >= TARGET) break;

    // Shuffle suffixes too
    const shuffledSuffixes = [...suffixes].sort(() => Math.random() - 0.5);
    
    for (const suffix of shuffledSuffixes) {
      if (found.size >= TARGET) break;

      const ttbId = prefix + suffix;
      if (found.has(ttbId) || existingIds.has(ttbId)) continue;

      probeCount++;
      process.stdout.write(`\r  Probing ${ttbId} [${found.size}/${TARGET} found, ${probeCount} probed]`);

      const record = await probeId(page, ttbId);
      
      if (record && record.brandName) {
        // Skip if we already have this brand (want variety)
        const brandKey = record.brandName.split(' ').slice(0, 2).join(' ');
        if (seenBrands.has(brandKey)) continue;

        seenBrands.add(brandKey);
        found.set(ttbId, record);
        const cat = classifyCategory(record.classType);
        record.category = cat;
        console.log(`\n  ✅ [${cat}] ${record.brandName} — ${record.fancifulName || '(no fanciful)'} [${ttbId}]`);
      }

      // Tiny delay to be polite
      await page.waitForTimeout(500);
    }
  }

  await browser.close();

  // Merge new records into existing
  for (const [, record] of found) {
    const cat = record.category || classifyCategory(record.classType);
    delete record.category;
    existing[cat].push(record);
  }

  const totalExisting = existing.beer.length + existing.wine.length + existing.spirits.length;
  console.log('\n\n' + '═'.repeat(60));
  console.log(`📊 NEW RECORDS (${probeCount} probed):`);
  console.log(`   Found: ${found.size} new`);
  console.log(`   Total: ${totalExisting} (beer: ${existing.beer.length}, wine: ${existing.wine.length}, spirits: ${existing.spirits.length})`);

  writeFileSync(OUTPUT_PATH, JSON.stringify(existing, null, 2));
  console.log(`\n💾 Saved to ${OUTPUT_PATH}`);
}

main().catch(console.error);
