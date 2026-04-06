import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        kpmg: {
          blue: "#00338D",
          "light-blue": "#0091DA",
          green: "#548235",
          amber: "#BF8F00",
          red: "#C00000",
        },
        surface: "#FAFBFC",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        montserrat: ["Montserrat", "Inter", "sans-serif"],
        arabic: ["'Noto Sans Arabic'", "Arial", "sans-serif"],
      },
      boxShadow: {
        "card": "0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        "card-hover": "0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.04)",
        "elevated": "0 10px 25px -5px rgb(0 0 0 / 0.1), 0 4px 10px -6px rgb(0 0 0 / 0.05)",
        "modal": "0 20px 60px -12px rgb(0 0 0 / 0.25)",
        "glow-purple": "0 0 20px -4px rgb(124 58 237 / 0.3)",
        "glow-green": "0 0 20px -4px rgb(16 185 129 / 0.3)",
        "glow-orange": "0 0 20px -4px rgb(245 158 11 / 0.3)",
      },
      keyframes: {
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { opacity: "0", transform: "translateX(8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
      animation: {
        "shimmer": "shimmer 2s ease-in-out infinite",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in": "slide-in 0.2s ease-out",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
