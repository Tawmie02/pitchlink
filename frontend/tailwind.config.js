/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        pitch: {
          50: "#f0faf3",
          100: "#dcf3e3",
          200: "#bce6ca",
          300: "#8ed1a7",
          400: "#5bb87f",
          500: "#369b60",
          600: "#267c4b",
          700: "#20633d",
          800: "#1d4f33",
          900: "#19412b",
          950: "#0b2417",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.08)",
        card: "0 2px 8px rgba(16, 24, 40, 0.06), 0 1px 2px rgba(16, 24, 40, 0.04)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};
