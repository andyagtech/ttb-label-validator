# Simulated vs Real Data & Systems

This document clarifies what parts of the TTB COLA Label Validator are simulated/mock data versus what uses real TTB data, and outlines future development priorities.

---

## What is Simulated

### 1. Review Stages & Workflow
- **Status progression**: `submitted → in_review → approved/rejected/needs_revision`
- **Agent assignment**: Mock agent objects with realistic names and review patterns
- **Decision timestamps**: Simulated review times (hours to days)
- **Findings**: Generated mock discrepancy reports when agents flag fields

### 2. Agent Objects & Behavior
```typescript
// Mock agents with realistic review patterns
const agents = [
  { id: "agent-001", name: "Sarah Chen", specialization: "wine" },
  { id: "agent-002", name: "Marcus Rodriguez", specialization: "spirits" },
  // ...
];
```
- **Review patterns**: Some agents are stricter, others faster
- **Specialization**: Wine/spirits/beer expertise affects which submissions they review
- **Decision consistency**: Same agent makes similar decisions on similar issues

### 3. Submission Form Validation (Current)
- **Basic client-side validation**: Required fields, format checks
- **Category-aware rules**: Different mandatory fields per beverage type
- **OCR confidence warnings**: Remind agents about approximate text detection

### 4. Error Injection in Submissions
- **Realistic OCR errors**: Common misreadings (V→N, I→l, etc.)
- **Missing fields**: Some submissions deliberately lack required fields
- **Format variations**: Different ABV formats, volume units, country naming
- **Cross-field issues**: Varietal/vintage mismatches, age statements without dates

### 5. Review Queue Load Balancing
- **Automatic assignment**: Submissions distributed across available agents
- **Workload simulation**: Some agents have heavier caseloads
- **Priority handling**: "Urgent" submissions get faster assignment

---

## What is Real

### 1. TTB COLA Form Data
- **Source**: Real TTB COLA Online submissions scraped via Playwright
- **Fields**: Brand Name, Fanciful Name, Class/Type, Origin, Varietal, Appellation
- **Coverage**: 114 real products with 229 label images
- **File**: `sample_labels/enriched_cola_fields.json`

### 2. Label Images
- **Source**: Downloaded directly from TTB COLA detail pages
- **Storage**: Served from Vercel Blob CDN (not git)
- **Processing**: AI-cropped using Gemini 2.0 Flash + SAM-HQ
- **Examples**: `https://rcptligvu3vbkguv.public.blob.vercel-storage.com/ttb-labels/24003001000414-1.png`

### 3. OCR Text Extraction
- **Engine**: Tesseract.js (browser) + Claude 3.5 Sonnet (server)
- **Real parsing**: Extracts actual text from real label images
- **Performance**: Benchmarked across 162 images (see `docs/OCR_PERFORMANCE.md`)

### 4. Vision-Extracted ABV & Volume
- **Source**: Gemini 2.0 Flash vision analysis of label images
- **Coverage**: 114/114 products successfully extracted
- **Integration**: Used as SUBMITTED values instead of hardcoded defaults
- **Example**: Cimino shows "ALC. 13% BY VOL." | "1.5L" (actual label values)

### 5. Regulatory Citations
- **Source**: Real 27 CFR sections with live eCFR links
- **Accuracy**: Current CFR requirements per beverage category
- **Examples**: §4.32(e) sulfite declaration, §5.37 spirits ABV requirements

### 6. Fuzzy Matching Logic
- **Real-world patterns**: Handles OCR noise, spacing, punctuation variations
- **Levenshtein distance**: Token overlap, containment, case-insensitive matching
- **Production-tested**: Validated on 114 real TTB submissions

---

## Future Development Roadmap

### Immediate Priorities (Next Sprint)

#### 1. Enhanced Form Validation
```typescript
// Current: Basic required field checks
// Future: Real-time validation with TTB business rules
- ABV range validation per category (beer ≤ 12% unless qualified)
- Net contents compliance (standard sizes only)
- Brand name uniqueness checks against existing COLAs
- Class/type code validation against TTB reference tables
```

#### 2. Automated Error Detection
```typescript
// Auto-flag common submission issues before agent review
- Missing mandatory fields by category
- Format violations (ABV %, volume units)
- Inconsistent cross-field data (vintage without varietal)
- Potential trademark conflicts
```

#### 3. Agent Performance Analytics
```typescript
// Track and visualize agent efficiency
- Review time distribution by agent
- Error rates and reversal rates
- Specialization performance metrics
- Workload balancing recommendations
```

### Medium-term Goals (Next Quarter)

#### 4. Real TTB API Integration
- **Replace scraping**: Direct TTB COLA API for form data
- **Live status updates**: Real-time COLA approval status
- **Automatic refresh**: Keep submission data current
- **Rate limiting**: Respect TTB API quotas

#### 5. Advanced OCR Pipeline
```typescript
// Multi-model confidence scoring
- Ensemble: Tesseract + Claude + Gemini vision
- Confidence-weighted field extraction
- Automatic re-OCR for low-confidence fields
- Human-in-the-loop correction interface
```

#### 6. Compliance Rule Engine
```typescript
// Configurable regulatory rules
- CFR-based validation rules (JSON schema)
- State-specific requirements overlay
- Historical precedent database
- Automated citation generation
```

### Long-term Vision (6+ Months)

#### 7. Production Submission System
- **Real COLA submissions**: Connect to TTB production
- **Document upload**: Support for PDF/label file submissions
- **Payment integration**: TTB fee processing
- **Certificate generation**: Automatic COLA certificate creation

#### 8. Machine Learning Enhancement
```typescript
// Train models on TTB historical data
- Predict approval likelihood
- Identify high-risk submissions
- Suggest field corrections
- Agent decision assistance
```

#### 9. Multi-Agency Support
- **TTB + FDA**: Cross-agency compliance (health claims, ingredients)
- **State ABC**: State-specific requirements
- **International**: Export label compliance
- **Industry standards**: Wine Institute, Brewers Association guidelines

---

## Technical Debt & Improvements

### Current Limitations
1. **Mock agent logic**: Simple random assignment, no real expertise modeling
2. **Static decision patterns**: No learning from historical decisions
3. **Limited error simulation**: Fixed error patterns, not dynamic
4. **No persistence**: Mock data resets on restart

### Recommended Fixes
1. **Agent expertise modeling**: Weight assignments by historical accuracy
2. **Decision persistence**: Store mock review patterns for consistency
3. **Dynamic error generation**: Context-aware error injection
4. **Database backend**: Replace in-memory store with PostgreSQL

---

## Data Sources & Attribution

| Source | Type | Coverage | Update Frequency |
|--------|------|----------|------------------|
| TTB COLA Online | Real form data | 114 products | Manual pipeline runs |
| Vercel Blob CDN | Real label images | 229 files | Pipeline uploads |
| Gemini 2.0 Flash | Vision extraction | 114/114 ABV/volume | One-time batch |
| Tesseract.js | OCR engine | All labels | Runtime |
| Claude 3.5 Sonnet | OCR fallback | Server-side | API calls |
| 27 CFR eCFR | Regulations | Current | Live links |

---

## Security & Privacy Considerations

### Real Data Handling
- **PII scrubbing**: No personal information in mock submissions
- **API keys**: Environment variables only, never committed
- **Rate limiting**: Respect TTB and third-party API limits
- **Data retention**: Local copies for pipeline, CDN for serving

### Mock Data Realism
- **No real agent data**: All agent objects are fictional
- **Synthetic errors**: Based on patterns, not actual mistakes
- **Brand names**: Real TTB brands, but fictional submission details
- **Review decisions**: Simulated, not actual TTB determinations
