/**
 * Global loading UI — displayed during route transitions and Suspense boundaries.
 *
 * Next.js automatically shows this component while a route segment is loading.
 * Uses a simple CSS-only spinner to avoid importing any client-side JS.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming
 */
import React from "react";

export default function Loading() {
  return (
    <div
      id="loading-page"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0f0f0",
        fontFamily: "'Source Sans Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        {/* CSS-only spinner */}
        <div
          id="loading-spinner"
          style={{
            width: 36,
            height: 36,
            border: "3px solid #dfe1e2",
            borderTopColor: "#005ea2",
            borderRadius: "50%",
            animation: "ttb-spin 0.8s linear infinite",
            margin: "0 auto 16px",
          }}
        />
        <p style={{ fontSize: 13, color: "#71767a", margin: 0 }}>Loading…</p>
        {/* Inline keyframes — no external CSS dependency */}
        <style>{`@keyframes ttb-spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  );
}
