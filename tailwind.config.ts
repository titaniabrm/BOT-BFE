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
        bfe: {
          black: "#0A0A0A",
          dark: "#111111",
          card: "#1A1A1A",
          gold: "#D4AF37",
          primary: "#DC2626",
          secondary: "#991B1B",
          accent: "#EF4444",
          muted: "#737373",
          cyan: "#00B4D8",
        },
      },
    },
  },
  plugins: [],
};
export default config;
