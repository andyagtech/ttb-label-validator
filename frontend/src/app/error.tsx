/**
 * Global error boundary — catches unhandled runtime errors in any route.
 *
 * Next.js App Router automatically wraps each route segment in a React
 * error boundary. This file provides the root-level fallback UI so users
 * see a styled "something went wrong" page instead of a blank screen.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */
"use client";

import React, { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log to the browser console (and any attached monitoring service)
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div
      id="error-page"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0f0f0",
        fontFamily: "'Source Sans Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          background: "#ffffff",
          borderRadius: 8,
          border: "1px solid #dfe1e2",
          padding: 40,
          textAlign: "center",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#f4e3db",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            fontSize: 24,
          }}
        >
          ⚠
        </div>

        <h1
          style={{
            fontFamily: "'Merriweather', Georgia, serif",
            fontSize: 22,
            fontWeight: 700,
            color: "#162e51",
            margin: "0 0 8px",
          }}
        >
          Something went wrong
        </h1>

        <p style={{ fontSize: 14, color: "#71767a", margin: "0 0 24px", lineHeight: 1.6 }}>
          An unexpected error occurred. You can try again, or return to the home page if the problem persists.
        </p>

        {/* Error digest (if available) — helps support look up server-side logs */}
        {error.digest && (
          <p
            style={{
              fontSize: 11,
              fontFamily: "monospace",
              color: "#a9aeb1",
              margin: "0 0 20px",
              wordBreak: "break-all",
            }}
          >
            Error ID: {error.digest}
          </p>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            id="error-retry-button"
            onClick={reset}
            style={{
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 4,
              border: "none",
              background: "#005ea2",
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
          <a
            href="/"
            style={{
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 4,
              border: "1px solid #dfe1e2",
              background: "#ffffff",
              color: "#162e51",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}
