import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: { ink: "#05060d", panel: "#0b0e1c", edge: "#1b2140", aether: { 400: "#7c9cff",500: "#5b7cff", 600: "#4a5fe0" }, neon: "#22d3ee", plasma: "#c084fc" },
    fontFamily: { sans: ["Inter", "system-ui", "sans-serif"], mono: ["JetBrains Mono", "ui-monospace", "monospace"] },
    boxShadow: { glow: "0 0 40px -8px rgba(91,124,255,.55)" },
    keyframes: { float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } }, scan: { "0%": { top: "0%" }, "100%": { top: "100%" } } },
    animation: { float: "float 5s ease-in-out infinite", scan: "scan 2.2s linear infinite" } } },
  plugins: [],
} satisfies Config;
