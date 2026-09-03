import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1c1d1f",
        paper: "#f6f5f2",
        navy: "#26365b",
      },
      fontFamily: {
        display: ["Georgia", "serif"],
        body: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
