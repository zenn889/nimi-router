import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#e56a4a",
          hover: "#cc5236",
          soft: "rgba(229,106,74,0.1)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
