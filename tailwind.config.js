/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "App.tsx",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        qasid: {
          gray: "#1c1c1c",
          black: "#0B0B0B",
          white: "#ffffff",
          bg: "#0B0B0C",
          "bg-2": "#141416",
          gold: "#C9A84C",
          "gold-20": "rgba(201,168,76,0.20)",
          card: "rgba(20,20,22,0.85)",
          red: "#FF4444",
        },
      },
      borderRadius: {
        "3xl": "28px",
      },
      fontFamily: {
        // подключите любую сериф/санс; временно системные
        display: ["Georgia", "serif"],
        ui: ["System", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
