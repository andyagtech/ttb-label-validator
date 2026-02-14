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
// Additional products — previously inline extras, now full catalog entries
// ---------------------------------------------------------------------------

const ADDITIONAL_BEER: SampleLabel[] = [
  // 15. Bell's Two Hearted Ale
  {
    key: "bells-two-hearted-front",
    displayName: "Bell's Two Hearted Ale (Front)",
    colaSource: {
      ttbId: "24018001000312",
      brand: "BELL'S",
      fancifulName: "TWO HEARTED ALE",
      classCode: "902",
      classType: "ALE",
      originCode: "23",
      origin: "MICHIGAN",
      permit: "BR-MI-BEL-1",
      approved: "01/18/2024",
    },
    generation: {
      labelType: "front",
      category: "beer",
      brandName: "BELL'S",
      classType: "India Pale Ale",
      alcoholContent: "7.0% Alc. By Vol.",
      netContents: "12 FL OZ",
    },
    expectedFields: {
      brand_name: "BELL'S",
      class_type: "India Pale Ale",
      alcohol_content: "7.0% Alc. By Vol.",
      net_contents: "12 FL OZ",
    },
  },

  // 16. Founders All Day IPA
  {
    key: "founders-all-day-ipa-front",
    displayName: "Founders All Day IPA (Front)",
    colaSource: {
      ttbId: "24022001000189",
      brand: "FOUNDERS",
      fancifulName: "ALL DAY IPA",
      classCode: "902",
      classType: "ALE",
      originCode: "23",
      origin: "MICHIGAN",
      permit: "BR-MI-FOU-1",
      approved: "01/22/2024",
    },
    generation: {
      labelType: "front",
      category: "beer",
      brandName: "FOUNDERS",
      classType: "India Pale Ale",
      alcoholContent: "4.7% Alc. By Vol.",
      netContents: "12 FL OZ",
    },
    expectedFields: {
      brand_name: "FOUNDERS",
      class_type: "India Pale Ale",
      alcohol_content: "4.7% Alc. By Vol.",
      net_contents: "12 FL OZ",
    },
  },

  // 17. Yuengling Traditional Lager
  {
    key: "yuengling-lager-front",
    displayName: "Yuengling Traditional Lager (Front)",
    colaSource: {
      ttbId: "24035001000401",
      brand: "YUENGLING",
      fancifulName: "TRADITIONAL LAGER",
      classCode: "901",
      classType: "LAGER",
      originCode: "39",
      origin: "PENNSYLVANIA",
      permit: "BR-PA-YUE-1",
      approved: "02/05/2024",
    },
    generation: {
      labelType: "front",
      category: "beer",
      brandName: "YUENGLING",
      classType: "Lager",
      alcoholContent: "4.5% Alc. By Vol.",
      netContents: "12 FL OZ",
    },
    expectedFields: {
      brand_name: "YUENGLING",
      class_type: "Lager",
      alcohol_content: "4.5% Alc. By Vol.",
      net_contents: "12 FL OZ",
    },
  },

  // 18. New Belgium Fat Tire Amber Ale
  {
    key: "new-belgium-fat-tire-front",
    displayName: "New Belgium Fat Tire Amber Ale (Front)",
    colaSource: {
      ttbId: "24041001000223",
      brand: "NEW BELGIUM",
      fancifulName: "FAT TIRE",
      classCode: "902",
      classType: "ALE",
      originCode: "06",
      origin: "COLORADO",
      permit: "BR-CO-NBR-1",
      approved: "02/11/2024",
    },
    generation: {
      labelType: "front",
      category: "beer",
      brandName: "NEW BELGIUM",
      classType: "Amber Ale",
      alcoholContent: "5.2% Alc. By Vol.",
      netContents: "12 FL OZ",
    },
    expectedFields: {
      brand_name: "NEW BELGIUM",
      class_type: "Amber Ale",
      alcohol_content: "5.2% Alc. By Vol.",
      net_contents: "12 FL OZ",
    },
  },
];

const ADDITIONAL_WINE: SampleLabel[] = [
  // 19. Caymus Cabernet Sauvignon
  {
    key: "caymus-cabernet-front",
    displayName: "Caymus Cabernet Sauvignon 2021 (Front)",
    colaSource: {
      ttbId: "24112001000178",
      brand: "CAYMUS VINEYARDS",
      fancifulName: "",
      classCode: "82",
      classType: "TABLE WINE",
      originCode: "01",
      origin: "CALIFORNIA",
      permit: "BW-CA-6012",
      approved: "04/22/2024",
    },
    generation: {
      labelType: "front",
      category: "wine",
      brandName: "CAYMUS VINEYARDS",
      classType: "Cabernet Sauvignon",
      alcoholContent: "Alcohol 14.6% by Volume",
      netContents: "750 mL",
      appellation: "Napa Valley",
      vintage: "2021",
    },
    expectedFields: {
      brand_name: "CAYMUS VINEYARDS",
      class_type: "Cabernet Sauvignon",
      alcohol_content: "Alcohol 14.6% by Volume",
      net_contents: "750 mL",
      appellation: "Napa Valley",
      vintage_date: "2021",
      varietal: "Cabernet Sauvignon",
    },
  },

  // 20. Josh Cellars Chardonnay
  {
    key: "josh-cellars-chardonnay-front",
    displayName: "Josh Cellars Chardonnay 2022 (Front)",
    colaSource: {
      ttbId: "24128001000345",
      brand: "JOSH CELLARS",
      fancifulName: "",
      classCode: "82",
      classType: "TABLE WINE",
      originCode: "01",
      origin: "CALIFORNIA",
      permit: "BW-CA-7891",
      approved: "05/08/2024",
    },
    generation: {
      labelType: "front",
      category: "wine",
      brandName: "JOSH CELLARS",
      classType: "Chardonnay",
      alcoholContent: "Alcohol 13.5% by Volume",
      netContents: "750 mL",
      appellation: "California",
      vintage: "2022",
    },
    expectedFields: {
      brand_name: "JOSH CELLARS",
      class_type: "Chardonnay",
      alcohol_content: "Alcohol 13.5% by Volume",
      net_contents: "750 mL",
      appellation: "California",
      vintage_date: "2022",
      varietal: "Chardonnay",
    },
  },

  // 21. Whispering Angel Rosé
  {
    key: "whispering-angel-rose-front",
    displayName: "Whispering Angel Rosé 2023 (Front)",
    colaSource: {
      ttbId: "24145001000267",
      brand: "WHISPERING ANGEL",
      fancifulName: "",
      classCode: "82",
      classType: "TABLE WINE",
      originCode: "FR",
      origin: "FRANCE",
      permit: "NY-I-4523",
      approved: "05/25/2024",
    },
    generation: {
      labelType: "front",
      category: "wine",
      brandName: "WHISPERING ANGEL",
      classType: "Rosé",
      alcoholContent: "Alcohol 13.0% by Volume",
      netContents: "750 mL",
      appellation: "Côtes de Provence",
      vintage: "2023",
      countryOfOrigin: "France",
    },
    expectedFields: {
      brand_name: "WHISPERING ANGEL",
      class_type: "Rosé",
      alcohol_content: "Alcohol 13.0% by Volume",
      net_contents: "750 mL",
      appellation: "Côtes de Provence",
      vintage_date: "2023",
      country_origin: "France",
    },
  },
];

const ADDITIONAL_SPIRITS: SampleLabel[] = [
  // 22. Woodford Reserve Double Oaked
  {
    key: "woodford-reserve-front",
    displayName: "Woodford Reserve Double Oaked (Front)",
    colaSource: {
      ttbId: "24078001000456",
      brand: "WOODFORD RESERVE",
      fancifulName: "DOUBLE OAKED",
      classCode: "140",
      classType: "WHISKY",
      originCode: "18",
      origin: "KENTUCKY",
      permit: "DSP-KY-52",
      approved: "03/18/2024",
    },
    generation: {
      labelType: "front",
      category: "spirits",
      brandName: "WOODFORD RESERVE",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45.2% Alc./Vol. (90.4 Proof)",
      netContents: "750 mL",
    },
    expectedFields: {
      brand_name: "WOODFORD RESERVE",
      class_type: "Kentucky Straight Bourbon Whiskey",
      alcohol_content: "45.2% Alc./Vol. (90.4 Proof)",
      net_contents: "750 mL",
    },
  },

  // 23. Casamigos Blanco Tequila
  {
    key: "casamigos-blanco-front",
    displayName: "Casamigos Blanco Tequila (Front)",
    colaSource: {
      ttbId: "24099001000312",
      brand: "CASAMIGOS",
      fancifulName: "BLANCO",
      classCode: "160",
      classType: "TEQUILA",
      originCode: "MX",
      origin: "MEXICO",
      permit: "CT-I-892",
      approved: "04/09/2024",
    },
    generation: {
      labelType: "front",
      category: "spirits",
      brandName: "CASAMIGOS",
      classType: "Tequila Blanco",
      alcoholContent: "40% Alc./Vol. (80 Proof)",
      netContents: "750 mL",
      countryOfOrigin: "Mexico",
    },
    expectedFields: {
      brand_name: "CASAMIGOS",
      class_type: "Tequila Blanco",
      alcohol_content: "40% Alc./Vol. (80 Proof)",
      net_contents: "750 mL",
      country_origin: "Mexico",
    },
  },

  // 24. Grey Goose Vodka
  {
    key: "grey-goose-vodka-front",
    displayName: "Grey Goose Vodka (Front)",
    colaSource: {
      ttbId: "24155001000189",
      brand: "GREY GOOSE",
      fancifulName: "",
      classCode: "130",
      classType: "VODKA",
      originCode: "FR",
      origin: "FRANCE",
      permit: "BM-I-334",
      approved: "06/07/2024",
    },
    generation: {
      labelType: "front",
      category: "spirits",
      brandName: "GREY GOOSE",
      classType: "Vodka",
      alcoholContent: "40% Alc./Vol. (80 Proof)",
      netContents: "750 mL",
      countryOfOrigin: "France",
    },
    expectedFields: {
      brand_name: "GREY GOOSE",
      class_type: "Vodka",
      alcohol_content: "40% Alc./Vol. (80 Proof)",
      net_contents: "750 mL",
      country_origin: "France",
    },
  },
];

// ---------------------------------------------------------------------------
// Expanded catalog — additional products from ttb_cola_records.json
// ---------------------------------------------------------------------------

const EXPANDED_BEER: SampleLabel[] = [
  // 25. Samuel Adams Boston Lager — classic American craft lager
  {
    key: "samuel-adams-boston-lager-front",
    displayName: "Samuel Adams Boston Lager (Front)",
    colaSource: {
      ttbId: "24051001000312",
      brand: "SAMUEL ADAMS",
      fancifulName: "BOSTON LAGER",
      classCode: "901",
      classType: "LAGER",
      originCode: "06",
      origin: "MASSACHUSETTS",
      permit: "BR-MA-SA-1",
      approved: "02/20/2024",
    },
    generation: {
      labelType: "front",
      category: "beer",
      brandName: "SAMUEL ADAMS",
      classType: "Vienna Lager",
      alcoholContent: "5.0% Alc. By Vol.",
      netContents: "12 FL OZ (355 mL)",
    },
    expectedFields: {
      brand_name: "SAMUEL ADAMS",
      class_type: "Vienna Lager",
      alcohol_content: "5.0% Alc. By Vol.",
      net_contents: "12 FL OZ (355 mL)",
    },
  },

  // 26. Guinness Draught Stout — imported Irish stout
  {
    key: "guinness-draught-front",
    displayName: "Guinness Draught Stout (Front)",
    colaSource: {
      ttbId: "24078001000234",
      brand: "GUINNESS",
      fancifulName: "DRAUGHT STOUT",
      classCode: "903",
      classType: "STOUT",
      originCode: "00",
      origin: "IRELAND",
      permit: "IM-IR-GUI-1",
      approved: "03/19/2024",
    },
    generation: {
      labelType: "front",
      category: "beer",
      brandName: "GUINNESS",
      classType: "Stout",
      alcoholContent: "4.2% Alc. By Vol.",
      netContents: "14.9 FL OZ (440 mL)",
      countryOfOrigin: "Ireland",
    },
    expectedFields: {
      brand_name: "GUINNESS",
      class_type: "Stout",
      alcohol_content: "4.2% Alc. By Vol.",
      net_contents: "14.9 FL OZ (440 mL)",
      country_origin: "Ireland",
    },
  },

  // 27. Modelo Especial — imported Mexican lager
  {
    key: "modelo-especial-front",
    displayName: "Modelo Especial (Front)",
    colaSource: {
      ttbId: "24056001000891",
      brand: "MODELO",
      fancifulName: "ESPECIAL",
      classCode: "901",
      classType: "LAGER",
      originCode: "00",
      origin: "MEXICO",
      permit: "IM-MX-MOD-1",
      approved: "02/25/2024",
    },
    generation: {
      labelType: "front",
      category: "beer",
      brandName: "MODELO",
      classType: "Pilsner-Style Lager",
      alcoholContent: "4.4% Alc. By Vol.",
      netContents: "12 FL OZ (355 mL)",
      countryOfOrigin: "Mexico",
    },
    expectedFields: {
      brand_name: "MODELO",
      class_type: "Pilsner-Style Lager",
      alcohol_content: "4.4% Alc. By Vol.",
      net_contents: "12 FL OZ (355 mL)",
      country_origin: "Mexico",
    },
  },

  // 28. Deschutes Fresh Squeezed IPA — Pacific Northwest craft
  {
    key: "deschutes-fresh-squeezed-front",
    displayName: "Deschutes Fresh Squeezed IPA (Front)",
    colaSource: {
      ttbId: "24067001000523",
      brand: "DESCHUTES",
      fancifulName: "FRESH SQUEEZED IPA",
      classCode: "902",
      classType: "ALE",
      originCode: "38",
      origin: "OREGON",
      permit: "BR-OR-DES-1",
      approved: "03/08/2024",
    },
    generation: {
      labelType: "front",
      category: "beer",
      brandName: "DESCHUTES",
      classType: "India Pale Ale",
      alcoholContent: "6.4% Alc. By Vol.",
      netContents: "12 FL OZ (355 mL)",
    },
    expectedFields: {
      brand_name: "DESCHUTES",
      class_type: "India Pale Ale",
      alcohol_content: "6.4% Alc. By Vol.",
      net_contents: "12 FL OZ (355 mL)",
    },
  },

  // 29. Athletic Brewing Run Wild — non-alcoholic craft IPA
  {
    key: "athletic-run-wild-front",
    displayName: "Athletic Brewing Run Wild IPA (Front)",
    colaSource: {
      ttbId: "23345001000623",
      brand: "ATHLETIC BREWING",
      fancifulName: "RUN WILD IPA",
      classCode: "902",
      classType: "ALE",
      originCode: "14",
      origin: "CONNECTICUT",
      permit: "BR-CT-ATH-1",
      approved: "12/11/2023",
    },
    generation: {
      labelType: "front",
      category: "beer",
      brandName: "ATHLETIC BREWING",
      classType: "Non-Alcoholic IPA",
      alcoholContent: "Less than 0.5% Alc. By Vol.",
      netContents: "12 FL OZ (355 mL)",
    },
    expectedFields: {
      brand_name: "ATHLETIC BREWING",
      class_type: "Non-Alcoholic IPA",
      alcohol_content: "Less than 0.5% Alc. By Vol.",
      net_contents: "12 FL OZ (355 mL)",
    },
  },
];

const EXPANDED_WINE: SampleLabel[] = [
  // 30. Kendall-Jackson Vintner's Reserve Chardonnay
  {
    key: "kendall-jackson-chardonnay-front",
    displayName: "Kendall-Jackson Chardonnay 2022 (Front)",
    colaSource: {
      ttbId: "24023001000456",
      brand: "KENDALL-JACKSON",
      fancifulName: "VINTNER'S RESERVE CHARDONNAY",
      classCode: "82",
      classType: "TABLE WINE",
      originCode: "01",
      origin: "CALIFORNIA",
      permit: "BW-CA-KJ-1",
      approved: "01/23/2024",
    },
    generation: {
      labelType: "front",
      category: "wine",
      brandName: "KENDALL-JACKSON",
      classType: "Chardonnay",
      alcoholContent: "Alcohol 13.5% by Volume",
      netContents: "750 mL",
      appellation: "California",
      vintage: "2022",
    },
    expectedFields: {
      brand_name: "KENDALL-JACKSON",
      class_type: "Chardonnay",
      alcohol_content: "Alcohol 13.5% by Volume",
      net_contents: "750 mL",
      appellation: "California",
      vintage_date: "2022",
      varietal: "Chardonnay",
    },
  },

  // 31. Silver Oak Cabernet Sauvignon — Alexander Valley
  {
    key: "silver-oak-cabernet-front",
    displayName: "Silver Oak Cabernet Sauvignon 2019 (Front)",
    colaSource: {
      ttbId: "24056001000234",
      brand: "SILVER OAK",
      fancifulName: "CABERNET SAUVIGNON",
      classCode: "82",
      classType: "TABLE WINE",
      originCode: "01",
      origin: "CALIFORNIA",
      permit: "BW-CA-SO-1",
      approved: "02/25/2024",
    },
    generation: {
      labelType: "front",
      category: "wine",
      brandName: "SILVER OAK",
      classType: "Cabernet Sauvignon",
      alcoholContent: "Alcohol 14.2% by Volume",
      netContents: "750 mL",
      appellation: "Alexander Valley",
      vintage: "2019",
    },
    expectedFields: {
      brand_name: "SILVER OAK",
      class_type: "Cabernet Sauvignon",
      alcohol_content: "Alcohol 14.2% by Volume",
      net_contents: "750 mL",
      appellation: "Alexander Valley",
      vintage_date: "2019",
      varietal: "Cabernet Sauvignon",
    },
  },

  // 32. Santa Margherita Pinot Grigio — imported Italy
  {
    key: "santa-margherita-pinot-grigio-front",
    displayName: "Santa Margherita Pinot Grigio 2022 (Front)",
    colaSource: {
      ttbId: "24078001000678",
      brand: "SANTA MARGHERITA",
      fancifulName: "PINOT GRIGIO",
      classCode: "82",
      classType: "TABLE WINE",
      originCode: "00",
      origin: "ITALY",
      permit: "IM-IT-SM-1",
      approved: "03/19/2024",
    },
    generation: {
      labelType: "front",
      category: "wine",
      brandName: "SANTA MARGHERITA",
      classType: "Pinot Grigio",
      alcoholContent: "Alcohol 12.5% by Volume",
      netContents: "750 mL",
      appellation: "Alto Adige",
      vintage: "2022",
      countryOfOrigin: "Italy",
    },
    expectedFields: {
      brand_name: "SANTA MARGHERITA",
      class_type: "Pinot Grigio",
      alcohol_content: "Alcohol 12.5% by Volume",
      net_contents: "750 mL",
      appellation: "Alto Adige",
      vintage_date: "2022",
      varietal: "Pinot Grigio",
      country_origin: "Italy",
    },
  },

  // 33. Cloudy Bay Sauvignon Blanc — imported New Zealand
  {
    key: "cloudy-bay-sauv-blanc-front",
    displayName: "Cloudy Bay Sauvignon Blanc 2023 (Front)",
    colaSource: {
      ttbId: "24067001000567",
      brand: "CLOUDY BAY",
      fancifulName: "SAUVIGNON BLANC",
      classCode: "82",
      classType: "TABLE WINE",
      originCode: "00",
      origin: "NEW ZEALAND",
      permit: "IM-NZ-CB-1",
      approved: "03/08/2024",
    },
    generation: {
      labelType: "front",
      category: "wine",
      brandName: "CLOUDY BAY",
      classType: "Sauvignon Blanc",
      alcoholContent: "Alcohol 13.5% by Volume",
      netContents: "750 mL",
      appellation: "Marlborough",
      vintage: "2023",
      countryOfOrigin: "New Zealand",
    },
    expectedFields: {
      brand_name: "CLOUDY BAY",
      class_type: "Sauvignon Blanc",
      alcohol_content: "Alcohol 13.5% by Volume",
      net_contents: "750 mL",
      appellation: "Marlborough",
      vintage_date: "2023",
      varietal: "Sauvignon Blanc",
      country_origin: "New Zealand",
    },
  },

  // 34. Antinori Tignanello — imported Italian Super Tuscan
  {
    key: "antinori-tignanello-front",
    displayName: "Antinori Tignanello 2020 (Front)",
    colaSource: {
      ttbId: "24089001000789",
      brand: "ANTINORI",
      fancifulName: "TIGNANELLO",
      classCode: "82",
      classType: "TABLE WINE",
      originCode: "00",
      origin: "ITALY",
      permit: "IM-IT-ANT-1",
      approved: "03/30/2024",
    },
    generation: {
      labelType: "front",
      category: "wine",
      brandName: "ANTINORI",
      classType: "Red Wine",
      alcoholContent: "Alcohol 14.0% by Volume",
      netContents: "750 mL",
      appellation: "Toscana IGT",
      vintage: "2020",
      countryOfOrigin: "Italy",
    },
    expectedFields: {
      brand_name: "ANTINORI",
      class_type: "Red Wine",
      alcohol_content: "Alcohol 14.0% by Volume",
      net_contents: "750 mL",
      appellation: "Toscana IGT",
      vintage_date: "2020",
      country_origin: "Italy",
    },
  },
];

const EXPANDED_SPIRITS: SampleLabel[] = [
  // 35. Buffalo Trace Bourbon
  {
    key: "buffalo-trace-front",
    displayName: "Buffalo Trace Bourbon (Front)",
    colaSource: {
      ttbId: "24078001000345",
      brand: "BUFFALO TRACE",
      fancifulName: "",
      classCode: "140",
      classType: "WHISKY",
      originCode: "18",
      origin: "KENTUCKY",
      permit: "DSP-KY-BT-1",
      approved: "03/19/2024",
    },
    generation: {
      labelType: "front",
      category: "spirits",
      brandName: "BUFFALO TRACE",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
    },
    expectedFields: {
      brand_name: "BUFFALO TRACE",
      class_type: "Kentucky Straight Bourbon Whiskey",
      alcohol_content: "45% Alc./Vol. (90 Proof)",
      net_contents: "750 mL",
    },
  },

  // 36. Wild Turkey 101
  {
    key: "wild-turkey-101-front",
    displayName: "Wild Turkey 101 Bourbon (Front)",
    colaSource: {
      ttbId: "24089001000456",
      brand: "WILD TURKEY",
      fancifulName: "101",
      classCode: "140",
      classType: "WHISKY",
      originCode: "18",
      origin: "KENTUCKY",
      permit: "DSP-KY-WT-1",
      approved: "03/30/2024",
    },
    generation: {
      labelType: "front",
      category: "spirits",
      brandName: "WILD TURKEY",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "50.5% Alc./Vol. (101 Proof)",
      netContents: "750 mL",
    },
    expectedFields: {
      brand_name: "WILD TURKEY",
      class_type: "Kentucky Straight Bourbon Whiskey",
      alcohol_content: "50.5% Alc./Vol. (101 Proof)",
      net_contents: "750 mL",
    },
  },

  // 37. Hendrick's Gin — imported Scotland
  {
    key: "hendricks-gin-front",
    displayName: "Hendrick's Gin (Front)",
    colaSource: {
      ttbId: "24067001000789",
      brand: "HENDRICK'S",
      fancifulName: "GIN",
      classCode: "321",
      classType: "GIN",
      originCode: "00",
      origin: "SCOTLAND",
      permit: "IM-UK-HEN-1",
      approved: "03/08/2024",
    },
    generation: {
      labelType: "front",
      category: "spirits",
      brandName: "HENDRICK'S",
      classType: "Gin",
      alcoholContent: "44% Alc./Vol. (88 Proof)",
      netContents: "750 mL",
      countryOfOrigin: "United Kingdom",
    },
    expectedFields: {
      brand_name: "HENDRICK'S",
      class_type: "Gin",
      alcohol_content: "44% Alc./Vol. (88 Proof)",
      net_contents: "750 mL",
      country_origin: "United Kingdom",
    },
  },

  // 38. Bacardi Superior White Rum
  {
    key: "bacardi-superior-front",
    displayName: "Bacardi Superior White Rum (Front)",
    colaSource: {
      ttbId: "24091001000234",
      brand: "BACARDI",
      fancifulName: "SUPERIOR WHITE RUM",
      classCode: "331",
      classType: "RUM",
      originCode: "00",
      origin: "PUERTO RICO",
      permit: "DSP-PR-BAC-1",
      approved: "04/01/2024",
    },
    generation: {
      labelType: "front",
      category: "spirits",
      brandName: "BACARDI",
      classType: "Rum",
      alcoholContent: "40% Alc./Vol. (80 Proof)",
      netContents: "750 mL",
    },
    expectedFields: {
      brand_name: "BACARDI",
      class_type: "Rum",
      alcohol_content: "40% Alc./Vol. (80 Proof)",
      net_contents: "750 mL",
    },
  },

  // 39. Don Julio Blanco Tequila — imported Mexico
  {
    key: "don-julio-blanco-front",
    displayName: "Don Julio Blanco Tequila (Front)",
    colaSource: {
      ttbId: "24023001000891",
      brand: "DON JULIO",
      fancifulName: "BLANCO TEQUILA",
      classCode: "160",
      classType: "TEQUILA",
      originCode: "00",
      origin: "MEXICO",
      permit: "IM-MX-DJ-1",
      approved: "01/23/2024",
    },
    generation: {
      labelType: "front",
      category: "spirits",
      brandName: "DON JULIO",
      classType: "Tequila Blanco",
      alcoholContent: "40% Alc./Vol. (80 Proof)",
      netContents: "750 mL",
      countryOfOrigin: "Mexico",
    },
    expectedFields: {
      brand_name: "DON JULIO",
      class_type: "Tequila Blanco",
      alcohol_content: "40% Alc./Vol. (80 Proof)",
      net_contents: "750 mL",
      country_origin: "Mexico",
    },
  },

  // 40. Johnnie Walker Black Label — imported Scotland
  {
    key: "johnnie-walker-black-front",
    displayName: "Johnnie Walker Black Label (Front)",
    colaSource: {
      ttbId: "24056001000345",
      brand: "JOHNNIE WALKER",
      fancifulName: "BLACK LABEL",
      classCode: "381",
      classType: "SCOTCH WHISKY — BLENDED",
      originCode: "00",
      origin: "SCOTLAND",
      permit: "IM-UK-JW-1",
      approved: "02/25/2024",
    },
    generation: {
      labelType: "front",
      category: "spirits",
      brandName: "JOHNNIE WALKER",
      classType: "Blended Scotch Whisky",
      alcoholContent: "40% Alc./Vol. (80 Proof)",
      netContents: "750 mL",
      countryOfOrigin: "United Kingdom",
    },
    expectedFields: {
      brand_name: "JOHNNIE WALKER",
      class_type: "Blended Scotch Whisky",
      alcohol_content: "40% Alc./Vol. (80 Proof)",
      net_contents: "750 mL",
      country_origin: "United Kingdom",
      age_statement: "12 Years Old",
    },
  },

  // 41. The Macallan 12 Year Sherry Oak — imported Scotland
  {
    key: "macallan-12-sherry-front",
    displayName: "The Macallan 12 Year Sherry Oak (Front)",
    colaSource: {
      ttbId: "24067001000456",
      brand: "THE MACALLAN",
      fancifulName: "12 YEAR SHERRY OAK",
      classCode: "382",
      classType: "SCOTCH WHISKY — SINGLE MALT",
      originCode: "00",
      origin: "SCOTLAND",
      permit: "IM-UK-MAC-1",
      approved: "03/08/2024",
    },
    generation: {
      labelType: "front",
      category: "spirits",
      brandName: "THE MACALLAN",
      classType: "Single Malt Scotch Whisky",
      alcoholContent: "43% Alc./Vol. (86 Proof)",
      netContents: "750 mL",
      countryOfOrigin: "United Kingdom",
    },
    expectedFields: {
      brand_name: "THE MACALLAN",
      class_type: "Single Malt Scotch Whisky",
      alcohol_content: "43% Alc./Vol. (86 Proof)",
      net_contents: "750 mL",
      country_origin: "United Kingdom",
      age_statement: "12 Years Old",
    },
  },

  // 42. Jameson Irish Whiskey — imported Ireland
  {
    key: "jameson-irish-whiskey-front",
    displayName: "Jameson Irish Whiskey (Front)",
    colaSource: {
      ttbId: "24089001000678",
      brand: "JAMESON",
      fancifulName: "IRISH WHISKEY",
      classCode: "391",
      classType: "IRISH WHISKEY",
      originCode: "00",
      origin: "IRELAND",
      permit: "IM-IR-JAM-1",
      approved: "03/30/2024",
    },
    generation: {
      labelType: "front",
      category: "spirits",
      brandName: "JAMESON",
      classType: "Irish Whiskey",
      alcoholContent: "40% Alc./Vol. (80 Proof)",
      netContents: "750 mL",
      countryOfOrigin: "Ireland",
    },
    expectedFields: {
      brand_name: "JAMESON",
      class_type: "Irish Whiskey",
      alcohol_content: "40% Alc./Vol. (80 Proof)",
      net_contents: "750 mL",
      country_origin: "Ireland",
    },
  },
];

// ---------------------------------------------------------------------------
// Combined exports
// ---------------------------------------------------------------------------

export const SAMPLE_LABELS: SampleLabel[] = [
  ...BEER_SAMPLES,
  ...WINE_SAMPLES,
  ...SPIRITS_SAMPLES,
  ...ADDITIONAL_BEER,
  ...ADDITIONAL_WINE,
  ...ADDITIONAL_SPIRITS,
  ...EXPANDED_BEER,
  ...EXPANDED_WINE,
  ...EXPANDED_SPIRITS,
];

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
  "BELL'S": "Bell's Brewery, Inc., Comstock, MI 49053",
  "FOUNDERS": "Founders Brewing Co., Grand Rapids, MI 49503",
  "YUENGLING": "D.G. Yuengling & Son, Inc., Pottsville, PA 17901",
  "NEW BELGIUM": "New Belgium Brewing Company, Fort Collins, CO 80524",
  "CAYMUS VINEYARDS": "Caymus Vineyards, Rutherford, CA 94573",
  "JOSH CELLARS": "Deutsch Family Wine & Spirits, Stamford, CT 06901",
  "WHISPERING ANGEL": "Sacha Lichine, Château d'Esclans, 83920 La Motte, France",
  "WOODFORD RESERVE": "Brown-Forman Corporation, Louisville, KY 40210",
  "CASAMIGOS": "Diageo North America, Norwalk, CT 06851",
  "GREY GOOSE": "Bacardi Limited, Hamilton, Bermuda",
  "SAMUEL ADAMS": "The Boston Beer Company, Boston, MA 02129",
  "GUINNESS": "Imported by Diageo North America, Norwalk, CT 06851",
  "MODELO": "Imported by Crown Imports LLC, Chicago, IL 60661",
  "DESCHUTES": "Deschutes Brewery, Bend, OR 97701",
  "ATHLETIC BREWING": "Athletic Brewing Company, Stratford, CT 06615",
  "KENDALL-JACKSON": "Kendall-Jackson Wine Estates, Sonoma County, CA 95448",
  "SILVER OAK": "Silver Oak Cellars, Oakville, CA 94562",
  "SANTA MARGHERITA": "Imported by Santa Margherita USA, Miami, FL 33131",
  "CLOUDY BAY": "Imported by Moet Hennessy USA, Inc., New York, NY 10153",
  "ANTINORI": "Imported by Ste. Michelle Wine Estates, Woodinville, WA 98072",
  "BUFFALO TRACE": "Buffalo Trace Distillery, Frankfort, KY 40601",
  "WILD TURKEY": "Austin Nichols Distilling Co., Lawrenceburg, KY 40342",
  "HENDRICK'S": "Imported by William Grant & Sons, Inc., New York, NY 10019",
  "BACARDI": "Bacardi Corporation, Cataño, Puerto Rico 00962",
  "DON JULIO": "Imported by Diageo North America, Norwalk, CT 06851",
  "JOHNNIE WALKER": "Imported by Diageo North America, Norwalk, CT 06851",
  "THE MACALLAN": "Imported by The Edrington Group USA, New York, NY 10022",
  "JAMESON": "Imported by Pernod Ricard USA, New York, NY 10153",
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
