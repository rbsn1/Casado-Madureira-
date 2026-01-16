import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          900: "#1E5A3F",
          700: "#2E7A55",
          100: "#E3F0EA"
        },
        accent: {
          700: "#D99200",
          600: "#F2A900",
          300: "#F6C453",
          100: "#FFF4DA"
        },
        tea: {
          600: "#2E7A55",
          100: "#E3F0EA"
        },
        surface: "#F8FAF9",
        border: "#E3E8E6",
        text: "#1F2933",
        "text-muted": "#6B7280",
        bg: "#FFFFFF",
        success: {
          600: "#2F9E6F",
          100: "#DDF3EA"
        },
        warning: {
          600: "#F2A900",
          100: "#FFF4DA"
        },
        danger: {
          600: "#D64545",
          100: "#FBE4E4"
        },
        info: {
          600: "#3B82F6",
          100: "#DBEAFE"
        },
        emerald: {
          50: "#E8F3ED",
          100: "#E8F3ED",
          200: "#CDE5D7",
          300: "#A7D2B9",
          400: "#7FB893",
          500: "#5E9D74",
          600: "#4E8B6A",
          700: "#2F6B4F",
          800: "#265841",
          900: "#214C39"
        },
        amber: {
          50: "#FFF8E8",
          100: "#FFF4DA",
          200: "#FEE7B3",
          300: "#F6C453",
          400: "#F2B437",
          500: "#F2A900",
          600: "#D99200",
          700: "#B57500",
          800: "#8F5B00",
          900: "#6B4400"
        }
      }
    }
  },
  plugins: []
};

export default config;
