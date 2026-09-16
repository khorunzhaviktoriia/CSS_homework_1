/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#2563EB",
          50: "#EFF4FF",
          100: "#DCE7FF",
          600: "#2563EB",
          700: "#1D4ED8",
        },
        navy: {
          DEFAULT: "#0F172A",
          800: "#131C31",
          900: "#0B1220",
        },
        cyan: {
          DEFAULT: "#38BDF8",
        },
        surface: "#F8FAFC",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "22px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15,23,42,0.04), 0 12px 32px -12px rgba(15,23,42,0.12)",
        glow: "0 0 0 1px rgba(56,189,248,0.15), 0 8px 24px -8px rgba(37,99,235,0.35)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite linear",
      },
    },
  },
  plugins: [],
}

