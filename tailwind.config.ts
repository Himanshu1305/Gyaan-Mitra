import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#FF9933",
          50:  "#FFF4E6",
          100: "#FFE4B3",
          200: "#FFD080",
          300: "#FFBC4D",
          400: "#FFA826",
          500: "#FF9933",
          600: "#E6891D",
          700: "#CC7710",
          800: "#B36500",
          900: "#995500",
        },
        secondary: {
          DEFAULT: "#1B3A6B",
          50:  "#E8EDF5",
          100: "#C6D1E6",
          200: "#A0B3D4",
          300: "#7A95C2",
          400: "#5477AF",
          500: "#1B3A6B",
          600: "#163260",
          700: "#112954",
          800: "#0C2047",
          900: "#07173A",
        },
      },
    },
  },
  plugins: [],
};
export default config;
