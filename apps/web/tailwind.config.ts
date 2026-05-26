import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        claw: {
          bg: "#080a0f",
          panel: "#0d1118",
          line: "#202838",
          text: "#e6edf7",
          muted: "#8d9ab0",
          cyan: "#46d6c8",
          amber: "#f4c35b",
          red: "#ff6b6b"
        }
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(70,214,200,0.12), 0 24px 70px rgba(0,0,0,0.42)"
      }
    }
  },
  plugins: []
};

export default config;
