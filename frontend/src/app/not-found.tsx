/**
 * Custom 404 page — shown when no route matches the requested URL.
 *
 * Styled to match the TTB visual identity so users get a cohesive
 * experience even when they hit a dead end.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/not-found
 */
import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div
      id="not-found-page"
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
        {/* Large 404 badge */}
        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: "#dfe1e2",
            fontFamily: "'Merriweather', Georgia, serif",
            marginBottom: 12,
          }}
        >
          404
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
          Page not found
        </h1>

        <p style={{ fontSize: 14, color: "#71767a", margin: "0 0 24px", lineHeight: 1.6 }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved. Check the URL, or use the links below
          to get back on track.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/"
            id="not-found-home-link"
            style={{
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 4,
              border: "none",
              background: "#005ea2",
              color: "#ffffff",
              textDecoration: "none",
            }}
          >
            Home
          </Link>
          <Link
            href="/queue"
            style={{
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 4,
              border: "1px solid #dfe1e2",
              background: "#ffffff",
              color: "#162e51",
              textDecoration: "none",
            }}
          >
            Review Queue
          </Link>
          <Link
            href="/api-test"
            style={{
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 4,
              border: "1px solid #dfe1e2",
              background: "#ffffff",
              color: "#162e51",
              textDecoration: "none",
            }}
          >
            API Console
          </Link>
        </div>
      </div>
    </div>
  );
}
