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
