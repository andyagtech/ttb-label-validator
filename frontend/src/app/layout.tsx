/**
 * Root layout — the outermost HTML shell for the entire application.
 *
 * This layout wraps both the TTB-styled pages (via the (main) route group)
 * and the legacy Tailwind pages (via /legacy). It provides:
 *   - Global CSS (Tailwind directives + animation keyframes)
 *   - HTML metadata (title, description)
 *   - The <html> and <body> elements with antialiased text rendering
 *
 * Page-specific chrome (headers, footers, navigation) is handled by
 * nested layouts — see (main)/layout.tsx for the TTBShell wrapper.
 */
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TTB Label Validator",
  description: "Alcohol beverage label compliance review tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
