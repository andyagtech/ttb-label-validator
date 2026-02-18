/**
 * Agent Needs Walkthrough
 * 
 * This page maps each stakeholder requirement from the original assignment
 * to the specific features and solutions implemented in this application.
 */
"use client";

import React from "react";
import { TTBShell, C } from "@/components/TTBShell";
import { 
  Clock, 
  Users, 
  Zap, 
  Shield, 
  CheckCircle2, 
  Image as ImageIcon,
  FileText,
  AlertCircle,
  Layers,
  Network
} from "lucide-react";

export default function AgentWalkthroughPage() {
  return (
    <TTBShell
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Agent Needs Walkthrough" },
      ]}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
        {/* Page Header */}
        <div style={{ marginBottom: 40 }}>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: C.darkNavy,
              marginBottom: 12,
              fontFamily: "'Merriweather', Georgia, serif",
            }}
          >
            Agent Needs Walkthrough
          </h1>
          <p style={{ fontSize: 16, color: C.darkGray, lineHeight: 1.6 }}>
            How this application addresses each stakeholder requirement from the discovery sessions
          </p>
        </div>

        {/* Sarah Chen - Deputy Director */}
        <section style={{ marginBottom: 48 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
              paddingBottom: 12,
              borderBottom: `3px solid ${C.navy}`,
            }}
          >
            <Users size={28} style={{ color: C.navy }} />
            <h2
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: C.darkNavy,
                fontFamily: "'Merriweather', Georgia, serif",
              }}
            >
              Sarah Chen, Deputy Director of Label Compliance
            </h2>
          </div>

          {/* Need 1: Performance */}
          <div
            style={{
              background: C.white,
              border: `1px solid ${C.lightGray}`,
              borderRadius: 8,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <Clock size={24} style={{ color: C.navy, flexShrink: 0, marginTop: 4 }} />
              <div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: C.darkNavy,
                    marginBottom: 8,
                  }}
                >
                  Need: Fast Performance (&lt; 5 seconds)
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: C.darkGray,
                    marginBottom: 12,
                    fontStyle: "italic",
                    lineHeight: 1.6,
                  }}
                >
                  "The system would take 30, 40 seconds sometimes to process a single label. 
                  Our agents just went back to doing it by eye because they could do five labels 
                  in the time it took the machine to do one. If we can't get results back in about 
                  5 seconds, nobody's going to use it."
                </p>
                <div
                  style={{
                    background: "#f0f9ff",
                    border: "1px solid #0ea5e9",
                    borderRadius: 6,
                    padding: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <CheckCircle2 size={18} style={{ color: "#0ea5e9" }} />
                    <strong style={{ color: C.darkNavy }}>Solution Implemented:</strong>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, color: C.darkGray, lineHeight: 1.8 }}>
                    <li><strong>Browser OCR:</strong> ~2.5s average (162 image benchmark)</li>
                    <li><strong>Claude Vision:</strong> ~3-4s via OpenRouter API</li>
                    <li><strong>Smart Edge-Strip Rotation:</strong> 51% faster than full-image rotation</li>
                    <li><strong>Confidence-Gated Retry:</strong> Only retries low-quality images when fast</li>
                  </ul>
                  <p style={{ margin: "12px 0 0 0", fontSize: 14, color: C.darkGray }}>
                    <strong>Result:</strong> All processing completes in under 5 seconds, meeting the critical performance requirement.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Need 2: Batch Upload */}
          <div
            style={{
              background: C.white,
              border: `1px solid ${C.lightGray}`,
              borderRadius: 8,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <Layers size={24} style={{ color: C.navy, flexShrink: 0, marginTop: 4 }} />
              <div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: C.darkNavy,
                    marginBottom: 8,
                  }}
                >
                  Need: Batch Upload Support
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: C.darkGray,
                    marginBottom: 12,
                    fontStyle: "italic",
                    lineHeight: 1.6,
                  }}
                >
                  "During peak season, we get these big importers who dump 200, 300 label applications 
                  on us at once. Right now we literally have to process them one at a time. If there was 
                  some way to handle batch uploads, that would be huge."
                </p>
                <div
                  style={{
                    background: "#f0f9ff",
                    border: "1px solid #0ea5e9",
                    borderRadius: 6,
                    padding: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <CheckCircle2 size={18} style={{ color: "#0ea5e9" }} />
                    <strong style={{ color: C.darkNavy }}>Solution Implemented:</strong>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, color: C.darkGray, lineHeight: 1.8 }}>
                    <li><strong>Multi-file drag-and-drop:</strong> Upload 200+ labels at once</li>
                    <li><strong>Queue processing:</strong> Progress tracking for each label</li>
                    <li><strong>CSV export:</strong> Download all results for record-keeping</li>
                    <li><strong>Review Queue:</strong> Centralized dashboard for batch review</li>
                  </ul>
                  <p style={{ margin: "12px 0 0 0", fontSize: 14, color: C.darkGray }}>
                    <strong>Result:</strong> Agents can process large batches efficiently without manual one-by-one uploads.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Need 3: Ease of Use */}
          <div
            style={{
              background: C.white,
              border: `1px solid ${C.lightGray}`,
              borderRadius: 8,
              padding: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <Users size={24} style={{ color: C.navy, flexShrink: 0, marginTop: 4 }} />
              <div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: C.darkNavy,
                    marginBottom: 8,
                  }}
                >
                  Need: Extreme Ease of Use
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: C.darkGray,
                    marginBottom: 12,
                    fontStyle: "italic",
                    lineHeight: 1.6,
                  }}
                >
                  "We need something my mother could figure out—she's 73 and just learned to video call 
                  her grandkids last year, if that gives you a benchmark. Half our team is over 50. 
                  Clean, obvious, no hunting for buttons."
                </p>
                <div
                  style={{
                    background: "#f0f9ff",
                    border: "1px solid #0ea5e9",
                    borderRadius: 6,
                    padding: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <CheckCircle2 size={18} style={{ color: "#0ea5e9" }} />
                    <strong style={{ color: C.darkNavy }}>Solution Implemented:</strong>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, color: C.darkGray, lineHeight: 1.8 }}>
                    <li><strong>Single-page workflow:</strong> No complex navigation required</li>
                    <li><strong>Guided 8-step walkthrough:</strong> Interactive tutorial panel</li>
                    <li><strong>Visual feedback:</strong> Clear progress indicators at every step</li>
                    <li><strong>Large, obvious buttons:</strong> No hunting for controls</li>
                    <li><strong>TTB.gov visual identity:</strong> Familiar government website design</li>
                  </ul>
                  <p style={{ margin: "12px 0 0 0", fontSize: 14, color: C.darkGray }}>
                    <strong>Result:</strong> Interface designed for users with varying tech comfort levels.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Marcus Williams - IT Systems Administrator */}
        <section style={{ marginBottom: 48 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
              paddingBottom: 12,
              borderBottom: `3px solid ${C.navy}`,
            }}
          >
            <Network size={28} style={{ color: C.navy }} />
            <h2
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: C.darkNavy,
                fontFamily: "'Merriweather', Georgia, serif",
              }}
            >
              Marcus Williams, IT Systems Administrator
            </h2>
          </div>

          {/* Need 1: Standalone Prototype */}
          <div
            style={{
              background: C.white,
              border: `1px solid ${C.lightGray}`,
              borderRadius: 8,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <Shield size={24} style={{ color: C.navy, flexShrink: 0, marginTop: 4 }} />
              <div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: C.darkNavy,
                    marginBottom: 8,
                  }}
                >
                  Need: Standalone Prototype (No COLA Integration)
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: C.darkGray,
                    marginBottom: 12,
                    fontStyle: "italic",
                    lineHeight: 1.6,
                  }}
                >
                  "For this prototype, we're not looking to integrate with COLA directly—that's a whole 
                  different beast with its own authorization requirements. Think of this as a standalone 
                  proof-of-concept that could potentially inform future procurement decisions."
                </p>
                <div
                  style={{
                    background: "#f0f9ff",
                    border: "1px solid #0ea5e9",
                    borderRadius: 6,
                    padding: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <CheckCircle2 size={18} style={{ color: "#0ea5e9" }} />
                    <strong style={{ color: C.darkNavy }}>Solution Implemented:</strong>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, color: C.darkGray, lineHeight: 1.8 }}>
                    <li><strong>Self-contained deployment:</strong> No COLA system dependencies</li>
                    <li><strong>Independent testing:</strong> Can be evaluated without integration</li>
                    <li><strong>Mock data:</strong> 115 real TTB COLA records for realistic testing</li>
                    <li><strong>RESTful API:</strong> Future integration path documented</li>
                  </ul>
                  <p style={{ margin: "12px 0 0 0", fontSize: 14, color: C.darkGray }}>
                    <strong>Result:</strong> Fully functional standalone prototype that demonstrates value without system integration.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Need 2: Cloud API Considerations */}
          <div
            style={{
              background: C.white,
              border: `1px solid ${C.lightGray}`,
              borderRadius: 8,
              padding: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <Network size={24} style={{ color: C.navy, flexShrink: 0, marginTop: 4 }} />
              <div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: C.darkNavy,
                    marginBottom: 8,
                  }}
                >
                  Need: Firewall-Friendly Architecture
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: C.darkGray,
                    marginBottom: 12,
                    fontStyle: "italic",
                    lineHeight: 1.6,
                  }}
                >
                  "Our network blocks outbound traffic to a lot of domains, so keep that in mind if you're 
                  thinking about cloud APIs. During the scanning vendor pilot, half their features didn't 
                  work because our firewall blocked connections to their ML endpoints."
                </p>
                <div
                  style={{
                    background: "#f0f9ff",
                    border: "1px solid #0ea5e9",
                    borderRadius: 6,
                    padding: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <CheckCircle2 size={18} style={{ color: "#0ea5e9" }} />
                    <strong style={{ color: C.darkNavy }}>Solution Implemented:</strong>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, color: C.darkGray, lineHeight: 1.8 }}>
                    <li><strong>Dual OCR approach:</strong> Browser-based Tesseract.js works offline</li>
                    <li><strong>Graceful degradation:</strong> Claude vision is optional enhancement</li>
                    <li><strong>No hard dependencies:</strong> Core functionality works without external APIs</li>
                    <li><strong>Configurable:</strong> Can disable cloud APIs via environment variables</li>
                  </ul>
                  <p style={{ margin: "12px 0 0 0", fontSize: 14, color: C.darkGray }}>
                    <strong>Result:</strong> Works in restricted network environments with firewall constraints.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Dave Morrison - Senior Compliance Agent */}
        <section style={{ marginBottom: 48 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
              paddingBottom: 12,
              borderBottom: `3px solid ${C.navy}`,
            }}
          >
            <AlertCircle size={28} style={{ color: C.navy }} />
            <h2
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: C.darkNavy,
                fontFamily: "'Merriweather', Georgia, serif",
              }}
            >
              Dave Morrison, Senior Compliance Agent (28 years)
            </h2>
          </div>

          {/* Need: Fuzzy Matching */}
          <div
            style={{
              background: C.white,
              border: `1px solid ${C.lightGray}`,
              borderRadius: 8,
              padding: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <FileText size={24} style={{ color: C.navy, flexShrink: 0, marginTop: 4 }} />
              <div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: C.darkNavy,
                    marginBottom: 8,
                  }}
                >
                  Need: Intelligent Fuzzy Matching
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: C.darkGray,
                    marginBottom: 12,
                    fontStyle: "italic",
                    lineHeight: 1.6,
                  }}
                >
                  "The thing about label review is there's nuance. You can't just pattern match everything. 
                  Like, I had one last week where the brand name was 'STONE'S THROW' on the label but 
                  'Stone's Throw' in the application. Technically a mismatch? Sure. But it's obviously 
                  the same thing. You need judgment."
                </p>
                <div
                  style={{
                    background: "#f0f9ff",
                    border: "1px solid #0ea5e9",
                    borderRadius: 6,
                    padding: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <CheckCircle2 size={18} style={{ color: "#0ea5e9" }} />
                    <strong style={{ color: C.darkNavy }}>Solution Implemented:</strong>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, color: C.darkGray, lineHeight: 1.8 }}>
                    <li><strong>Levenshtein distance:</strong> Measures similarity between strings</li>
                    <li><strong>Case-insensitive matching:</strong> "STONE'S THROW" = "Stone's Throw"</li>
                    <li><strong>Punctuation normalization:</strong> Handles apostrophes, hyphens, spaces</li>
                    <li><strong>Substring matching:</strong> Finds partial matches in longer text</li>
                    <li><strong>Configurable thresholds:</strong> Balance precision vs recall</li>
                    <li><strong>Human judgment preserved:</strong> Agent makes final decision</li>
                  </ul>
                  <p style={{ margin: "12px 0 0 0", fontSize: 14, color: C.darkGray }}>
                    <strong>Result:</strong> System handles real-world variations while keeping human oversight.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Jenny Park - Junior Compliance Agent */}
        <section style={{ marginBottom: 48 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
              paddingBottom: 12,
              borderBottom: `3px solid ${C.navy}`,
            }}
          >
            <Zap size={28} style={{ color: C.navy }} />
            <h2
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: C.darkNavy,
                fontFamily: "'Merriweather', Georgia, serif",
              }}
            >
              Jenny Park, Junior Compliance Agent (8 months)
            </h2>
          </div>

          {/* Need 1: Exact Warning Validation */}
          <div
            style={{
              background: C.white,
              border: `1px solid ${C.lightGray}`,
              borderRadius: 8,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <AlertCircle size={24} style={{ color: C.navy, flexShrink: 0, marginTop: 4 }} />
              <div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: C.darkNavy,
                    marginBottom: 8,
                  }}
                >
                  Need: Exact Warning Statement Validation
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: C.darkGray,
                    marginBottom: 12,
                    fontStyle: "italic",
                    lineHeight: 1.6,
                  }}
                >
                  "The warning statement check is actually trickier than it sounds. It has to be exact. 
                  Like, word-for-word, and the 'GOVERNMENT WARNING:' part has to be in all caps and bold. 
                  I caught one last month where they used 'Government Warning' in title case instead of 
                  all caps. Rejected."
                </p>
                <div
                  style={{
                    background: "#f0f9ff",
                    border: "1px solid #0ea5e9",
                    borderRadius: 6,
                    padding: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <CheckCircle2 size={18} style={{ color: "#0ea5e9" }} />
                    <strong style={{ color: C.darkNavy }}>Solution Implemented:</strong>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, color: C.darkGray, lineHeight: 1.8 }}>
                    <li><strong>Pattern matching:</strong> Detects "GOVERNMENT WARNING:" in all caps</li>
                    <li><strong>5 fallback strategies:</strong> Handles fragmented OCR text</li>
                    <li><strong>Truncation logic:</strong> Stops at "health problems" end-marker</li>
                    <li><strong>OCR error tolerance:</strong> Handles GOVERNMEN, GOVERNMENI, WARNIN6</li>
                    <li><strong>76 unit tests:</strong> Comprehensive edge case coverage</li>
                  </ul>
                  <p style={{ margin: "12px 0 0 0", fontSize: 14, color: C.darkGray }}>
                    <strong>Result:</strong> Strict validation with tolerance for OCR imperfections.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Need 2: Image Quality Handling */}
          <div
            style={{
              background: C.white,
              border: `1px solid ${C.lightGray}`,
              borderRadius: 8,
              padding: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <ImageIcon size={24} style={{ color: C.navy, flexShrink: 0, marginTop: 4 }} />
              <div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: C.darkNavy,
                    marginBottom: 8,
                  }}
                >
                  Need: Handle Poor Quality Images
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: C.darkGray,
                    marginBottom: 12,
                    fontStyle: "italic",
                    lineHeight: 1.6,
                  }}
                >
                  "It would be amazing if the tool could handle images that aren't perfectly shot. 
                  I've seen labels that are photographed at weird angles, or the lighting is bad, or 
                  there's glare on the bottle. Right now if an agent can't read the label they just 
                  reject it and ask for a better image."
                </p>
                <div
                  style={{
                    background: "#f0f9ff",
                    border: "1px solid #0ea5e9",
                    borderRadius: 6,
                    padding: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <CheckCircle2 size={18} style={{ color: "#0ea5e9" }} />
                    <strong style={{ color: C.darkNavy }}>Solution Implemented:</strong>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, color: C.darkGray, lineHeight: 1.8 }}>
                    <li><strong>Perspective correction:</strong> Corner drag + mesh warp for angled labels</li>
                    <li><strong>Cylindrical unwrap:</strong> Handles curved bottle labels</li>
                    <li><strong>Smart edge-strip rotation:</strong> Detects and rotates 90° warnings</li>
                    <li><strong>Sharpen filter:</strong> Laplacian unsharp mask for blurry images</li>
                    <li><strong>Confidence-gated binarization:</strong> Retries with Otsu threshold if needed</li>
                    <li><strong>Auto-flatten:</strong> Removes perspective distortion automatically</li>
                  </ul>
                  <p style={{ margin: "12px 0 0 0", fontSize: 14, color: C.darkGray }}>
                    <strong>Result:</strong> Comprehensive image preprocessing reduces rejections due to image quality.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Summary */}
        <section
          style={{
            background: "#f0fdf4",
            border: "2px solid #22c55e",
            borderRadius: 8,
            padding: 24,
          }}
        >
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: C.darkNavy,
              marginBottom: 16,
              fontFamily: "'Merriweather', Georgia, serif",
            }}
          >
            Summary: All Stakeholder Needs Addressed
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: C.darkNavy, marginBottom: 8 }}>
                Performance & Usability
              </h4>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: C.darkGray, lineHeight: 1.8 }}>
                <li>✅ &lt;5 second processing time</li>
                <li>✅ Batch upload (200+ labels)</li>
                <li>✅ Intuitive interface for all skill levels</li>
                <li>✅ Guided walkthrough tutorial</li>
              </ul>
            </div>
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: C.darkNavy, marginBottom: 8 }}>
                Technical Requirements
              </h4>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: C.darkGray, lineHeight: 1.8 }}>
                <li>✅ Standalone prototype (no COLA integration)</li>
                <li>✅ Firewall-friendly (offline OCR option)</li>
                <li>✅ Fuzzy matching for real-world variations</li>
                <li>✅ Human judgment preserved</li>
              </ul>
            </div>
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: C.darkNavy, marginBottom: 8 }}>
                Validation Accuracy
              </h4>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: C.darkGray, lineHeight: 1.8 }}>
                <li>✅ Exact warning statement validation</li>
                <li>✅ OCR error tolerance (76 test cases)</li>
                <li>✅ Category-aware rules (beer/wine/spirits)</li>
                <li>✅ 153 unit tests for reliability</li>
              </ul>
            </div>
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: C.darkNavy, marginBottom: 8 }}>
                Image Processing
              </h4>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: C.darkGray, lineHeight: 1.8 }}>
                <li>✅ Perspective correction</li>
                <li>✅ Cylindrical unwrap for bottles</li>
                <li>✅ Smart rotation for edge warnings</li>
                <li>✅ Sharpen & binarization filters</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </TTBShell>
  );
}
