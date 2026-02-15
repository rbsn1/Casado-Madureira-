import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          900: "rgb(var(--brand-900) / <alpha-value>)",
          800: "rgb(var(--brand-800) / <alpha-value>)",
          700: "rgb(var(--brand-700) / <alpha-value>)",
          100: "#EAF1F7"
        },
        accent: {
          700: "#C6883D",
          600: "rgb(var(--accent-600) / <alpha-value>)",
          500: "rgb(var(--accent-500) / <alpha-value>)",
          400: "rgb(var(--accent-400) / <alpha-value>)",
          300: "#F6C453",
          100: "#FFF4DA"
        },
        app: {
          0: "rgb(var(--bg-0) / <alpha-value>)",
          50: "rgb(var(--bg-50) / <alpha-value>)"
        },
        ink: {
          900: "rgb(var(--slate-900) / <alpha-value>)",
          600: "rgb(var(--slate-600) / <alpha-value>)"
        },
        tea: {
          600: "#2E7A55",
          100: "#E3F0EA"
        },
        surface: "rgb(var(--bg-50) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        text: "rgb(var(--slate-900) / <alpha-value>)",
        "text-muted": "rgb(var(--slate-600) / <alpha-value>)",
        bg: "rgb(var(--bg-0) / <alpha-value>)",
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
} satisfies Config;
