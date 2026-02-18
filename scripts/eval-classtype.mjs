#!/usr/bin/env node
/**
 * Evaluate class/type extraction accuracy:
 *   Tesseract OCR → parseOcrText (classType extraction) → inferCategory → compare vs TTB ground truth
 *
 * Usage: node scripts/eval-classtype.mjs [--verbose] [--limit N]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import Tesseract from "tesseract.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.join(__dirname, "..");
const LABELS_DIR = path.join(PROJECT, "frontend", "public", "ttb-labels");
const RECORDS_FILE = path.join(PROJECT, "sample_labels", "ttb_cola_records.json");

const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : Infinity;

// ---------------------------------------------------------------------------
// SUBCATEGORY_MAP (from categoryMatch.ts) — inline for Node.js
// Maps OCR signal words → official TTB class/type codes
// ---------------------------------------------------------------------------
const SUBCATEGORY_MAP = [
  // Beer - Flavored malt beverages
  { term: "hard seltzer", pattern: /\bhard\s+seltzer\b/i, parent: "beer", subcategory: "MALT BEVERAGES SPECIALITIES - FLAVORED" },
  { term: "hard cider", pattern: /\bhard\s+cider\b/i, parent: "beer", subcategory: "MALT BEVERAGES SPECIALITIES - FLAVORED" },
  { term: "hard lemonade", pattern: /\bhard\s+lemonade\b/i, parent: "beer", subcategory: "MALT BEVERAGES SPECIALITIES - FLAVORED" },
  { term: "wine cooler", pattern: /\bwine\s+cooler\b/i, parent: "beer", subcategory: "MALT BEVERAGES SPECIALITIES - FLAVORED" },
  { term: "shandy", pattern: /\bshandy\b/i, parent: "beer", subcategory: "MALT BEVERAGES SPECIALITIES - FLAVORED" },
  { term: "malt beverage", pattern: /\b(?:flavored\s+)?malt\s+beverage\b/i, parent: "beer", subcategory: "MALT BEVERAGES SPECIALITIES" },
  { term: "malt liquor", pattern: /\bmalt\s+liquor\b/i, parent: "beer", subcategory: "BEER" },
  // Stout
  { term: "imperial stout", pattern: /\bimperial\s+stout\b/i, parent: "beer", subcategory: "STOUT" },
  { term: "milk stout", pattern: /\bmilk\s+stout\b/i, parent: "beer", subcategory: "STOUT" },
  { term: "oatmeal stout", pattern: /\boatmeal\s+stout\b/i, parent: "beer", subcategory: "STOUT" },
  { term: "stout", pattern: /\bstout\b/i, parent: "beer", subcategory: "STOUT" },
  // Ale
  { term: "double IPA", pattern: /\b(?:double|imperial)\s+(?:india\s+)?pale\s+ale\b/i, parent: "beer", subcategory: "ALE" },
  { term: "DIPA", pattern: /\bDIPA\b/, parent: "beer", subcategory: "ALE" },
  { term: "hazy IPA", pattern: /\bhazy\s+(?:double\s+)?(?:india\s+)?pale\s+ale\b/i, parent: "beer", subcategory: "ALE" },
  { term: "session IPA", pattern: /\bsession\s+(?:india\s+)?pale\s+ale\b/i, parent: "beer", subcategory: "ALE" },
  { term: "black IPA", pattern: /\bblack\s+(?:india\s+)?pale\s+ale\b/i, parent: "beer", subcategory: "ALE" },
  { term: "NE IPA", pattern: /\b(?:new\s+england|NE)\s+(?:style\s+)?(?:india\s+)?pale\s+ale\b/i, parent: "beer", subcategory: "ALE" },
  { term: "India Pale Ale", pattern: /\bindia\s+pale\s+ale\b/i, parent: "beer", subcategory: "ALE" },
  { term: "IPA", pattern: /\bIPA\b/, parent: "beer", subcategory: "ALE" },
  { term: "belgian tripel", pattern: /\bbelgian\s+tripel\b/i, parent: "beer", subcategory: "ALE" },
  { term: "belgian dubbel", pattern: /\bbelgian\s+dubbel\b/i, parent: "beer", subcategory: "ALE" },
  { term: "belgian quad", pattern: /\bbelgian\s+quad\b/i, parent: "beer", subcategory: "ALE" },
  { term: "belgian strong", pattern: /\bbelgian\s+(?:strong|dark|pale)\b/i, parent: "beer", subcategory: "ALE" },
  { term: "lambic", pattern: /\blambic\b/i, parent: "beer", subcategory: "ALE" },
  { term: "gueuze", pattern: /\bgu?euze\b/i, parent: "beer", subcategory: "ALE" },
  { term: "hefeweizen", pattern: /\bhefeweizen\b/i, parent: "beer", subcategory: "ALE" },
  { term: "kolsch", pattern: /\bk[oö]lsch\b/i, parent: "beer", subcategory: "ALE" },
  { term: "witbier", pattern: /\bwitbier\b/i, parent: "beer", subcategory: "ALE" },
  { term: "berliner weisse", pattern: /\bberliner\s+weisse?\b/i, parent: "beer", subcategory: "ALE" },
  { term: "fruited sour", pattern: /\bfruited\s+sour\b/i, parent: "beer", subcategory: "ALE" },
  { term: "gose", pattern: /\bgose\b/i, parent: "beer", subcategory: "ALE" },
  { term: "sour ale", pattern: /\bsour\s+ale\b/i, parent: "beer", subcategory: "ALE" },
  { term: "sour", pattern: /\bsour\b/i, parent: "beer", subcategory: "ALE" },
  { term: "pale ale", pattern: /\bpale\s+ale\b/i, parent: "beer", subcategory: "ALE" },
  { term: "amber ale", pattern: /\bamber\s+ale\b/i, parent: "beer", subcategory: "ALE" },
  { term: "brown ale", pattern: /\bbrown\s+ale\b/i, parent: "beer", subcategory: "ALE" },
  { term: "blonde ale", pattern: /\bblonde?\s+ale\b/i, parent: "beer", subcategory: "ALE" },
  { term: "cream ale", pattern: /\bcream\s+ale\b/i, parent: "beer", subcategory: "ALE" },
  { term: "red ale", pattern: /\b(?:irish\s+)?red\s+ale\b/i, parent: "beer", subcategory: "ALE" },
  { term: "golden ale", pattern: /\bgolden\s+ale\b/i, parent: "beer", subcategory: "ALE" },
  { term: "scotch ale", pattern: /\bscotch\s+ale\b/i, parent: "beer", subcategory: "ALE" },
  { term: "strong ale", pattern: /\bstrong\s+ale\b/i, parent: "beer", subcategory: "ALE" },
  { term: "old ale", pattern: /\bold\s+ale\b/i, parent: "beer", subcategory: "ALE" },
  { term: "mild ale", pattern: /\bmild\s+ale\b/i, parent: "beer", subcategory: "ALE" },
  { term: "farmhouse ale", pattern: /\bfarmhouse\s+ale\b/i, parent: "beer", subcategory: "ALE" },
  { term: "wild ale", pattern: /\bwild\s+ale\b/i, parent: "beer", subcategory: "ALE" },
  { term: "barleywine", pattern: /\bbarleywine\b/i, parent: "beer", subcategory: "ALE" },
  { term: "ESB", pattern: /\bESB\b/, parent: "beer", subcategory: "ALE" },
  { term: "bitter", pattern: /\b(?:extra\s+special\s+)?bitter\b/i, parent: "beer", subcategory: "ALE" },
  { term: "saison", pattern: /\bsaison\b/i, parent: "beer", subcategory: "ALE" },
  { term: "porter", pattern: /\bporter\b/i, parent: "beer", subcategory: "ALE" },
  // Beer / Lager
  { term: "dunkel", pattern: /\bdunkel\b/i, parent: "beer", subcategory: "BEER" },
  { term: "marzen", pattern: /\bm[aä]rzen\b/i, parent: "beer", subcategory: "BEER" },
  { term: "bock", pattern: /\b(?:doppel)?bock\b/i, parent: "beer", subcategory: "BEER" },
  { term: "schwarzbier", pattern: /\bschwarzbier\b/i, parent: "beer", subcategory: "BEER" },
  { term: "vienna lager", pattern: /\bvienna\s+lager\b/i, parent: "beer", subcategory: "BEER" },
  { term: "altbier", pattern: /\baltbier\b/i, parent: "beer", subcategory: "BEER" },
  { term: "rauchbier", pattern: /\brauchbier\b/i, parent: "beer", subcategory: "BEER" },
  { term: "pilsner", pattern: /\bpils(?:ner)?\b/i, parent: "beer", subcategory: "BEER" },
  { term: "lager", pattern: /\blager\b/i, parent: "beer", subcategory: "BEER" },
  { term: "fruit beer", pattern: /\bfruit\s+(?:beer|ale)\b/i, parent: "beer", subcategory: "BEER" },
  { term: "wheat beer", pattern: /\bwheat\s+(?:beer|ale)\b/i, parent: "beer", subcategory: "BEER" },
  // Sake (before generic beer — prevents sake breweries from matching "brew")
  { term: "daiginjo", pattern: /\bdaiginj[o\u014d]\b/i, parent: "spirits", subcategory: "SAKE" },
  { term: "ginjo", pattern: /\bginj[o\u014d]\b/i, parent: "spirits", subcategory: "SAKE" },
  { term: "junmai", pattern: /\bjunmai\b/i, parent: "spirits", subcategory: "SAKE" },
  { term: "nihonshu", pattern: /\bnihonshu\b/i, parent: "spirits", subcategory: "SAKE" },
  { term: "sake", pattern: /\bsak[e\u00e9i]\b/i, parent: "spirits", subcategory: "SAKE" },
  // Generic beer
  { term: "ale", pattern: /\bale\b/i, parent: "beer", subcategory: "ALE" },
  { term: "beer", pattern: /\bbeer\b/i, parent: "beer", subcategory: "BEER" },
  { term: "cider", pattern: /\bcider\b/i, parent: "beer", subcategory: "MALT BEVERAGES SPECIALITIES" },
  { term: "brew", pattern: /\bbrew(?:ed|ery|ing)?\b/i, parent: "beer", subcategory: "BEER" },
  // Wine - Sparkling
  { term: "sparkling wine", pattern: /\bsparkling\s+wine\b/i, parent: "wine", subcategory: "SPARKLING WINE/CHAMPAGNE" },
  { term: "champagne", pattern: /\bchampagne\b/i, parent: "wine", subcategory: "SPARKLING WINE/CHAMPAGNE" },
  { term: "prosecco", pattern: /\bprosecco\b/i, parent: "wine", subcategory: "SPARKLING WINE/CHAMPAGNE" },
  { term: "cava", pattern: /\bcava\b/i, parent: "wine", subcategory: "SPARKLING WINE/CHAMPAGNE" },
  { term: "blanc de blancs", pattern: /\bblanc\s+de\s+blancs\b/i, parent: "wine", subcategory: "SPARKLING WINE/CHAMPAGNE" },
  { term: "blanc de noirs", pattern: /\bblanc\s+de\s+noirs\b/i, parent: "wine", subcategory: "SPARKLING WINE/CHAMPAGNE" },
  { term: "carbonated wine", pattern: /\bcarbonated\s+wine\b/i, parent: "wine", subcategory: "CARBONATED WINE" },
  // Wine - Dessert/Fortified
  { term: "dessert wine", pattern: /\bdessert\s+wine\b/i, parent: "wine", subcategory: "DESSERT WINE" },
  { term: "fortified wine", pattern: /\bfortified\s+wine\b/i, parent: "wine", subcategory: "DESSERT WINE" },
  { term: "ice wine", pattern: /\bice\s*wine\b/i, parent: "wine", subcategory: "DESSERT WINE" },
  { term: "late harvest", pattern: /\blate\s+harvest\b/i, parent: "wine", subcategory: "DESSERT WINE" },
  { term: "port", pattern: /\bport(?:\s+wine)?\b/i, parent: "wine", subcategory: "DESSERT /PORT/SHERRY/(COOKING) WINE" },
  { term: "sherry", pattern: /\bsherry\b/i, parent: "wine", subcategory: "DESSERT /PORT/SHERRY/(COOKING) WINE" },
  { term: "vermouth", pattern: /\bvermouth\b/i, parent: "wine", subcategory: "DESSERT FLAVORED WINE" },
  { term: "mead", pattern: /\bmead(?:ery)?\b/i, parent: "wine", subcategory: "HONEY BASED TABLE WINE" },
  { term: "rosé", pattern: /(?<![a-zA-Z])ros[eé](?![a-zA-Z])/i, parent: "wine", subcategory: "ROSE WINE" },
  // Wine - Table
  { term: "red wine", pattern: /\bred\s+wine\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "white wine", pattern: /\bwhite\s+wine\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "table wine", pattern: /\btable\s+wine\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "natural wine", pattern: /\bnatural\s+wine\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  // Wine - Red varietals
  { term: "cabernet sauvignon", pattern: /\bcabernet\s+sauvignon\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "cabernet franc", pattern: /\bcabernet\s+franc\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "merlot", pattern: /\bmerlot\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "pinot noir", pattern: /\bpinot\s+noir\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "zinfandel", pattern: /\bzinfandel\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "malbec", pattern: /\bmalbec\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "syrah", pattern: /\bsyrah\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "shiraz", pattern: /\bshiraz\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "tempranillo", pattern: /\btempranillo\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "sangiovese", pattern: /\bsangiovese\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "grenache", pattern: /\bgrenache\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "nebbiolo", pattern: /\bnebbiolo\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "gamay", pattern: /\bgamay\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  // Wine - White varietals
  { term: "chardonnay", pattern: /\bchardonnay\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "pinot grigio", pattern: /\bpinot\s+grigio\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "pinot gris", pattern: /\bpinot\s+gris\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "pinot blanc", pattern: /\bpinot\s+blanc\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "riesling", pattern: /\briesling\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "sauvignon blanc", pattern: /\bsauvignon\s+blanc\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "viognier", pattern: /\bviognier\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "moscato", pattern: /\bmoscato\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  // Wine - Appellations
  { term: "bourgogne", pattern: /\bbourgogne\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "burgundy", pattern: /\bburgundy\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "bordeaux", pattern: /\bbordeaux\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "chablis", pattern: /\bchablis\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "chianti", pattern: /\bchianti\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "rioja", pattern: /\brioja\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "barolo", pattern: /\bbarolo\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  // Wine - Generic
  { term: "vineyard", pattern: /\bvineyard\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "vintage", pattern: /\bvintage\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "estate bottled", pattern: /\bestate\s+bottled\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "vinted", pattern: /\bvinted\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "appellation", pattern: /\bappellation\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "wine", pattern: /\bwine\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  // Spirits - Whisky (specific → generic)
  { term: "kentucky straight bourbon", pattern: /\bkentucky\s+straight\s+bourbon\b/i, parent: "spirits", subcategory: "STRAIGHT BOURBON WHISKY" },
  { term: "straight bourbon", pattern: /\bstraight\s+bourbon\b/i, parent: "spirits", subcategory: "STRAIGHT BOURBON WHISKY" },
  { term: "straight rye", pattern: /\bstraight\s+rye\s+whisk(?:e?y)\b/i, parent: "spirits", subcategory: "STRAIGHT RYE WHISKY" },
  { term: "straight rye", pattern: /\bstraight\s+rye\b/i, parent: "spirits", subcategory: "STRAIGHT RYE WHISKY" },
  { term: "tennessee whiskey", pattern: /\btennessee\s+whisk(?:e?y)\b/i, parent: "spirits", subcategory: "WHISKY SPECIALTIES" },
  { term: "irish whiskey", pattern: /\birish\s+whisk(?:e?y)\b/i, parent: "spirits", subcategory: "IRISH WHISKY" },
  { term: "canadian whisky", pattern: /\bcanadian\s+whisk(?:e?y)\b/i, parent: "spirits", subcategory: "CANADIAN WHISKY" },
  { term: "single malt", pattern: /\bsingle\s+(?:malt|barrel)\s+(?:whisk(?:e?y)|scotch)\b/i, parent: "spirits", subcategory: "WHISKY SPECIALTIES" },
  { term: "small batch", pattern: /\bsmall\s+batch\s+(?:bourbon|whisk(?:e?y))\b/i, parent: "spirits", subcategory: "WHISKY SPECIALTIES" },
  { term: "blended whiskey", pattern: /\bblended\s+whisk(?:e?y)\b/i, parent: "spirits", subcategory: "BLENDED WHISKY" },
  // Barrel / cask terms
  { term: "barrel proof", pattern: /\bbarrel\s+proof\b/i, parent: "spirits", subcategory: "STRAIGHT BOURBON WHISKY" },
  { term: "cask strength", pattern: /\bcask\s+strength\b/i, parent: "spirits", subcategory: "WHISKY SPECIALTIES" },
  { term: "barrel aged", pattern: /\bbarrel\s+aged\b/i, parent: "spirits", subcategory: "WHISKY SPECIALTIES" },
  { term: "barrel finished", pattern: /\bbarrel\s+finished\b/i, parent: "spirits", subcategory: "WHISKY SPECIALTIES" },
  { term: "charred oak", pattern: /\bcharred\s+oak\b/i, parent: "spirits", subcategory: "WHISKY SPECIALTIES" },
  { term: "kentucky bourbon", pattern: /\bkentucky\s+bourbon\b/i, parent: "spirits", subcategory: "STRAIGHT BOURBON WHISKY" },
  { term: "rye whiskey", pattern: /\brye\s+whisk(?:e?y)\b/i, parent: "spirits", subcategory: "STRAIGHT RYE WHISKY" },
  { term: "corn whiskey", pattern: /\bcorn\s+whisk(?:e?y)\b/i, parent: "spirits", subcategory: "WHISKY SPECIALTIES" },
  { term: "bourbon", pattern: /\bbourbon\b/i, parent: "spirits", subcategory: "STRAIGHT BOURBON WHISKY" },
  { term: "scotch", pattern: /\bscotch\b/i, parent: "spirits", subcategory: "WHISKY SPECIALTIES" },
  { term: "whiskey", pattern: /\bwhisk(?:e?y)\b/i, parent: "spirits", subcategory: "WHISKY SPECIALTIES" },
  // Spirits - Vodka
  { term: "flavored vodka", pattern: /\bflavored\s+vodka\b/i, parent: "spirits", subcategory: "VODKA" },
  { term: "vodka soda", pattern: /\bvodka\s+soda\b/i, parent: "spirits", subcategory: "VODKA" },
  { term: "vodka", pattern: /\bvodka\b/i, parent: "spirits", subcategory: "VODKA" },
  // Spirits - Gin
  { term: "london dry gin", pattern: /\blondon\s+dry\s+gin\b/i, parent: "spirits", subcategory: "GIN" },
  { term: "gin", pattern: /\bgin\b/i, parent: "spirits", subcategory: "GIN" },
  { term: "genever", pattern: /\bgenever\b/i, parent: "spirits", subcategory: "GIN" },
  // Spirits - Rum (specific → generic)
  { term: "gold rum", pattern: /\bgold\s+rum\b/i, parent: "spirits", subcategory: "RUM" },
  { term: "dark rum", pattern: /\bdark\s+rum\b/i, parent: "spirits", subcategory: "RUM" },
  { term: "spiced rum", pattern: /\bspiced\s+rum\b/i, parent: "spirits", subcategory: "RUM" },
  { term: "white rum", pattern: /\bwhite\s+rum\b/i, parent: "spirits", subcategory: "RUM" },
  { term: "aged rum", pattern: /\baged\s+rum\b/i, parent: "spirits", subcategory: "RUM" },
  { term: "rhum", pattern: /\brhum\b/i, parent: "spirits", subcategory: "RUM" },
  { term: "rum", pattern: /\brum\b/i, parent: "spirits", subcategory: "RUM" },
  { term: "cachaca", pattern: /\bcacha[c\u00e7]a\b/i, parent: "spirits", subcategory: "RUM" },
  // Spirits - Brandy
  { term: "cognac", pattern: /\bcognac\b/i, parent: "spirits", subcategory: "BRANDY" },
  { term: "armagnac", pattern: /\barmagnac\b/i, parent: "spirits", subcategory: "BRANDY" },
  { term: "grappa", pattern: /\bgrappa\b/i, parent: "spirits", subcategory: "BRANDY" },
  { term: "pisco", pattern: /\bpisco\b/i, parent: "spirits", subcategory: "BRANDY" },
  { term: "brandy", pattern: /\bbrandy\b/i, parent: "spirits", subcategory: "BRANDY" },
  // Spirits - Tequila & Agave
  { term: "tequila seltzer", pattern: /\btequila\s+seltzer\b/i, parent: "spirits", subcategory: "TEQUILA" },
  { term: "tequila", pattern: /\btequila\b/i, parent: "spirits", subcategory: "TEQUILA" },
  { term: "mezcal", pattern: /\bmezcal\b/i, parent: "spirits", subcategory: "MEZCAL" },
  { term: "agave spirits", pattern: /\bagave\s+spirits?\b/i, parent: "spirits", subcategory: "AGAVE SPIRITS" },
  { term: "sotol", pattern: /\bsotol\b/i, parent: "spirits", subcategory: "AGAVE SPIRITS" },
  { term: "raicilla", pattern: /\braicilla\b/i, parent: "spirits", subcategory: "AGAVE SPIRITS" },
  // Spirits - Liqueurs
  { term: "irish cream", pattern: /\birish\s+cream\b/i, parent: "spirits", subcategory: "LIQUEUR" },
  { term: "amaro", pattern: /\bamaro\b/i, parent: "spirits", subcategory: "LIQUEUR" },
  { term: "aperitif", pattern: /\baperitif\b/i, parent: "spirits", subcategory: "LIQUEUR" },
  { term: "digestif", pattern: /\bdigestif\b/i, parent: "spirits", subcategory: "LIQUEUR" },
  { term: "liqueur", pattern: /\bliqueur\b/i, parent: "spirits", subcategory: "LIQUEUR" },
  { term: "cordial", pattern: /\bcordial\b/i, parent: "spirits", subcategory: "LIQUEUR" },
  { term: "schnapps", pattern: /\bschnapps\b/i, parent: "spirits", subcategory: "LIQUEUR" },
  // Spirits - Other
  { term: "neutral spirits", pattern: /\b(?:corn\s+|grain\s+)?neutral\s+spirits?\b/i, parent: "spirits", subcategory: "OTHER SPECIALTIES & PROPRIETARIES" },
  { term: "moonshine", pattern: /\bmoonshine\b/i, parent: "spirits", subcategory: "WHISKY SPECIALTIES" },
  // RTD / Cocktails
  { term: "ready to drink", pattern: /\bready\s+to\s+drink\b/i, parent: "spirits", subcategory: "OTHER COCKTAILS" },
  { term: "cocktail", pattern: /\bcocktail\b/i, parent: "spirits", subcategory: "OTHER COCKTAILS" },
  { term: "RTD", pattern: /\bRTD\b/, parent: "spirits", subcategory: "OTHER COCKTAILS" },
  { term: "margarita", pattern: /\bmargarita\b/i, parent: "spirits", subcategory: "OTHER COCKTAILS" },
  // Producer terms (low specificity — rawText fallback only)
  { term: "distillery", pattern: /\bdistiller(?:y|ies|s)\b/i, parent: "spirits", subcategory: "OTHER SPECIALTIES & PROPRIETARIES" },
  { term: "distilled", pattern: /\bdistilled\b/i, parent: "spirits", subcategory: "OTHER SPECIALTIES & PROPRIETARIES" },
  { term: "proof", pattern: /\b\d+\s*proof\b/i, parent: "spirits", subcategory: "OTHER SPECIALTIES & PROPRIETARIES" },
];

// ---------------------------------------------------------------------------
// inferCategory — inline from categoryMatch.ts
// ---------------------------------------------------------------------------
function toFamily(category, subcategory) {
  switch (category) {
    case "beer":
      if (subcategory === "ALE" || subcategory === "STOUT") return "ALE";
      if (subcategory.includes("MALT BEVERAGES")) return "MALT BEVERAGES";
      return "BEER";
    case "wine":
      if (subcategory.startsWith("TABLE ")) return "TABLE WINE";
      if (subcategory.includes("DESSERT") || subcategory.includes("PORT") || subcategory.includes("SHERRY")) return "DESSERT WINE";
      if (subcategory.includes("SPARKLING") || subcategory.includes("CHAMPAGNE") || subcategory === "CARBONATED WINE") return "SPARKLING WINE";
      if (subcategory === "ROSE WINE") return "TABLE WINE";
      if (subcategory.includes("HONEY")) return "TABLE WINE";
      return "TABLE WINE";
    case "spirits":
      if (subcategory.includes("WHISKY") || subcategory.includes("BOURBON") || subcategory.includes("IRISH") || subcategory.includes("CANADIAN")) return "WHISKY";
      if (subcategory.includes("RUM")) return "RUM";
      if (subcategory.includes("BRANDY") || subcategory.includes("GRAPPA") || subcategory.includes("PISCO")) return "BRANDY";
      if (subcategory.includes("TEQUILA") || subcategory.includes("MEZCAL") || subcategory.includes("AGAVE")) return "AGAVE";
      if (subcategory.includes("VODKA")) return "VODKA";
      if (subcategory.includes("GIN")) return "GIN";
      if (subcategory.includes("LIQUEUR") || subcategory.includes("CORDIAL")) return "LIQUEUR";
      if (subcategory === "SAKE") return "SAKE";
      if (subcategory.includes("COCKTAIL")) return "COCKTAILS";
      return "OTHER SPIRITS";
    default:
      return subcategory;
  }
}

function parseAbv(alcoholContent) {
  if (!alcoholContent) return null;
  const pctMatch = alcoholContent.match(/(\d+\.?\d*)\s*%/);
  if (pctMatch) return parseFloat(pctMatch[1]);
  const proofMatch = alcoholContent.match(/(\d+\.?\d*)\s*proof/i);
  if (proofMatch) return parseFloat(proofMatch[1]) / 2;
  return null;
}

function matchText(text) {
  for (const entry of SUBCATEGORY_MAP) {
    if (entry.pattern.test(text)) {
      return { category: entry.parent, subcategory: entry.subcategory, subcategoryFamily: toFamily(entry.parent, entry.subcategory), matchedTerm: entry.term };
    }
  }
  return null;
}

function inferCategory({ classType, varietal, rawText, appellation, ageStatement, alcoholContent }) {
  const NULL_RESULT = { category: null, subcategory: null, subcategoryFamily: null, confidence: 0, confidenceTier: null, matchedTerm: null };
  
  let result = null;
  
  if (!result && classType) {
    const m = matchText(classType);
    if (m) result = { ...m, confidence: 0.95, confidenceTier: "high" };
  }
  
  if (!result && varietal) {
    const m = matchText(varietal);
    if (m) result = { ...m, confidence: 0.9, confidenceTier: "high" };
  }
  
  if (!result && appellation) {
    result = { category: "wine", subcategory: "TABLE WHITE WINE", subcategoryFamily: "TABLE WINE", confidence: 0.85, confidenceTier: "medium", matchedTerm: "appellation" };
  }
  
  if (!result && ageStatement) {
    result = { category: "spirits", subcategory: "WHISKY SPECIALTIES", subcategoryFamily: "WHISKY", confidence: 0.80, confidenceTier: "medium", matchedTerm: "age statement" };
  }
  
  // High ABV / proof — strong spirits indicator
  if (!result && alcoholContent) {
    const abvVal = parseAbv(alcoholContent);
    if (abvVal !== null && abvVal > 20) {
      result = { category: "spirits", subcategory: "OTHER SPECIALTIES & PROPRIETARIES", subcategoryFamily: "OTHER SPIRITS", confidence: 0.75, confidenceTier: "medium", matchedTerm: alcoholContent };
    }
  }
  
  if (!result && rawText) {
    const m = matchText(rawText);
    if (m) result = { ...m, confidence: 0.6, confidenceTier: "low" };
  }
  
  if (!result) return NULL_RESULT;
  
  // ABV-based post-processing: wine > 14% ABV = dessert wine
  const abv = parseAbv(alcoholContent);
  if (abv !== null && result.category === "wine") {
    const isTableWine = result.subcategory?.startsWith("TABLE ") ?? false;
    if (isTableWine && abv > 14) {
      result = { ...result, subcategory: "DESSERT /PORT/SHERRY/(COOKING) WINE" };
    }
  }
  
  return result;
}

// ---------------------------------------------------------------------------
// Minimal parseOcrText — just classType + varietal + ageStatement
// ---------------------------------------------------------------------------
function extractClassType(text) {
  const classPatterns = [
    /\b(\d+%\s+(?:cabernet\s+sauvignon|chardonnay|merlot|pinot\s+noir|riesling|sauvignon\s+blanc|zinfandel|malbec|syrah|shiraz))\b/i,
    /\b(tequila\s+seltzer|vodka\s+soda|ranch\s+water|irish\s+cream)\b/i,
    /\b(ale\s+with\s+[\w\s]+flavor|malt\s+beverage|flavored\s+malt\s+beverage|malt\s+liquor|hard\s+seltzer|hard\s+cider|hard\s+lemonade|wine\s+cooler)\b/i,
    /\b(neutral\s+spirits|corn\s+neutral\s+spirits|grain\s+neutral\s+spirits)\b/i,
    /\b(double\s+india\s+pale\s+ale|hazy\s+(?:double\s+)?(?:india\s+)?pale\s+ale|black\s+(?:india\s+)?pale\s+ale|session\s+(?:india\s+)?pale\s+ale|new\s+england\s+(?:style\s+)?(?:india\s+)?pale\s+ale|(?:double|imperial)\s+IPA|DIPA)\b/i,
    /\b(imperial\s+stout|milk\s+stout|oatmeal\s+stout)\b/i,
    /\b(pale\s+ale|india\s+pale\s+ale|IPA|vienna\s+lager|lager|stout|porter|pilsner|pils|wheat\s+(?:beer|ale)|amber\s+ale|brown\s+ale|red\s+ale|golden\s+ale|old\s+ale|mild\s+ale|blonde\s+ale|cream\s+ale|hefeweizen|saison|sour\s+ale|(?:fruited\s+)?sour|fruit\s+(?:beer|ale)|kolsch|kölsch|bock|doppelbock|dunkel|marzen|märzen|witbier|berliner\s+weisse?|gose|barleywine|scotch\s+ale|strong\s+ale|farmhouse\s+ale|wild\s+ale|belgian\s+(?:strong|pale|dark|dubbel|tripel|quad)|tripel|dubbel|quadrupel|lambic|gu?euze|schwarzbier|altbier|rauchbier|ESB|shandy)\b/i,
    /\b(red\s+wine|white\s+wine|rosé|rose\s+wine|sparkling\s+wine|champagne|table\s+wine|dessert\s+wine|fortified\s+wine|ice\s*wine|natural\s+wine|late\s+harvest|blanc\s+de\s+blancs|blanc\s+de\s+noirs|port|sherry|vermouth|mead|cava|prosecco)\b/i,
    /\b(cabernet\s+sauvignon|cabernet\s+franc|chardonnay|merlot|pinot\s+noir|pinot\s+grigio|pinot\s+gris|pinot\s+blanc|riesling|sauvignon\s+blanc|zinfandel|malbec|syrah|shiraz|petite?\s+si?rah|petit\s+verdot|tempranillo|sangiovese|nebbiolo|barbera|dolcetto|montepulciano|grenache|mourv[eè]dre|viognier|gew[uü]rztraminer|chenin\s+blanc|semillon|muscat|moscato|gr[uü]ner\s+veltliner|alba(?:ri[nñ]o|rinho)|torront[eé]s|gamay|carm[eé]n[eè]re|marsanne|roussanne)\b/i,
    // Spirits compound whiskey (most specific first)
    /\b(kentucky\s+straight\s+bourbon|straight\s+(?:bourbon|rye)\s+whiskey|single\s+(?:barrel|malt)\s+(?:whiskey|whisky|scotch)|small\s+batch\s+(?:bourbon|whiskey)|tennessee\s+whiskey|irish\s+whisk(?:e?y)|canadian\s+whisk(?:e?y)|kentucky\s+bourbon)\b/i,
    // Barrel / cask terms
    /\b(barrel\s+proof|barrel\s+aged|barrel\s+finished|cask\s+strength|charred\s+oak)\b/i,
    // Rum variants
    /\b(gold\s+rum|dark\s+rum|spiced\s+rum|white\s+rum|aged\s+rum|rhum)\b/i,
    // Sake terms
    /\b(daiginj[oō]|ginj[oō]|junmai|nihonshu|sak[eéi])\b/i,
    // Core spirits
    /\b(blended\s+whiskey|bourbon|scotch|flavored\s+vodka|vodka|london\s+dry\s+gin|rum|gin|genever|tequila|brandy|cognac|armagnac|calvados|mezcal|absinthe|whisky|whiskey|rye\s+whiskey|agave\s+spirits?|sotol|raicilla|pisco|grappa|aquavit|cachaca|cachaça|soju|baijiu|amaro|aperitif|digestif|liqueur|cordial|schnapps|moonshine|ready\s+to\s+drink|cocktail|sake|saki|margarita)\b/i,
  ];
  for (const pat of classPatterns) {
    const m = text.match(pat);
    if (m) return m[0].trim();
  }
  return null;
}

function extractVarietal(text) {
  const m = text.match(/\b(cabernet\s+sauvignon|chardonnay|merlot|pinot\s+noir|pinot\s+grigio|riesling|sauvignon\s+blanc|zinfandel|malbec|syrah|shiraz|tempranillo|sangiovese|grenache|viognier|gewürztraminer|chenin\s+blanc|semillon|muscat|moscato)\b/i);
  return m ? m[0].trim() : null;
}

function extractAgeStatement(text) {
  const pats = [
    /\b(aged\s+(?:a\s+minimum\s+of\s+)?\d+\s+years?)\b/i,
    /\b(\d+\s+years?\s+old)\b/i,
    /\b(\d+\s*-?\s*yr\.?\s*old)\b/i,
  ];
  for (const pat of pats) {
    const m = text.match(pat);
    if (m) return m[0].trim();
  }
  return null;
}

function extractAlcoholContent(text) {
  const abvPatterns = [
    /\b(\d{1,2}\.?\d?)\s*%\s*(?:alc(?:ohol)?(?:\/|\s+by\s+)?(?:vol(?:ume)?)?|abv)\b/i,
    /\b(?:alc(?:ohol)?(?:\/|\s+by\s+)?(?:vol(?:ume)?)?|abv)\s*[:.]?\s*(\d{1,2}\.?\d?)\s*%/i,
    /\b(\d{1,2}\.?\d?)\s*%\b/,
    /\b(\d{2,3})\s*proof\b/i,
  ];
  for (const pat of abvPatterns) {
    const m = text.match(pat);
    if (m) return m[0].trim();
  }
  return null;
}

// ---------------------------------------------------------------------------
// Image preprocessing (same as benchmark)
// ---------------------------------------------------------------------------
async function preprocessImage(input) {
  const src = typeof input === "string" ? sharp(input) : sharp(input.buffer);
  const meta = await src.metadata();
  const MIN_WIDTH = 1500;
  const PAD = 10;
  const scale = meta.width < MIN_WIDTH ? Math.ceil(MIN_WIDTH / meta.width) : 1;
  const w = meta.width * scale;
  const h = meta.height * scale;

  const srcAgain = typeof input === "string" ? sharp(input) : sharp(input.buffer);
  return srcAgain
    .resize(w, h, { kernel: "lanczos3" })
    .grayscale()
    .sharpen({ sigma: 1, m1: 0.3, m2: 0.3 })
    .normalise()
    .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: "#FFFFFF" })
    .png()
    .toBuffer();
}

// ---------------------------------------------------------------------------
// Load records & group images
// ---------------------------------------------------------------------------
function loadRecords() {
  const raw = JSON.parse(fs.readFileSync(RECORDS_FILE, "utf-8"));
  const byId = {};
  for (const cat of ["beer", "wine", "spirits"]) {
    for (const r of raw[cat] || []) {
      byId[r.ttbId] = { ...r, groundTruthCategory: cat };
    }
  }
  return byId;
}

function groupImages() {
  const files = fs.readdirSync(LABELS_DIR).filter(f => f.endsWith(".png"));
  const groups = {};
  for (const f of files) {
    const m = f.match(/^(\d+)-(\d+)\.png$/);
    if (!m) continue;
    const ttbId = m[1];
    const num = parseInt(m[2]);
    if (!groups[ttbId]) groups[ttbId] = [];
    groups[ttbId].push({ file: f, num, path: path.join(LABELS_DIR, f) });
  }
  for (const id of Object.keys(groups)) groups[id].sort((a, b) => a.num - b.num);
  return groups;
}

// ---------------------------------------------------------------------------
// Normalize TTB classType for comparison
// TTB ground truth has suffixes like "FB", "USB", proof ranges, etc.
// ---------------------------------------------------------------------------
function normalizeGT(classType) {
  if (!classType) return classType;
  // Remove trailing suffixes: FB, USB, proof ranges
  let ct = classType
    .replace(/\s+FB$/i, "")
    .replace(/\s+USB$/i, "")
    .replace(/\s+\d+-\d+\s+PROOF(?:\s+USB)?$/i, "")
    .replace(/\s*\(UNDER \d+ PROOF\)$/i, "")
    .trim();
  return ct;
}

// Does the inferred subcategory match the ground truth at a "family" level?
// e.g., "STRAIGHT BOURBON WHISKY" matches "STRAIGHT BOURBON WHISKY BLENDS"
// e.g., "GIN" matches "OTHER GIN"
// e.g., "RUM" matches "OTHER RUM GOLD"
function familyMatch(inferred, groundTruth) {
  if (!inferred || !groundTruth) return false;
  const inf = inferred.toUpperCase();
  const gt = normalizeGT(groundTruth).toUpperCase();
  
  // Exact match
  if (inf === gt) return true;
  
  // GT contains inferred (e.g., "OTHER GIN" contains "GIN")
  if (gt.includes(inf)) return true;
  
  // Inferred contains GT
  if (inf.includes(gt)) return true;
  
  // Whisky family: any whisky code matches any whisky GT
  const whiskyTerms = ["WHISKY", "WHISKEY", "BOURBON"];
  const infIsWhisky = whiskyTerms.some(t => inf.includes(t));
  const gtIsWhisky = whiskyTerms.some(t => gt.includes(t));
  if (infIsWhisky && gtIsWhisky) return true;
  
  // Rum family
  if (inf.includes("RUM") && gt.includes("RUM")) return true;
  
  // Brandy family
  const brandyTerms = ["BRANDY", "GRAPPA", "PISCO", "COGNAC"];
  if (brandyTerms.some(t => inf.includes(t)) && brandyTerms.some(t => gt.includes(t))) return true;
  
  // Tequila / Mezcal / Agave family
  const agaveTerms = ["TEQUILA", "MEZCAL", "AGAVE"];
  if (agaveTerms.some(t => inf.includes(t)) && agaveTerms.some(t => gt.includes(t))) return true;
  
  // Malt beverages specialties
  if (inf.includes("MALT BEVERAGES") && gt.includes("MALT BEVERAGES")) return true;
  
  // Wine: table/dessert/rose are all "wine" — category match but subtype may differ
  const wineTerms = ["TABLE RED WINE", "TABLE WHITE WINE", "DESSERT", "ROSE WINE", "SPARKLING", "HONEY BASED", "CARBONATED WINE", "FLAVORED WINE"];
  if (wineTerms.some(t => inf.includes(t)) && wineTerms.some(t => gt.includes(t))) return true;
  
  return false;
}

function categoryFromGT(record) {
  return record?.groundTruthCategory || "unknown";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("🔍 Class/Type Extraction Evaluation\n");
  console.log("Loading records and images...");
  
  const records = loadRecords();
  const groups = groupImages();
  const ttbIds = Object.keys(groups).sort();
  const totalImages = Object.values(groups).flat().length;
  
  console.log(`Found ${ttbIds.length} TTB IDs with ${totalImages} images\n`);
  
  const worker = await Tesseract.createWorker("eng");
  const results = [];
  let processed = 0;
  
  for (const ttbId of ttbIds) {
    if (processed >= LIMIT) break;
    const images = groups[ttbId];
    const record = records[ttbId];
    
    if (!record) {
      console.log(`  ⚠ ${ttbId} — no TTB record found, skipping`);
      continue;
    }
    
    const gtCategory = categoryFromGT(record);
    const gtClassType = record.classType;
    
    // Accumulate OCR from ALL images for this TTB ID
    let allText = "";
    let bestClassType = null;
    let bestVarietal = null;
    let bestAgeStatement = null;
    let bestAlcoholContent = null;
    let perImageResults = [];
    
    for (const img of images) {
      if (processed >= LIMIT) break;
      processed++;
      
      const label = img.num === 1 ? "front" : img.num === 2 ? "back" : `label-${img.num}`;
      process.stdout.write(`  [${processed}/${totalImages}] ${ttbId}-${img.num} (${label})...`);
      
      try {
        const ppBuf = await preprocessImage(img.path);
        const { data } = await worker.recognize(ppBuf);
        const text = data.text.replace(/\n/g, " ").replace(/\s+/g, " ");
        
        allText += " " + text;
        
        const classType = extractClassType(text);
        const varietal = extractVarietal(text);
        const ageStatement = extractAgeStatement(text);
        const alcoholContent = extractAlcoholContent(text);
        
        if (classType && !bestClassType) bestClassType = classType;
        if (varietal && !bestVarietal) bestVarietal = varietal;
        if (ageStatement && !bestAgeStatement) bestAgeStatement = ageStatement;
        if (alcoholContent && !bestAlcoholContent) bestAlcoholContent = alcoholContent;
        
        perImageResults.push({ img: `${ttbId}-${img.num}`, label, classType, varietal, ageStatement, alcoholContent });
        console.log(` classType=${classType || "\u2014"}, varietal=${varietal || "\u2014"}, abv=${alcoholContent || "\u2014"}`);
      } catch (err) {
        console.log(` ERROR: ${err.message}`);
        perImageResults.push({ img: `${ttbId}-${img.num}`, label, error: err.message });
      }
    }
    
    // Run inferCategory on combined results
    const inference = inferCategory({
      classType: bestClassType,
      varietal: bestVarietal,
      rawText: allText,
      ageStatement: bestAgeStatement,
      alcoholContent: bestAlcoholContent,
    });
    
    // Also try raw text fallback if no classType extracted
    const rawInference = !inference.category ? inferCategory({ rawText: allText, alcoholContent: bestAlcoholContent }) : inference;
    const finalInference = inference.category ? inference : rawInference;
    
    const categoryCorrect = finalInference.category === gtCategory;
    const subcategoryExact = finalInference.subcategory === normalizeGT(gtClassType);
    const subcategoryFamilyMatch = familyMatch(finalInference.subcategory, gtClassType);
    
    results.push({
      ttbId,
      brand: record.brandName,
      gtCategory,
      gtClassType,
      gtClassTypeNorm: normalizeGT(gtClassType),
      ocrClassType: bestClassType,
      ocrVarietal: bestVarietal,
      ocrAlcoholContent: bestAlcoholContent,
      inferredCategory: finalInference.category,
      inferredSubcategory: finalInference.subcategory,
      inferredFamily: finalInference.subcategoryFamily,
      confidenceTier: finalInference.confidenceTier,
      matchedTerm: finalInference.matchedTerm,
      confidence: finalInference.confidence,
      categoryCorrect,
      subcategoryExact,
      subcategoryFamily: subcategoryFamilyMatch,
      perImageResults,
    });
    
    const catIcon = categoryCorrect ? "✅" : "❌";
    const subIcon = subcategoryExact ? "✅" : subcategoryFamilyMatch ? "⚠️" : "❌";
    if (VERBOSE) {
      console.log(`    GT: ${gtCategory} / ${gtClassType}`);
      console.log(`    Inferred: ${finalInference.category} / ${finalInference.subcategory} (via "${finalInference.matchedTerm}", conf=${finalInference.confidence})`);
      console.log(`    ${catIcon} category  ${subIcon} subcategory`);
    }
  }
  
  await worker.terminate();
  
  // ---------------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------------
  generateReport(results);
}

function generateReport(results) {
  const total = results.length;
  const catCorrect = results.filter(r => r.categoryCorrect).length;
  const subExact = results.filter(r => r.subcategoryExact).length;
  const subFamily = results.filter(r => r.subcategoryFamily).length;
  const noClassType = results.filter(r => !r.ocrClassType).length;
  const noInference = results.filter(r => !r.inferredCategory).length;
  
  // By category
  const categories = ["beer", "wine", "spirits"];
  const catStats = {};
  for (const cat of categories) {
    const catResults = results.filter(r => r.gtCategory === cat);
    catStats[cat] = {
      total: catResults.length,
      catCorrect: catResults.filter(r => r.categoryCorrect).length,
      subExact: catResults.filter(r => r.subcategoryExact).length,
      subFamily: catResults.filter(r => r.subcategoryFamily).length,
      noClassType: catResults.filter(r => !r.ocrClassType).length,
    };
  }
  
  // Subcategory match breakdown
  const exactMatches = results.filter(r => r.subcategoryExact);
  const familyOnly = results.filter(r => r.subcategoryFamily && !r.subcategoryExact);
  const misses = results.filter(r => !r.subcategoryFamily && r.inferredCategory);
  const noInf = results.filter(r => !r.inferredCategory);
  
  const now = new Date().toISOString().split("T")[0];
  let md = `# Class/Type Extraction Evaluation Report

**Generated:** ${now}
**Engine:** Tesseract.js + parseOcrText + inferCategory (official TTB codes)
**Dataset:** ${total} TTB products with ${results.reduce((s, r) => s + r.perImageResults.length, 0)} label images

---

## Executive Summary

| Metric | Count | Rate |
|--------|-------|------|
| **Category correct** | ${catCorrect}/${total} | **${(catCorrect/total*100).toFixed(0)}%** |
| **Subcategory exact match** | ${subExact}/${total} | **${(subExact/total*100).toFixed(0)}%** |
| **Subcategory family match** | ${subFamily}/${total} | **${(subFamily/total*100).toFixed(0)}%** |
| **No classType extracted** | ${noClassType}/${total} | ${(noClassType/total*100).toFixed(0)}% |
| **No category inferred** | ${noInference}/${total} | ${(noInference/total*100).toFixed(0)}% |

> **Exact match**: inferred subcategory == ground truth TTB code (after normalizing suffixes like "FB", "USB")
> **Family match**: same general type family (e.g., any whisky code matches any whisky GT, GIN matches OTHER GIN)

---

## Category Breakdown

| Category | Products | Cat Correct | Sub Exact | Sub Family | No ClassType |
|----------|----------|-------------|-----------|------------|--------------|
`;
  
  for (const cat of categories) {
    const s = catStats[cat];
    md += `| **${cat.charAt(0).toUpperCase() + cat.slice(1)}** | ${s.total} | ${s.catCorrect} (${(s.catCorrect/s.total*100).toFixed(0)}%) | ${s.subExact} (${(s.subExact/s.total*100).toFixed(0)}%) | ${s.subFamily} (${(s.subFamily/s.total*100).toFixed(0)}%) | ${s.noClassType} |\n`;
  }
  
  md += `
---

## Detailed Results

### ✅ Exact Subcategory Matches (${exactMatches.length})

| TTB ID | Brand | GT Class/Type | OCR ClassType | Inferred | Match Term |
|--------|-------|---------------|---------------|----------|------------|
`;
  for (const r of exactMatches) {
    md += `| ${r.ttbId} | ${r.brand} | ${r.gtClassType} | ${r.ocrClassType || "—"} | ${r.inferredSubcategory} | ${r.matchedTerm} |\n`;
  }
  
  md += `
### ⚠️ Family Match Only (${familyOnly.length})

| TTB ID | Brand | GT Class/Type | OCR ClassType | Inferred | Why Different |
|--------|-------|---------------|---------------|----------|---------------|
`;
  for (const r of familyOnly) {
    md += `| ${r.ttbId} | ${r.brand} | ${r.gtClassType} | ${r.ocrClassType || "—"} | ${r.inferredSubcategory} | ${r.matchedTerm} |\n`;
  }
  
  md += `
### ❌ Mismatches (${misses.length})

| TTB ID | Brand | GT Cat/Type | OCR ClassType | Inferred Cat/Sub | Match Term |
|--------|-------|-------------|---------------|------------------|------------|
`;
  for (const r of misses) {
    md += `| ${r.ttbId} | ${r.brand} | ${r.gtCategory}/${r.gtClassType} | ${r.ocrClassType || "—"} | ${r.inferredCategory}/${r.inferredSubcategory} | ${r.matchedTerm} |\n`;
  }
  
  if (noInf.length > 0) {
    md += `
### 🔇 No Category Inferred (${noInf.length})

| TTB ID | Brand | GT Cat/Type | OCR ClassType | OCR Varietal |
|--------|-------|-------------|---------------|--------------|
`;
    for (const r of noInf) {
      md += `| ${r.ttbId} | ${r.brand} | ${r.gtCategory}/${r.gtClassType} | ${r.ocrClassType || "—"} | ${r.ocrVarietal || "—"} |\n`;
    }
  }
  
  md += `
---

## Unique Ground Truth TTB Codes in Dataset

| TTB Code | Count | Category |
|----------|-------|----------|
`;
  const gtCodes = {};
  for (const r of results) {
    const key = r.gtClassType;
    if (!gtCodes[key]) gtCodes[key] = { count: 0, category: r.gtCategory };
    gtCodes[key].count++;
  }
  for (const [code, { count, category }] of Object.entries(gtCodes).sort((a, b) => b[1].count - a[1].count)) {
    md += `| ${code} | ${count} | ${category} |\n`;
  }

  md += `\n---\n\n## Methodology\n\n1. For each TTB ID with label images, run Tesseract.js OCR on all images\n2. Extract classType, varietal, and ageStatement from OCR text using regex patterns\n3. Run inferCategory() with extracted fields to map to official TTB class/type codes\n4. Compare inferred subcategory against ground truth classType from TTB COLA records\n5. Score as exact match (normalized), family match, or mismatch\n`;

  const outPath = path.join(PROJECT, "docs", "CLASSTYPE_EVAL.md");
  fs.writeFileSync(outPath, md);
  
  // Console summary
  console.log(`\n${"═".repeat(70)}`);
  console.log("  CLASS/TYPE EXTRACTION EVALUATION");
  console.log(`${"═".repeat(70)}`);
  console.log(`  Products evaluated:      ${total}`);
  console.log(`  Category correct:        ${catCorrect}/${total} (${(catCorrect/total*100).toFixed(0)}%)`);
  console.log(`  Subcategory exact match: ${subExact}/${total} (${(subExact/total*100).toFixed(0)}%)`);
  console.log(`  Subcategory family match:${subFamily}/${total} (${(subFamily/total*100).toFixed(0)}%)`);
  console.log(`  No classType extracted:  ${noClassType}/${total} (${(noClassType/total*100).toFixed(0)}%)`);
  console.log(`  No inference at all:     ${noInference}/${total} (${(noInference/total*100).toFixed(0)}%)`);
  console.log();
  for (const cat of categories) {
    const s = catStats[cat];
    console.log(`  ${cat.padEnd(8)} — cat: ${s.catCorrect}/${s.total} (${(s.catCorrect/s.total*100).toFixed(0)}%), sub-exact: ${s.subExact}/${s.total} (${(s.subExact/s.total*100).toFixed(0)}%), sub-family: ${s.subFamily}/${s.total} (${(s.subFamily/s.total*100).toFixed(0)}%)`);
  }
  console.log(`${"═".repeat(70)}`);
  console.log(`\n📄 Full report: ${outPath}`);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
