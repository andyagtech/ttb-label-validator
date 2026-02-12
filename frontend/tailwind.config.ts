import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          border: "var(--card-border)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
        },
        muted: "var(--muted)",
        accent: "var(--accent)",
      },
    },
  },
  plugins: [],
};

export default config;
