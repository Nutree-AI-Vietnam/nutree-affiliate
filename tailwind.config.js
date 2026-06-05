/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          forest: "#1A4739",
          "forest-dark": "#122F26",
          "forest-mid": "#2D7E47",
          teal: "#29B6A1",
          "teal-dark": "#1D9080",
          "teal-light": "#E6F7F5",
          "forest-light": "#E8F0EE",
        },
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #1A4739 0%, #29B6A1 100%)",
        "brand-gradient-soft": "linear-gradient(135deg, #1A4739 0%, #2D7E47 60%, #29B6A1 100%)",
      },
    },
  },
  plugins: [],
}
