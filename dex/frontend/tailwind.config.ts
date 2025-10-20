import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./pages/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0b1120",
        surface: "#111827",
        accent: "#6366f1",
        border: "#1f2937"
      }
    }
  },
  plugins: []
};

export default config;
