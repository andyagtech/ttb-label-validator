/**
 * Sample label data derived from real TTB COLA (Certificate of Label Approval)
 * records pulled from the TTB Public COLA Registry (ttbonline.gov).
 *
 * Each entry pairs:
 *   1. colaSource — the real COLA record for provenance
 *   2. generation — LabelParams suitable for the generate-label API
 *   3. expectedFields — what OCR / validation should extract from a correct label
 *
 * Used by:
 *   - /api/generate-label route (PRESETS)
 *   - Sample submission JSON fixtures
 *   - Validation pipeline test harnesses
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColaSource {
  ttbId: string;
  brand: string;
  fancifulName: string;
  classCode: string;
  classType: string;
  originCode: string;
  origin: string;
  permit: string;
  approved: string;
}

export interface LabelGeneration {
  labelType: "front" | "back";
  category: "beer" | "wine" | "spirits";
  brandName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  appellation?: string;
  vintage?: string;
  nameAddress?: string;
  countryOfOrigin?: string;
}

export interface ExpectedFields {
  brand_name: string;
  class_type: string;
  alcohol_content?: string;
  net_contents: string;
  health_warning?: string;
  name_address?: string;
  country_origin?: string;
  sulfite_declaration?: string;
  appellation?: string;
  vintage_date?: string;
  varietal?: string;
  age_statement?: string;
}

export interface SampleLabel {
  /** Short key used as preset ID (e.g., "sierra-nevada-pale-ale-front") */
  key: string;
  /** Human-readable display name */
  displayName: string;
  colaSource: ColaSource;
  generation: LabelGeneration;
  expectedFields: ExpectedFields;
}

// ---------------------------------------------------------------------------
// Health warning constant (reused across all back labels)
// ---------------------------------------------------------------------------

const GOV_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

// ---------------------------------------------------------------------------
// Sample labels — Beer
// ---------------------------------------------------------------------------

const BEER_SAMPLES: SampleLabel[] = [
  // 1. Sierra Nevada Pale Ale — classic American craft ale
  {
    key: "sierra-nevada-pale-ale-front",
    displayName: "Sierra Nevada Pale Ale (Front)",
    colaSource: {
      ttbId: "24003001000645",
      brand: "SIERRA NEVADA",
      fancifulName: "20TH STREET ALE",
      classCode: "902",
      classType: "ALE",
      originCode: "01",
      origin: "CALIFORNIA",
      permit: "BR-CA-SIE-1",
      approved: "01/08/2024",
    },
    generation: {
      labelType: "front",
      category: "beer",
      brandName: "SIERRA NEVADA",
      classType: "Pale Ale",
      alcoholContent: "5.6% Alc. By Vol.",
      netContents: "12 FL OZ (355 mL)",
    },
    expectedFields: {
      brand_name: "SIERRA NEVADA",
      class_type: "Pale Ale",
      alcohol_content: "5.6% Alc. By Vol.",
      net_contents: "12 FL OZ (355 mL)",
    },
  },
  {
    key: "sierra-nevada-pale-ale-back",
    displayName: "Sierra Nevada Pale Ale (Back)",
    colaSource: {
      ttbId: "24003001000645",
      brand: "SIERRA NEVADA",
      fancifulName: "20TH STREET ALE",
      classCode: "902",
      classType: "ALE",
      originCode: "01",
      origin: "CALIFORNIA",
      permit: "BR-CA-SIE-1",
      approved: "01/08/2024",
    },
    generation: {
      labelType: "back",
      category: "beer",
      brandName: "SIERRA NEVADA",
      classType: "Pale Ale",
      alcoholContent: "5.6% Alc. By Vol.",
      netContents: "12 FL OZ (355 mL)",
      nameAddress: "Sierra Nevada Brewing Co., Chico, CA 95928",
    },
    expectedFields: {
      brand_name: "SIERRA NEVADA",
      class_type: "Pale Ale",
      net_contents: "12 FL OZ (355 mL)",
      health_warning: GOV_WARNING,
      name_address: "Sierra Nevada Brewing Co., Chico, CA 95928",
    },
  },

  // 2. Dogfish Head 60 Minute IPA — iconic IPA
  {
    key: "dogfish-head-60-min-ipa-front",
    displayName: "Dogfish Head 60 Minute IPA (Front)",
    colaSource: {
      ttbId: "23356001000155",
      brand: "DOGFISH HEAD",
      fancifulName: "60 MINUTE IPA",
      classCode: "902",
      classType: "ALE",
      originCode: "08",
      origin: "DELAWARE",
      permit: "BR-DE-21015",
      approved: "01/02/2024",
    },
    generation: {
      labelType: "front",
      category: "beer",
      brandName: "DOGFISH HEAD",
      classType: "India Pale Ale",
      alcoholContent: "6.0% Alc. By Vol.",
      netContents: "12 FL OZ",
    },
    expectedFields: {
      brand_name: "DOGFISH HEAD",
      class_type: "India Pale Ale",
      alcohol_content: "6.0% Alc. By Vol.",
      net_contents: "12 FL OZ",
    },
  },

  // 3. Goose Island Bourbon County Brand Stout — high ABV barrel-aged
  {
    key: "goose-island-bcbs-front",
    displayName: "Goose Island Bourbon County Stout (Front)",
    colaSource: {
      ttbId: "24061001000760",
      brand: "GOOSE ISLAND BEER CO.",
      fancifulName: "BOURBON COUNTY BRAND ORIGINAL STOUT",
      classCode: "903",
      classType: "STOUT",
      originCode: "14",
      origin: "ILLINOIS",
      permit: "BR-IL-FUL-15000",
      approved: "03/05/2024",
    },
    generation: {
      labelType: "front",
      category: "beer",
      brandName: "GOOSE ISLAND",
      classType: "Stout",
      alcoholContent: "14.4% Alc. By Vol.",
      netContents: "16.9 FL OZ (500 mL)",
    },
    expectedFields: {
      brand_name: "GOOSE ISLAND",
      class_type: "Stout",
      alcohol_content: "14.4% Alc. By Vol.",
      net_contents: "16.9 FL OZ (500 mL)",
    },
  },

  // 4. Blue Moon Belgian White — flavored malt beverage
  {
    key: "blue-moon-belgian-white-front",
    displayName: "Blue Moon Belgian White (Front)",
    colaSource: {
      ttbId: "24030001000666",
      brand: "BLUE MOON",
      fancifulName: "BELGIAN WHITE",
      classCode: "906",
      classType: "MALT BEVERAGES SPECIALITIES - FLAVORED",
      originCode: "06",
      origin: "COLORADO",
      permit: "BR-CO-CBC-1",
      approved: "01/31/2024",
    },
    generation: {
      labelType: "front",
      category: "beer",
      brandName: "BLUE MOON",
      classType: "Belgian-Style Wheat Ale",
      alcoholContent: "5.4% Alc. By Vol.",
      netContents: "12 FL OZ (355 mL)",
    },
    expectedFields: {
      brand_name: "BLUE MOON",
      class_type: "Belgian-Style Wheat Ale",
      alcohol_content: "5.4% Alc. By Vol.",
      net_contents: "12 FL OZ (355 mL)",
    },
  },

  // 5. Lagunitas IPNA — non-alcoholic (near beer)
  {
    key: "lagunitas-ipna-front",
    displayName: "Lagunitas IPNA Non-Alcoholic (Front)",
    colaSource: {
      ttbId: "24218001000290",
      brand: "THE LAGUNITAS BREWING COMPANY",
      fancifulName: "IPNA",
      classCode: "950",
      classType: "CEREAL BEVERAGES - NEAR BEER (NON ALCOHOLIC)",
      originCode: "01",
      origin: "CALIFORNIA",
      permit: "BR-CA-LAG-1",
      approved: "08/14/2024",
    },
    generation: {
      labelType: "front",
      category: "beer",
      brandName: "LAGUNITAS",
      classType: "Non-Alcoholic IPA",
      alcoholContent: "Less than 0.5% Alc. By Vol.",
      netContents: "12 FL OZ (355 mL)",
    },
    expectedFields: {
      brand_name: "LAGUNITAS",
      class_type: "Non-Alcoholic IPA",
      alcohol_content: "Less than 0.5% Alc. By Vol.",
      net_contents: "12 FL OZ (355 mL)",
    },
  },
];

// ---------------------------------------------------------------------------
// Sample labels — Wine
// ---------------------------------------------------------------------------

const WINE_SAMPLES: SampleLabel[] = [
  // 6. Robert Mondavi Cabernet — Napa Valley
  {
    key: "mondavi-cabernet-front",
    displayName: "Robert Mondavi Cabernet (Front)",
    colaSource: {
      ttbId: "24131001000593",
      brand: "ROBERT MONDAVI WINERY",
      fancifulName: "THE ESTATES",
      classCode: "82",
      classType: "TABLE WINE",
      originCode: "01",
      origin: "CALIFORNIA",
      permit: "BW-CA-4511",
      approved: "05/17/2024",
    },
    generation: {
      labelType: "front",
      category: "wine",
      brandName: "ROBERT MONDAVI WINERY",
      classType: "Cabernet Sauvignon",
      alcoholContent: "Alcohol 14.5% by Volume",
      netContents: "750 mL",
      appellation: "Napa Valley",
      vintage: "2021",
    },
    expectedFields: {
      brand_name: "ROBERT MONDAVI WINERY",
      class_type: "Cabernet Sauvignon",
      alcohol_content: "Alcohol 14.5% by Volume",
      net_contents: "750 mL",
      appellation: "Napa Valley",
      vintage_date: "2021",
      varietal: "Cabernet Sauvignon",
    },
  },
  {
    key: "mondavi-cabernet-back",
    displayName: "Robert Mondavi Cabernet (Back)",
    colaSource: {
      ttbId: "24131001000593",
      brand: "ROBERT MONDAVI WINERY",
      fancifulName: "THE ESTATES",
      classCode: "82",
      classType: "TABLE WINE",
      originCode: "01",
      origin: "CALIFORNIA",
      permit: "BW-CA-4511",
      approved: "05/17/2024",
    },
    generation: {
      labelType: "back",
      category: "wine",
      brandName: "ROBERT MONDAVI WINERY",
      classType: "Cabernet Sauvignon",
      alcoholContent: "Alcohol 14.5% by Volume",
      netContents: "750 mL",
      nameAddress: "Robert Mondavi Winery, Oakville, CA 94562",
      countryOfOrigin: "United States",
    },
    expectedFields: {
      brand_name: "ROBERT MONDAVI WINERY",
      class_type: "Cabernet Sauvignon",
      net_contents: "750 mL",
      health_warning: GOV_WARNING,
      name_address: "Robert Mondavi Winery, Oakville, CA 94562",
      sulfite_declaration: "Contains Sulfites",
      country_origin: "United States",
    },
  },

  // 7. Barefoot Moscato — popular value brand
  {
    key: "barefoot-moscato-front",
    displayName: "Barefoot Moscato (Front)",
    colaSource: {
      ttbId: "24210001000213",
      brand: "BAREFOOT",
      fancifulName: "MOSCATO",
      classCode: "82",
      classType: "TABLE WINE",
      originCode: "01",
      origin: "CALIFORNIA",
      permit: "BW-CA-5765",
      approved: "07/31/2024",
    },
    generation: {
      labelType: "front",
      category: "wine",
      brandName: "BAREFOOT",
      classType: "Moscato",
      alcoholContent: "Alcohol 9.0% by Volume",
      netContents: "750 mL",
      appellation: "California",
    },
    expectedFields: {
      brand_name: "BAREFOOT",
      class_type: "Moscato",
      alcohol_content: "Alcohol 9.0% by Volume",
      net_contents: "750 mL",
      appellation: "California",
      varietal: "Moscato",
    },
  },

  // 8. Kim Crawford Sauvignon Blanc — New Zealand import
  {
    key: "kim-crawford-sauv-blanc-front",
    displayName: "Kim Crawford Sauvignon Blanc (Front)",
    colaSource: {
      ttbId: "24089001000367",
      brand: "KIM CRAWFORD",
      fancifulName: "SAUVIGNON BLANC",
      classCode: "82",
      classType: "TABLE WINE",
      originCode: "NZ",
      origin: "NEW ZEALAND",
      permit: "NY-I-1086",
      approved: "03/29/2024",
    },
    generation: {
      labelType: "front",
      category: "wine",
      brandName: "KIM CRAWFORD",
      classType: "Sauvignon Blanc",
      alcoholContent: "Alcohol 13.0% by Volume",
      netContents: "750 mL",
      appellation: "Marlborough",
      vintage: "2023",
      countryOfOrigin: "New Zealand",
    },
    expectedFields: {
      brand_name: "KIM CRAWFORD",
      class_type: "Sauvignon Blanc",
      alcohol_content: "Alcohol 13.0% by Volume",
      net_contents: "750 mL",
      appellation: "Marlborough",
      vintage_date: "2023",
      varietal: "Sauvignon Blanc",
      country_origin: "New Zealand",
    },
  },
  {
    key: "kim-crawford-sauv-blanc-back",
    displayName: "Kim Crawford Sauvignon Blanc (Back)",
    colaSource: {
      ttbId: "24089001000367",
      brand: "KIM CRAWFORD",
      fancifulName: "SAUVIGNON BLANC",
      classCode: "82",
      classType: "TABLE WINE",
      originCode: "NZ",
      origin: "NEW ZEALAND",
      permit: "NY-I-1086",
      approved: "03/29/2024",
    },
    generation: {
      labelType: "back",
      category: "wine",
      brandName: "KIM CRAWFORD",
      classType: "Sauvignon Blanc",
      alcoholContent: "Alcohol 13.0% by Volume",
      netContents: "750 mL",
      nameAddress: "Imported by Constellation Brands, Inc., Victor, NY 14564",
      countryOfOrigin: "New Zealand",
    },
    expectedFields: {
      brand_name: "KIM CRAWFORD",
      class_type: "Sauvignon Blanc",
      net_contents: "750 mL",
      health_warning: GOV_WARNING,
      name_address: "Imported by Constellation Brands, Inc., Victor, NY 14564",
      sulfite_declaration: "Contains Sulfites",
      country_origin: "New Zealand",
    },
  },

  // 9. Opus One — premium Napa
  {
    key: "opus-one-front",
    displayName: "Opus One (Front)",
    colaSource: {
      ttbId: "24151001000297",
      brand: "OPUS ONE",
      fancifulName: "",
      classCode: "82",
      classType: "TABLE WINE",
      originCode: "01",
      origin: "CALIFORNIA",
      permit: "BW-CA-5437",
      approved: "06/05/2024",
    },
    generation: {
      labelType: "front",
      category: "wine",
      brandName: "OPUS ONE",
      classType: "Red Wine",
      alcoholContent: "Alcohol 14.5% by Volume",
      netContents: "750 mL",
      appellation: "Napa Valley",
      vintage: "2021",
    },
    expectedFields: {
      brand_name: "OPUS ONE",
      class_type: "Red Wine",
      alcohol_content: "Alcohol 14.5% by Volume",
      net_contents: "750 mL",
      appellation: "Napa Valley",
      vintage_date: "2021",
    },
  },
];

// ---------------------------------------------------------------------------
// Sample labels — Spirits
// ---------------------------------------------------------------------------

const SPIRITS_SAMPLES: SampleLabel[] = [
  // 10. Jack Daniel's Tennessee Whiskey
  {
    key: "jack-daniels-front",
    displayName: "Jack Daniel's Tennessee Whiskey (Front)",
    colaSource: {
      ttbId: "24002001000457",
      brand: "JACK DANIEL'S",
      fancifulName: "10 YEARS OLD",
      classCode: "140",
      classType: "WHISKY",
      originCode: "43",
      origin: "TENNESSEE",
      permit: "DSP-TN-4",
      approved: "01/04/2024",
    },
    generation: {
      labelType: "front",
      category: "spirits",
      brandName: "JACK DANIEL'S",
      classType: "Tennessee Whiskey",
      alcoholContent: "40% Alc./Vol. (80 Proof)",
      netContents: "750 mL",
    },
    expectedFields: {
      brand_name: "JACK DANIEL'S",
      class_type: "Tennessee Whiskey",
      alcohol_content: "40% Alc./Vol. (80 Proof)",
      net_contents: "750 mL",
      age_statement: "10 Years Old",
    },
  },
  {
    key: "jack-daniels-back",
    displayName: "Jack Daniel's Tennessee Whiskey (Back)",
    colaSource: {
      ttbId: "24002001000457",
      brand: "JACK DANIEL'S",
      fancifulName: "10 YEARS OLD",
      classCode: "140",
      classType: "WHISKY",
      originCode: "43",
      origin: "TENNESSEE",
      permit: "DSP-TN-4",
      approved: "01/04/2024",
    },
    generation: {
      labelType: "back",
      category: "spirits",
      brandName: "JACK DANIEL'S",
      classType: "Tennessee Whiskey",
      alcoholContent: "40% Alc./Vol. (80 Proof)",
      netContents: "750 mL",
      nameAddress: "Jack Daniel Distillery, Lynchburg, TN 37352",
    },
    expectedFields: {
      brand_name: "JACK DANIEL'S",
      class_type: "Tennessee Whiskey",
      net_contents: "750 mL",
      health_warning: GOV_WARNING,
      name_address: "Jack Daniel Distillery, Lynchburg, TN 37352",
    },
  },

  // 11. Tito's Handmade Vodka
  {
    key: "titos-vodka-front",
    displayName: "Tito's Handmade Vodka (Front)",
    colaSource: {
      ttbId: "24166001000237",
      brand: "TITO'S",
      fancifulName: "HANDMADE VODKA",
      classCode: "130",
      classType: "VODKA",
      originCode: "44",
      origin: "TEXAS",
      permit: "DSP-TX-15180",
      approved: "06/17/2024",
    },
    generation: {
      labelType: "front",
      category: "spirits",
      brandName: "TITO'S HANDMADE VODKA",
      classType: "Vodka",
      alcoholContent: "40% Alc./Vol. (80 Proof)",
      netContents: "750 mL",
    },
    expectedFields: {
      brand_name: "TITO'S HANDMADE VODKA",
      class_type: "Vodka",
      alcohol_content: "40% Alc./Vol. (80 Proof)",
      net_contents: "750 mL",
    },
  },

  // 12. Hennessy VS Cognac — imported spirit
  {
    key: "hennessy-vs-front",
    displayName: "Hennessy V.S Cognac (Front)",
    colaSource: {
      ttbId: "24055001000454",
      brand: "HENNESSY",
      fancifulName: "V.S",
      classCode: "120",
      classType: "BRANDY",
      originCode: "FR",
      origin: "FRANCE",
      permit: "NY-I-211",
      approved: "02/27/2024",
    },
    generation: {
      labelType: "front",
      category: "spirits",
      brandName: "HENNESSY",
      classType: "Cognac",
      alcoholContent: "40% Alc./Vol. (80 Proof)",
      netContents: "750 mL",
      countryOfOrigin: "France",
    },
    expectedFields: {
      brand_name: "HENNESSY",
      class_type: "Cognac",
      alcohol_content: "40% Alc./Vol. (80 Proof)",
      net_contents: "750 mL",
      country_origin: "France",
    },
  },
  {
    key: "hennessy-vs-back",
    displayName: "Hennessy V.S Cognac (Back)",
    colaSource: {
      ttbId: "24055001000454",
      brand: "HENNESSY",
      fancifulName: "V.S",
      classCode: "120",
      classType: "BRANDY",
      originCode: "FR",
      origin: "FRANCE",
      permit: "NY-I-211",
      approved: "02/27/2024",
    },
    generation: {
      labelType: "back",
      category: "spirits",
      brandName: "HENNESSY",
      classType: "Cognac",
      alcoholContent: "40% Alc./Vol. (80 Proof)",
      netContents: "750 mL",
      nameAddress: "Imported by Moet Hennessy USA, Inc., New York, NY 10153",
      countryOfOrigin: "France",
    },
    expectedFields: {
      brand_name: "HENNESSY",
      class_type: "Cognac",
      net_contents: "750 mL",
      health_warning: GOV_WARNING,
      name_address: "Imported by Moet Hennessy USA, Inc., New York, NY 10153",
      country_origin: "France",
    },
  },

  // 13. Patron Silver Tequila — imported from Mexico
  {
    key: "patron-silver-front",
    displayName: "Patron Silver Tequila (Front)",
    colaSource: {
      ttbId: "24025001000159",
      brand: "PATRON",
      fancifulName: "SILVER",
      classCode: "160",
      classType: "TEQUILA",
      originCode: "MX",
      origin: "MEXICO",
      permit: "NY-I-3",
      approved: "01/25/2024",
    },
    generation: {
      labelType: "front",
      category: "spirits",
      brandName: "PATRON",
      classType: "Tequila Silver",
      alcoholContent: "40% Alc./Vol. (80 Proof)",
      netContents: "750 mL",
      countryOfOrigin: "Mexico",
    },
    expectedFields: {
      brand_name: "PATRON",
      class_type: "Tequila Silver",
      alcohol_content: "40% Alc./Vol. (80 Proof)",
      net_contents: "750 mL",
      country_origin: "Mexico",
    },
  },

  // 14. Maker's Mark Bourbon — Kentucky
  {
    key: "makers-mark-front",
    displayName: "Maker's Mark Bourbon (Front)",
    colaSource: {
      ttbId: "24094001000161",
      brand: "MAKER'S MARK",
      fancifulName: "",
      classCode: "140",
      classType: "WHISKY",
      originCode: "18",
      origin: "KENTUCKY",
      permit: "DSP-KY-7",
      approved: "04/04/2024",
    },
    generation: {
      labelType: "front",
      category: "spirits",
      brandName: "MAKER'S MARK",
      classType: "Kentucky Straight Bourbon Whisky",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
    },
    expectedFields: {
      brand_name: "MAKER'S MARK",
      class_type: "Kentucky Straight Bourbon Whisky",
      alcohol_content: "45% Alc./Vol. (90 Proof)",
      net_contents: "750 mL",
    },
  },
  {
    key: "makers-mark-back",
    displayName: "Maker's Mark Bourbon (Back)",
    colaSource: {
      ttbId: "24094001000161",
      brand: "MAKER'S MARK",
      fancifulName: "",
      classCode: "140",
      classType: "WHISKY",
      originCode: "18",
      origin: "KENTUCKY",
      permit: "DSP-KY-7",
      approved: "04/04/2024",
    },
    generation: {
      labelType: "back",
      category: "spirits",
      brandName: "MAKER'S MARK",
      classType: "Kentucky Straight Bourbon Whisky",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
      nameAddress: "Maker's Mark Distillery, Inc., Loretto, KY 40037",
    },
    expectedFields: {
      brand_name: "MAKER'S MARK",
      class_type: "Kentucky Straight Bourbon Whisky",
      net_contents: "750 mL",
      health_warning: GOV_WARNING,
      name_address: "Maker's Mark Distillery, Inc., Loretto, KY 40037",
    },
  },
];

// ---------------------------------------------------------------------------
// Combined exports
// ---------------------------------------------------------------------------

export const SAMPLE_LABELS: SampleLabel[] = [...BEER_SAMPLES, ...WINE_SAMPLES, ...SPIRITS_SAMPLES];

/** Lookup by key */
export function getSampleLabel(key: string): SampleLabel | undefined {
  return SAMPLE_LABELS.find((s) => s.key === key);
}

/** All samples for a category */
export function getSamplesByCategory(category: "beer" | "wine" | "spirits"): SampleLabel[] {
  return SAMPLE_LABELS.filter((s) => s.generation.category === category);
}

/** All front-label samples */
export function getFrontSamples(): SampleLabel[] {
  return SAMPLE_LABELS.filter((s) => s.generation.labelType === "front");
}

/** Convert a SampleLabel's generation params to the PRESETS format used by the route */
export function toLabelParams(sample: SampleLabel) {
  return { ...sample.generation };
}

// ---------------------------------------------------------------------------
// Product pairs — groups front + back for each product
// ---------------------------------------------------------------------------

/** Default name+address for products missing a back-label entry */
const DEFAULT_NAME_ADDRESS: Record<string, string> = {
  "DOGFISH HEAD": "Dogfish Head Craft Brewery, Milton, DE 19968",
  "GOOSE ISLAND": "Goose Island Beer Co., Chicago, IL 60608",
  "BLUE MOON": "Blue Moon Brewing Company, Golden, CO 80401",
  "LAGUNITAS": "Lagunitas Brewing Company, Petaluma, CA 94954",
  "BAREFOOT": "Barefoot Cellars, Modesto, CA 95354",
  "OPUS ONE": "Opus One Winery, Oakville, CA 94562",
  "TITO'S HANDMADE VODKA": "Fifth Generation, Inc., Austin, TX 78702",
  "PATRON": "Patron Spirits International AG, Imported by The Patron Spirits Company, Coral Gables, FL 33134",
};

export interface SampleProduct {
  /** Unique product key (derived from front key minus "-front") */
  productKey: string;
  /** Human-readable product name */
  productName: string;
  category: "beer" | "wine" | "spirits";
  front: LabelGeneration;
  back: LabelGeneration;
  expectedFrontFields: ExpectedFields;
  expectedBackFields: ExpectedFields;
}

/**
 * Group samples into front+back product pairs.
 * Products missing an explicit back label get one auto-generated.
 */
export function getSampleProducts(): SampleProduct[] {
  const frontSamples = SAMPLE_LABELS.filter((s) => s.generation.labelType === "front");

  return frontSamples.map((front) => {
    const productKey = front.key.replace(/-front$/, "");
    const backKey = `${productKey}-back`;
    const backSample = SAMPLE_LABELS.find((s) => s.key === backKey);

    const backGeneration: LabelGeneration = backSample
      ? backSample.generation
      : {
          labelType: "back",
          category: front.generation.category,
          brandName: front.generation.brandName,
          classType: front.generation.classType,
          alcoholContent: front.generation.alcoholContent,
          netContents: front.generation.netContents,
          nameAddress: DEFAULT_NAME_ADDRESS[front.generation.brandName] || `${front.generation.brandName} Beverage Co., City, ST 00000`,
          countryOfOrigin: front.generation.countryOfOrigin,
        };

    const backExpected: ExpectedFields = backSample
      ? backSample.expectedFields
      : {
          brand_name: front.expectedFields.brand_name,
          class_type: front.expectedFields.class_type,
          net_contents: front.expectedFields.net_contents,
          health_warning: GOV_WARNING,
          name_address: backGeneration.nameAddress || "",
          ...(backGeneration.countryOfOrigin ? { country_origin: backGeneration.countryOfOrigin } : {}),
          ...(front.generation.category === "wine" ? { sulfite_declaration: "Contains Sulfites" } : {}),
        };

    // Build a display name from the brand
    const displayName = front.displayName.replace(" (Front)", "");

    return {
      productKey,
      productName: displayName,
      category: front.generation.category,
      front: front.generation,
      back: backGeneration,
      expectedFrontFields: front.expectedFields,
      expectedBackFields: backExpected,
    };
  });
}
