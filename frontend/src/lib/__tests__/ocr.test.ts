import { describe, it, expect } from "vitest";
import { parseOcrText } from "../ocr";

// ---------------------------------------------------------------------------
// Alcohol Content Parsing
// ---------------------------------------------------------------------------

describe("parseOcrText — alcohol content", () => {
  it('extracts "Alcohol 14% by volume"', () => {
    const fields = parseOcrText("Some Brand\nAlcohol 14% by volume\n750 mL");
    expect(fields.alcoholContent).toMatch(/14%/);
  });

  it('extracts "13.5% Alc. By Vol."', () => {
    const fields = parseOcrText("Label Text\n13.5% Alc. By Vol.\nMore text");
    expect(fields.alcoholContent).toMatch(/13\.5%/);
  });

  it('extracts "45% Alc./Vol." — sample label format', () => {
    const fields = parseOcrText("OLD TOM DISTILLERY\n45% Alc./Vol. (90 Proof)\n750 mL");
    expect(fields.alcoholContent).toMatch(/45%/);
    expect(fields.alcoholContent).toMatch(/Alc\.\/Vol\./i);
  });

  it('extracts "5% ALC./VOL."', () => {
    const fields = parseOcrText("SOME BEER\n5% ALC./VOL.\n12 FL OZ");
    expect(fields.alcoholContent).toMatch(/5%/);
  });

  it('extracts "ALC. 5.5% BY VOL."', () => {
    const fields = parseOcrText("CRAFT BREW\nALC. 5.5% BY VOL.\n12 FL OZ");
    expect(fields.alcoholContent).toMatch(/5\.5%/);
  });

  it('extracts "5% ALC/VOL"', () => {
    const fields = parseOcrText("BRAND\n5% ALC/VOL\n355 mL");
    expect(fields.alcoholContent).toMatch(/5%/);
  });

  it("returns undefined when no ABV present", () => {
    const fields = parseOcrText("Just a brand name and nothing else");
    expect(fields.alcoholContent).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Net Contents Parsing
// ---------------------------------------------------------------------------

describe("parseOcrText — net contents", () => {
  it('extracts "750 mL"', () => {
    const fields = parseOcrText("Brand Name\n750 mL\nMore text");
    expect(fields.netContents).toBe("750 mL");
  });

  it('extracts "12 FL OZ"', () => {
    const fields = parseOcrText("Brand\n12 FL OZ\nText");
    expect(fields.netContents).toMatch(/12 FL/i);
  });

  it('extracts "1.75 L"', () => {
    const fields = parseOcrText("Brand\n1.75 L\nText");
    expect(fields.netContents).toMatch(/1\.75/);
  });

  it('extracts compound "1 PINT, 8.9 FL. OZ."', () => {
    const fields = parseOcrText("Brand\n1 PINT, 8.9 FL. OZ.\nText");
    expect(fields.netContents).toMatch(/1 PINT/i);
    expect(fields.netContents).toMatch(/FL/i);
  });

  it('extracts "1 PINT 9.4 FL OZ"', () => {
    const fields = parseOcrText("Brand\n1 PINT 9.4 FL OZ\nText");
    expect(fields.netContents).toMatch(/PINT/i);
    expect(fields.netContents).toMatch(/FL OZ/i);
  });

  it("returns undefined when no net contents", () => {
    const fields = parseOcrText("Just a brand with no volume");
    expect(fields.netContents).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Government Warning Parsing
// ---------------------------------------------------------------------------

describe("parseOcrText — government warning", () => {
  it("detects government warning text", () => {
    const fields = parseOcrText("GOVERNMENT WARNING: (1) According to the Surgeon General...");
    expect(fields.healthWarning).toBeDefined();
    expect(fields.healthWarning).toMatch(/GOVERNMENT WARNING/);
  });

  it("detects case-insensitive government warning", () => {
    const fields = parseOcrText("government warning: some text here");
    expect(fields.healthWarning).toBeDefined();
  });

  it("returns undefined when no warning present", () => {
    const fields = parseOcrText("Just a label with no warning");
    expect(fields.healthWarning).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Sulfite Declaration
// ---------------------------------------------------------------------------

describe("parseOcrText — sulfite declaration", () => {
  it('detects "Contains Sulfites"', () => {
    const fields = parseOcrText("Some wine label\nContains Sulfites\nMore text");
    expect(fields.sulfiteDeclaration).toBe("Contains Sulfites");
  });

  it('detects "CONTAINS SULFITES"', () => {
    const fields = parseOcrText("CONTAINS SULFITES");
    expect(fields.sulfiteDeclaration).toBe("Contains Sulfites");
  });

  it("returns undefined when no sulfite declaration", () => {
    const fields = parseOcrText("No sulfite info here");
    expect(fields.sulfiteDeclaration).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Brand Name Heuristic
// ---------------------------------------------------------------------------

describe("parseOcrText — brand name", () => {
  it("detects brand with brewery/distillery/winery suffix", () => {
    const fields = parseOcrText("Old Tom Distillery\nKentucky Straight Bourbon");
    expect(fields.brandName).toMatch(/Old Tom Distillery/i);
  });

  it("detects all-caps brand name in first lines", () => {
    const fields = parseOcrText("STONE'S THROW\nPale Ale\n12 FL OZ");
    expect(fields.brandName).toBe("STONE'S THROW");
  });
});

// ---------------------------------------------------------------------------
// Class / Type Designation
// ---------------------------------------------------------------------------

describe("parseOcrText — class/type", () => {
  it("detects pale ale", () => {
    const fields = parseOcrText("Brand\nPale Ale\n12 FL OZ");
    expect(fields.classType).toMatch(/pale ale/i);
  });

  it("detects cabernet sauvignon", () => {
    const fields = parseOcrText("Brand\nCabernet Sauvignon\n750 mL");
    expect(fields.classType).toMatch(/cabernet sauvignon/i);
  });

  it("detects bourbon", () => {
    const fields = parseOcrText("Brand\nBourbon Whiskey\n750 mL");
    expect(fields.classType).toMatch(/bourbon/i);
  });
});

// ---------------------------------------------------------------------------
// Country of Origin
// ---------------------------------------------------------------------------

describe("parseOcrText — country of origin", () => {
  it('detects "Product of France"', () => {
    const fields = parseOcrText("Brand\nProduct of France\n750 mL");
    expect(fields.countryOfOrigin).toMatch(/Product of France/i);
  });

  it('detects "Imported from Italy"', () => {
    const fields = parseOcrText("Brand\nImported from Italy\n750 mL");
    expect(fields.countryOfOrigin).toMatch(/Italy/i);
  });
});

// ---------------------------------------------------------------------------
// Vintage Date
// ---------------------------------------------------------------------------

describe("parseOcrText — vintage date", () => {
  it("detects 4-digit year", () => {
    const fields = parseOcrText("Brand\n2019 Cabernet Sauvignon\n750 mL");
    expect(fields.vintageDate).toBe("2019");
  });

  it("ignores implausible years", () => {
    const fields = parseOcrText("Brand\n1899 Label Text");
    expect(fields.vintageDate).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Name & Address
// ---------------------------------------------------------------------------

describe("parseOcrText — name & address", () => {
  it("detects City, STATE ZIP pattern", () => {
    const fields = parseOcrText("Bottled by Acme Corp, Louisville, KY 40202");
    expect(fields.nameAddress).toBeDefined();
    expect(fields.nameAddress).toMatch(/Louisville/);
    expect(fields.nameAddress).toMatch(/KY/);
  });

  it("detects City, ST pattern without zip", () => {
    const fields = parseOcrText("Produced by Winery Inc, Napa, CA");
    expect(fields.nameAddress).toBeDefined();
    expect(fields.nameAddress).toMatch(/Napa, CA/);
  });
});

// ---------------------------------------------------------------------------
// rawText always present
// ---------------------------------------------------------------------------

describe("parseOcrText — rawText", () => {
  it("always includes rawText in output", () => {
    const input = "Some raw OCR text here";
    const fields = parseOcrText(input);
    expect(fields.rawText).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// Full sample label integration
// ---------------------------------------------------------------------------

describe("parseOcrText — full sample label", () => {
  it("extracts multiple fields from a complete label", () => {
    const text = [
      "OLD TOM DISTILLERY",
      "Kentucky Straight Bourbon Whiskey",
      "45% Alc./Vol. (90 Proof)",
      "750 mL",
      "Distilled and Bottled by Old Tom Distillery, Louisville, KY 40202",
      "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.",
    ].join("\n");

    const fields = parseOcrText(text);

    expect(fields.brandName).toMatch(/Old Tom Distillery/i);
    expect(fields.alcoholContent).toMatch(/45%/);
    expect(fields.netContents).toMatch(/750/);
    expect(fields.healthWarning).toMatch(/GOVERNMENT WARNING/);
    expect(fields.nameAddress).toMatch(/Louisville/);
    expect(fields.classType).toMatch(/bourbon/i);
  });
});
