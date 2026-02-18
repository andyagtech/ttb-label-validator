/**
 * Category inference and verification for TTB COLA labels.
 *
 * Two-level classification:
 *   Level 1 (top-level): Beer, Wine, Spirits
 *   Level 2 (subcategory): e.g. "India Pale Ale", "Chardonnay", "Bourbon"
 *
 * Uses OCR-extracted class/type, varietal, and raw text to infer the
 * beverage category, then compares against the submitted category.
 */

import type { BeverageCategory } from "./types";

// ---------------------------------------------------------------------------
// Subcategory → Parent Category mapping
// ---------------------------------------------------------------------------

interface SubcategoryEntry {
  term: string;
  pattern: RegExp;
  parent: BeverageCategory;
  subcategory: string;
}

/**
 * Official TTB COLA class/type codes used as subcategory values.
 * Source: 27 CFR Parts 4 (wine), 5 (spirits), 7 (malt beverages)
 * and actual COLA application class/type codes from TTB.gov.
 *
 * Signal words (term/pattern) are informal terms found on labels that
 * map to the official TTB class/type code in the subcategory field.
 */
const SUBCATEGORY_MAP: SubcategoryEntry[] = [
  // ── Beer & Malt Beverages (27 CFR Part 7) ─────────────────────────────
  // Flavored malt beverages (27 CFR 7.144 / 7.147)
  { term: "hard seltzer", pattern: /\bhard\s+seltzer\b/i, parent: "beer", subcategory: "MALT BEVERAGES SPECIALITIES - FLAVORED" },
  { term: "hard cider", pattern: /\bhard\s+cider\b/i, parent: "beer", subcategory: "MALT BEVERAGES SPECIALITIES - FLAVORED" },
  { term: "hard lemonade", pattern: /\bhard\s+lemonade\b/i, parent: "beer", subcategory: "MALT BEVERAGES SPECIALITIES - FLAVORED" },
  { term: "wine cooler", pattern: /\bwine\s+cooler\b/i, parent: "beer", subcategory: "MALT BEVERAGES SPECIALITIES - FLAVORED" },
  { term: "shandy", pattern: /\bshandy\b/i, parent: "beer", subcategory: "MALT BEVERAGES SPECIALITIES - FLAVORED" },
  { term: "malt beverage", pattern: /\b(?:flavored\s+)?malt\s+beverage\b/i, parent: "beer", subcategory: "MALT BEVERAGES SPECIALITIES" },
  { term: "malt liquor", pattern: /\bmalt\s+liquor\b/i, parent: "beer", subcategory: "BEER" },
  // Stout (27 CFR 7.141 — recognized class designation)
  { term: "imperial stout", pattern: /\bimperial\s+stout\b/i, parent: "beer", subcategory: "STOUT" },
  { term: "milk stout", pattern: /\bmilk\s+stout\b/i, parent: "beer", subcategory: "STOUT" },
  { term: "oatmeal stout", pattern: /\boatmeal\s+stout\b/i, parent: "beer", subcategory: "STOUT" },
  { term: "stout", pattern: /\bstout\b/i, parent: "beer", subcategory: "STOUT" },
  // Ale (27 CFR 7.141 — recognized class designation)
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
  // Beer / Lager (27 CFR 7.141 — recognized class designation)
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
  // Generic (last)
  { term: "ale", pattern: /\bale\b/i, parent: "beer", subcategory: "ALE" },
  { term: "beer", pattern: /\bbeer\b/i, parent: "beer", subcategory: "BEER" },
  { term: "cider", pattern: /\bcider\b/i, parent: "beer", subcategory: "MALT BEVERAGES SPECIALITIES" },
  { term: "brew", pattern: /\bbrew(?:ed|ery|ing)?\b/i, parent: "beer", subcategory: "BEER" },

  // ── Wine (27 CFR Part 4) ──────────────────────────────────────────────
  // Sparkling (27 CFR 4.21(e))
  { term: "sparkling wine", pattern: /\bsparkling\s+wine\b/i, parent: "wine", subcategory: "SPARKLING WINE/CHAMPAGNE" },
  { term: "champagne", pattern: /\bchampagne\b/i, parent: "wine", subcategory: "SPARKLING WINE/CHAMPAGNE" },
  { term: "prosecco", pattern: /\bprosecco\b/i, parent: "wine", subcategory: "SPARKLING WINE/CHAMPAGNE" },
  { term: "cava", pattern: /\bcava\b/i, parent: "wine", subcategory: "SPARKLING WINE/CHAMPAGNE" },
  { term: "blanc de blancs", pattern: /\bblanc\s+de\s+blancs\b/i, parent: "wine", subcategory: "SPARKLING WINE/CHAMPAGNE" },
  { term: "blanc de noirs", pattern: /\bblanc\s+de\s+noirs\b/i, parent: "wine", subcategory: "SPARKLING WINE/CHAMPAGNE" },
  { term: "carbonated wine", pattern: /\bcarbonated\s+wine\b/i, parent: "wine", subcategory: "CARBONATED WINE" },
  // Dessert / Fortified (27 CFR 4.21(b)(3))
  { term: "dessert wine", pattern: /\bdessert\s+wine\b/i, parent: "wine", subcategory: "DESSERT WINE" },
  { term: "fortified wine", pattern: /\bfortified\s+wine\b/i, parent: "wine", subcategory: "DESSERT WINE" },
  { term: "ice wine", pattern: /\bice\s*wine\b/i, parent: "wine", subcategory: "DESSERT WINE" },
  { term: "late harvest", pattern: /\blate\s+harvest\b/i, parent: "wine", subcategory: "DESSERT WINE" },
  { term: "port", pattern: /\bport(?:\s+wine)?\b/i, parent: "wine", subcategory: "DESSERT /PORT/SHERRY/(COOKING) WINE" },
  { term: "sherry", pattern: /\bsherry\b/i, parent: "wine", subcategory: "DESSERT /PORT/SHERRY/(COOKING) WINE" },
  // Flavored (27 CFR 4.21(h))
  { term: "vermouth", pattern: /\bvermouth\b/i, parent: "wine", subcategory: "DESSERT FLAVORED WINE" },
  // Special natural wine
  { term: "mead", pattern: /\bmead(?:ery)?\b/i, parent: "wine", subcategory: "HONEY BASED TABLE WINE" },
  // Rosé
  { term: "rosé", pattern: /(?<![a-zA-Z])ros[eé](?![a-zA-Z])/i, parent: "wine", subcategory: "ROSE WINE" },
  // Table wine by color (27 CFR 4.21(b))
  { term: "red wine", pattern: /\bred\s+wine\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "white wine", pattern: /\bwhite\s+wine\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "table wine", pattern: /\btable\s+wine\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "natural wine", pattern: /\bnatural\s+wine\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  // Red grape varietals → TABLE RED WINE
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
  { term: "mourvèdre", pattern: /\bmourv[eè]dre\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "nebbiolo", pattern: /\bnebbiolo\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "barbera", pattern: /\bbarbera\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "dolcetto", pattern: /\bdolcetto\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "montepulciano", pattern: /\bmontepulciano\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "petite sirah", pattern: /\bpetite?\s+si?rah\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "petit verdot", pattern: /\bpetit\s+verdot\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "carménère", pattern: /\bcarm[eé]n[eè]re\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "gamay", pattern: /\bgamay\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  // White grape varietals → TABLE WHITE WINE
  { term: "chardonnay", pattern: /\bchardonnay\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "pinot grigio", pattern: /\bpinot\s+grigio\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "pinot gris", pattern: /\bpinot\s+gris\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "pinot blanc", pattern: /\bpinot\s+blanc\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "riesling", pattern: /\briesling\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "sauvignon blanc", pattern: /\bsauvignon\s+blanc\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "viognier", pattern: /\bviognier\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "gewürztraminer", pattern: /\bgew[uü]rztraminer\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "chenin blanc", pattern: /\bchenin\s+blanc\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "semillon", pattern: /\bse?millon\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "muscat", pattern: /\bmuscat(?:el)?\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "moscato", pattern: /\bmoscato\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "grüner veltliner", pattern: /\bgr[uü]ner\s+veltliner\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "albariño", pattern: /\balba(?:ri[nñ]o|rinho)\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "torrontés", pattern: /\btorront[eé]s\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "marsanne", pattern: /\bmarsanne\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "roussanne", pattern: /\broussanne\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  // Wine appellations/regions (strong wine indicators)
  { term: "bourgogne", pattern: /\bbourgogne\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "burgundy", pattern: /\bburgundy\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "bordeaux", pattern: /\bbordeaux\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "chablis", pattern: /\bchablis\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "chianti", pattern: /\bchianti\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "rioja", pattern: /\brioja\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  { term: "barolo", pattern: /\bbarolo\b/i, parent: "wine", subcategory: "TABLE RED WINE" },
  // Winemaking terms (generic indicator)
  { term: "vineyard", pattern: /\bvineyard\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "vintage", pattern: /\bvintage\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "estate bottled", pattern: /\bestate\s+bottled\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "vinted", pattern: /\bvinted\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  { term: "appellation", pattern: /\bappellation\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },
  // Generic wine term (last)
  { term: "wine", pattern: /\bwine\b/i, parent: "wine", subcategory: "TABLE WHITE WINE" },

  // ── Spirits (27 CFR Part 5) ───────────────────────────────────────────
  // Whisky (27 CFR 5.143–5.153)
  { term: "straight bourbon", pattern: /\bstraight\s+bourbon\b/i, parent: "spirits", subcategory: "STRAIGHT BOURBON WHISKY" },
  { term: "straight rye", pattern: /\bstraight\s+rye\s+whisk(?:e?y)\b/i, parent: "spirits", subcategory: "STRAIGHT RYE WHISKY" },
  { term: "tennessee whiskey", pattern: /\btennessee\s+whisk(?:e?y)\b/i, parent: "spirits", subcategory: "WHISKY SPECIALTIES" },
  { term: "single malt", pattern: /\bsingle\s+(?:malt|barrel)\s+(?:whisk(?:e?y)|scotch)\b/i, parent: "spirits", subcategory: "WHISKY SPECIALTIES" },
  { term: "small batch", pattern: /\bsmall\s+batch\s+(?:bourbon|whisk(?:e?y))\b/i, parent: "spirits", subcategory: "WHISKY SPECIALTIES" },
  { term: "blended whiskey", pattern: /\bblended\s+whisk(?:e?y)\b/i, parent: "spirits", subcategory: "BLENDED WHISKY" },
  { term: "rye whiskey", pattern: /\brye\s+whisk(?:e?y)\b/i, parent: "spirits", subcategory: "STRAIGHT RYE WHISKY" },
  { term: "corn whiskey", pattern: /\bcorn\s+whisk(?:e?y)\b/i, parent: "spirits", subcategory: "WHISKY SPECIALTIES" },
  { term: "bourbon", pattern: /\bbourbon\b/i, parent: "spirits", subcategory: "STRAIGHT BOURBON WHISKY" },
  { term: "scotch", pattern: /\bscotch\b/i, parent: "spirits", subcategory: "WHISKY SPECIALTIES" },
  { term: "whiskey", pattern: /\bwhisk(?:e?y)\b/i, parent: "spirits", subcategory: "WHISKY SPECIALTIES" },
  // Vodka (27 CFR 5.155)
  { term: "vodka soda", pattern: /\bvodka\s+soda\b/i, parent: "spirits", subcategory: "VODKA" },
  { term: "vodka", pattern: /\bvodka\b/i, parent: "spirits", subcategory: "VODKA" },
  // Gin (27 CFR 5.157)
  { term: "gin", pattern: /\bgin\b/i, parent: "spirits", subcategory: "GIN" },
  { term: "genever", pattern: /\bgenever\b/i, parent: "spirits", subcategory: "GIN" },
  // Rum (27 CFR 5.158)
  { term: "rum", pattern: /\brum\b/i, parent: "spirits", subcategory: "RUM" },
  { term: "cachaca", pattern: /\bcacha[cç]a\b/i, parent: "spirits", subcategory: "RUM" },
  // Brandy (27 CFR 5.140–5.142)
  { term: "cognac", pattern: /\bcognac\b/i, parent: "spirits", subcategory: "BRANDY" },
  { term: "armagnac", pattern: /\barmagnac\b/i, parent: "spirits", subcategory: "BRANDY" },
  { term: "calvados", pattern: /\bcalvados\b/i, parent: "spirits", subcategory: "BRANDY" },
  { term: "grappa", pattern: /\bgrappa\b/i, parent: "spirits", subcategory: "BRANDY" },
  { term: "pisco", pattern: /\bpisco\b/i, parent: "spirits", subcategory: "BRANDY" },
  { term: "brandy", pattern: /\bbrandy\b/i, parent: "spirits", subcategory: "BRANDY" },
  // Tequila & Agave (27 CFR 5.159–5.162)
  { term: "tequila seltzer", pattern: /\btequila\s+seltzer\b/i, parent: "spirits", subcategory: "TEQUILA" },
  { term: "ranch water", pattern: /\branch\s+water\b/i, parent: "spirits", subcategory: "TEQUILA" },
  { term: "tequila", pattern: /\btequila\b/i, parent: "spirits", subcategory: "TEQUILA" },
  { term: "mezcal", pattern: /\bmezcal\b/i, parent: "spirits", subcategory: "MEZCAL" },
  { term: "agave spirits", pattern: /\bagave\s+spirits?\b/i, parent: "spirits", subcategory: "AGAVE SPIRITS" },
  { term: "sotol", pattern: /\bsotol\b/i, parent: "spirits", subcategory: "AGAVE SPIRITS" },
  { term: "raicilla", pattern: /\braicilla\b/i, parent: "spirits", subcategory: "AGAVE SPIRITS" },
  // Liqueurs & Cordials (27 CFR 5.154)
  { term: "irish cream", pattern: /\birish\s+cream\b/i, parent: "spirits", subcategory: "LIQUEUR" },
  { term: "amaro", pattern: /\bamaro\b/i, parent: "spirits", subcategory: "LIQUEUR" },
  { term: "aperitif", pattern: /\baperitif\b/i, parent: "spirits", subcategory: "LIQUEUR" },
  { term: "digestif", pattern: /\bdigestif\b/i, parent: "spirits", subcategory: "LIQUEUR" },
  { term: "liqueur", pattern: /\bliqueur\b/i, parent: "spirits", subcategory: "LIQUEUR" },
  { term: "cordial", pattern: /\bcordial\b/i, parent: "spirits", subcategory: "LIQUEUR" },
  { term: "schnapps", pattern: /\bschnapps\b/i, parent: "spirits", subcategory: "LIQUEUR" },
  // Other spirits
  { term: "neutral spirits", pattern: /\b(?:corn\s+|grain\s+)?neutral\s+spirits?\b/i, parent: "spirits", subcategory: "OTHER SPECIALTIES & PROPRIETARIES" },
  { term: "absinthe", pattern: /\babsinthe\b/i, parent: "spirits", subcategory: "OTHER SPECIALTIES & PROPRIETARIES" },
  { term: "aquavit", pattern: /\baquavit\b/i, parent: "spirits", subcategory: "OTHER SPECIALTIES & PROPRIETARIES" },
  { term: "soju", pattern: /\bsoju\b/i, parent: "spirits", subcategory: "OTHER SPECIALTIES & PROPRIETARIES" },
  { term: "baijiu", pattern: /\bbaijiu\b/i, parent: "spirits", subcategory: "OTHER SPECIALTIES & PROPRIETARIES" },
  { term: "moonshine", pattern: /\bmoonshine\b/i, parent: "spirits", subcategory: "WHISKY SPECIALTIES" },
  { term: "sake", pattern: /\bsak[eé]\b/i, parent: "spirits", subcategory: "SAKE" },
  // RTD / Cocktails
  { term: "cocktail", pattern: /\bcocktail\b/i, parent: "spirits", subcategory: "OTHER COCKTAILS" },
  { term: "RTD", pattern: /\bRTD\b/, parent: "spirits", subcategory: "OTHER COCKTAILS" },
  { term: "margarita", pattern: /\bmargarita\b/i, parent: "spirits", subcategory: "OTHER COCKTAILS" },
  // Producer terms that imply spirits
  { term: "distillery", pattern: /\bdistiller(?:y|ies|s)\b/i, parent: "spirits", subcategory: "OTHER SPECIALTIES & PROPRIETARIES" },
  { term: "distilled", pattern: /\bdistilled\b/i, parent: "spirits", subcategory: "OTHER SPECIALTIES & PROPRIETARIES" },
  { term: "proof", pattern: /\b\d+\s*proof\b/i, parent: "spirits", subcategory: "OTHER SPECIALTIES & PROPRIETARIES" },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CategoryInference {
  /** Inferred top-level category (beer/wine/spirits), or null if unable to determine */
  category: BeverageCategory | null;
  /** Official TTB class/type code (e.g. "ALE", "TABLE RED WINE", "STRAIGHT BOURBON WHISKY") */
  subcategory: string | null;
  /** 0-1 confidence in the inference */
  confidence: number;
  /** The OCR text fragment that triggered the match */
  matchedTerm: string | null;
}

/**
 * Infer beverage category from OCR-extracted fields and/or raw text.
 *
 * Checks (in priority order):
 *   1. classType field (most reliable — already parsed from label)
 *   2. varietal field (strong wine indicator)
 *   3. appellation field (wine indicator)
 *   4. ageStatement field (spirits indicator)
 *   5. Raw OCR text scan (fallback)
 */
export function inferCategory(
  fields: {
    classType?: string;
    varietal?: string;
    appellation?: string;
    ageStatement?: string;
    rawText?: string;
  },
): CategoryInference {
  const noResult: CategoryInference = { category: null, subcategory: null, confidence: 0, matchedTerm: null };

  // Priority 1: classType — highest confidence, already parsed
  if (fields.classType) {
    const result = matchText(fields.classType);
    if (result) return { ...result, confidence: 0.95 };
  }

  // Priority 2: varietal — strong wine indicator
  if (fields.varietal) {
    const result = matchText(fields.varietal);
    if (result) return { ...result, confidence: 0.9 };
  }

  // Priority 3: appellation — implies wine
  if (fields.appellation) {
    return { category: "wine", subcategory: "Wine", confidence: 0.85, matchedTerm: fields.appellation };
  }

  // Priority 4: age statement — strong spirits indicator
  if (fields.ageStatement) {
    return { category: "spirits", subcategory: "Aged Spirit", confidence: 0.8, matchedTerm: fields.ageStatement };
  }

  // Priority 5: raw text scan — lower confidence
  if (fields.rawText) {
    const result = matchText(fields.rawText);
    if (result) return { ...result, confidence: 0.7 };
  }

  return noResult;
}

/**
 * Verify that the inferred category matches the declared category.
 * Returns a structured result suitable for display in the FormVsLabelTable.
 */
export function verifyCategoryMatch(
  declared: BeverageCategory,
  inferred: CategoryInference,
): {
  match: boolean;
  verdict: "match" | "mismatch" | "unknown";
  message: string;
  severity: "success" | "error" | "info";
} {
  if (!inferred.category) {
    return {
      match: true,
      verdict: "unknown",
      message: "Unable to infer category from label text",
      severity: "info",
    };
  }

  if (inferred.category === declared) {
    const sub = inferred.subcategory ? ` (${inferred.subcategory})` : "";
    return {
      match: true,
      verdict: "match",
      message: `Label text "${inferred.matchedTerm}" confirms ${capitalize(declared)}${sub}`,
      severity: "success",
    };
  }

  // Mismatch
  return {
    match: false,
    verdict: "mismatch",
    message: `Category mismatch: submitted as "${capitalize(declared)}" but label contains "${inferred.matchedTerm}" which indicates ${capitalize(inferred.category)} (${inferred.subcategory})`,
    severity: "error",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchText(text: string): Omit<CategoryInference, "confidence"> | null {
  for (const entry of SUBCATEGORY_MAP) {
    const m = text.match(entry.pattern);
    if (m) {
      return {
        category: entry.parent,
        subcategory: entry.subcategory,
        matchedTerm: m[0],
      };
    }
  }
  return null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
