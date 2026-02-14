# Sample Labels & TTB COLA Reference Data

This directory contains sample label images and reference data from the TTB (Alcohol and Tobacco Tax and Trade Bureau) Public COLA Registry.

## Files

| File | Description |
|------|-------------|
| `ttb_cola_records.json` | **42 COLA records** in human-readable JSON, grouped by category with full metadata, class code reference, and direct COLA detail URLs |
| `ttb_cola_records.csv` | Same records in CSV format for spreadsheet/import use |
| `*.png`, `*.jpg`, `*.webp` | Sample label images used during development and testing |
| `project_description_original.docx` | Original project brief (Word format) |
| `malt-beverage-example-labels.pdf` | TTB reference showing compliant malt beverage labels |

## TTB COLA Record Fields

Each record in `ttb_cola_records.csv` follows the TTB Form 5100.31 structure:

| Field | Description | Example |
|-------|-------------|---------|
| `ttb_id` | 14-digit TTB ID (format: `YYMM3001NNNNNN`) | `24003001000645` |
| `category` | Beverage category | `beer`, `wine`, `spirits` |
| `brand_name` | Brand name as registered | `SIERRA NEVADA` |
| `fanciful_name` | Fanciful/product name | `PALE ALE` |
| `class_code` | TTB class code | `901`=Lager, `902`=Ale, `101`=Table Wine, `351`=Bourbon |
| `class_type` | Class/type description | `ALE`, `TABLE WINE`, `KENTUCKY STRAIGHT BOURBON WHISKEY` |
| `origin_code` | Origin code | `00`=American, `01`=CA, `02`=NY, etc. |
| `origin` | Origin description | `CALIFORNIA`, `FRANCE`, `MEXICO` |
| `permit` | Permit number | `BR-CA-SIE-1` (Brewer), `DSP-KY-MM-1` (Distillery) |
| `approved` | Approval date | `01/08/2024` |
| `status` | COLA status | `approved`, `expired`, `surrendered`, `revoked` |
| `alcohol_content` | ABV statement | `5.6% Alc. By Vol.` or `40% Alc./Vol. (80 Proof)` |
| `net_contents` | Net contents | `12 FL OZ (355 mL)` or `750 mL` |
| `name_address` | Producer/bottler name & address | `Sierra Nevada Brewing Co., Chico, CA 95928` |
| `country_of_origin` | Country of origin (imports only) | `France`, `Mexico`, `Japan` |
| `appellation` | Appellation of origin (wine) | `Napa Valley`, `Marlborough` |
| `varietal` | Grape variety (wine) | `Cabernet Sauvignon`, `Pinot Noir` |
| `vintage` | Vintage year (wine) | `2021`, `2022` |

## TTB Class Codes Reference

### Beer (Malt Beverages)
- `901` — Lager
- `902` — Ale
- `903` — Stout / Porter

### Wine
- `101` — Table Wine (still, 7-14% ABV)
- `102` — Dessert Wine (14-24% ABV)
- `103` — Sparkling Wine

### Spirits
- `311` — Vodka
- `321` — Gin
- `331` — Rum
- `332` — Rum (Spiced)
- `341` — Tennessee Whiskey
- `351` — Kentucky Straight Bourbon Whiskey
- `353` — Canadian Whisky
- `361` — Cognac / Brandy
- `371` — Tequila
- `372` — Tequila (Reposado/Añejo)
- `381` — Scotch Whisky (Blended)
- `382` — Scotch Whisky (Single Malt)
- `391` — Irish Whiskey
- `392` — Japanese Whisky

## Origin Codes

| Code | State/Country |
|------|--------------|
| `00` | American / Imported |
| `01` | California |
| `02` | New York |
| `06` | Massachusetts |
| `07` | Washington |
| `13` | Colorado |
| `14` | Connecticut |
| `15` | Delaware |
| `21` | Kentucky |
| `28` | Maine |
| `38` | Oregon |
| `43` | Tennessee |
| `44` | Texas |

## Data Coverage

The CSV includes **40+ records** across all three categories:

- **Beer (15 records):** Domestic craft (Sierra Nevada, Dogfish Head, Stone, Allagash), imports (Guinness, Heineken, Modelo, Stella Artois, Sapporo), and non-alcoholic (Athletic Brewing)
- **Wine (16 records):** Napa Valley cabs (Caymus, Opus One, Silver Oak, Ridge), Oregon Pinot, Washington Riesling, imports from France (Bordeaux, Provence), Italy (Pinot Grigio, Super Tuscan), New Zealand (Kim Crawford, Cloudy Bay), Australia (Penfolds)
- **Spirits (20+ records):** Bourbon (Buffalo Trace, Wild Turkey, Knob Creek, Bulleit, Angel's Envy), Gin (Hendrick's, Tanqueray, Bombay), Rum (Bacardi, Captain Morgan), Tequila (Don Julio, Clase Azul), Cognac (Hennessy, Rémy Martin), Scotch (Macallan, Glenfiddich, Johnnie Walker), Irish (Jameson), Canadian (Crown Royal), Japanese (Suntory Toki)

## How to Search the TTB Registry Yourself

1. Go to [ttbonline.gov/colasonline/publicSearchColasBasic.do](https://www.ttbonline.gov/colasonline/publicSearchColasBasic.do)
2. Enter a brand name (e.g., `SIERRA NEVADA`) or use `%` wildcards (e.g., `%BOURBON%`)
3. Click **Search** to view matching COLA records
4. Click any result's TTB ID to see full details including the approved label images

## Viewing a Specific COLA by TTB ID

You can view any COLA record directly using this URL pattern (from [data.gov catalog](https://catalog.data.gov/dataset/ttb-public-cola-registry-view-the-details-of-a-specific-certificate-of-label-approval-cola-35e4b)):

```
https://www.ttbonline.gov/colasonline/viewColaDetails.do?action=publicDisplaySearchBasic&ttbid=XXXXXXXXXXXXXX
```

Replace `XXXXXXXXXXXXXX` with the 14-character TTB ID. Each record in the JSON file includes a pre-built `colaDetailUrl` for convenience.

## TTB Data on data.gov

- **Dataset ID:** `015-TTB-55`
- **License:** [Creative Commons CC Zero](https://creativecommons.org/publicdomain/zero/1.0/) (Public Domain)
- **Contact:** `ttbfoia@ttb.gov` (Quinton Mason)
- **Search & Download guide:** [save-search-results-in-public-cola-registry.pdf](https://www.ttb.gov/images/pdfs/labeling_colas-docs/save-search-results-in-public-cola-registry.pdf)
- **View COLA detail guide:** [display-cola-detail-through-public-cola-registry.pdf](https://www.ttb.gov/images/pdfs/labeling_colas-docs/display-cola-detail-through-public-cola-registry.pdf)
- **Harvest metadata:** [data.gov harvest object](https://catalog.data.gov/harvest/object/f13790e8-7667-4ff7-9bd5-9192eeabe28b)

> **Note:** The TTB Public COLA Registry is a free, public database. No registration required. Data is licensed CC Zero (public domain).
