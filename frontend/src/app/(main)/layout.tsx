/**
 * Layout for the primary TTB-styled pages (served at root /).
 *
 * Uses the (main) route group so Next.js applies this layout to all pages
 * within the group without adding "(main)" to the URL path. Wraps every
 * page in the TTBShell (gov banner, header, nav, footer) for a consistent
 * look matching TTB.gov's USWDS-based design.
 */
"use client";

import React from "react";
import { TTBShell } from "@/components/TTBShell";

export default function TTBLayout({ children }: { children: React.ReactNode }) {
  return <TTBShell activeNav="what">{children}</TTBShell>;
}
