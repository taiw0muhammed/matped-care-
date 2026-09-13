import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7f4",
          100: "#d6ece5",
          200: "#aed9cb",
          300: "#7fc0ac",
          400: "#54a58d",
          500: "#2f8a72",
          600: "#206e5b",
          700: "#1b584a",
          800: "#17463c",
          900: "#133a32",
        },
        status: {
          green: "#16a34a",
          yellow: "#d97706",
          red: "#dc2626",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
