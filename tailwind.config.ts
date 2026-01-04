import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        tea: {
          50: "#f2fbf2",
          100: "#dff7df",
          200: "#bff0bf",
          300: "#a0e9a0",
          400: "#83dd83",
          500: "#65c965",
          600: "#4cab4c",
          700: "#3b8742",
          800: "#2f6938",
          900: "#295632",
          950: "#112d18"
        }
      }
    }
  },
  plugins: []
};

export default config;
