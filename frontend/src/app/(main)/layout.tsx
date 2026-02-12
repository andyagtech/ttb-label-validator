"use client";

import React from "react";
import { TTBShell } from "@/components/TTBShell";

export default function TTBLayout({ children }: { children: React.ReactNode }) {
  return (
    <TTBShell activeNav="what">
      {children}
    </TTBShell>
  );
}
