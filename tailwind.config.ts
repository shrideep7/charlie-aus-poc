import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: "var(--ground)",
        surface: "var(--surface)",
        sunk: "var(--sunk)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        hairline: "var(--hairline)",
        rule: "var(--rule)",
        brass: "var(--brass)",
        brassDim: "var(--brass-dim)",
        ok: "var(--ok)",
        warn: "var(--warn)",
        crit: "var(--crit)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
