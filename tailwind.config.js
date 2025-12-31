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
          gold: "#E7C11C", // кнопка Sign In
          gray: "#1c1c1c", // кнопка Sign Up
          black: "#0B0B0B", // фон
          white: "#ffff",
          title: "#E7C11C", // заголовок QASID
          "qasid-bg": "#0B0B0C",
          "qasid-bg-2": "#141416",
          "qasid-gold": "#E7C11C",
          "qasid-gold-20": "rgba(231,193,28,0.20)",
          "qasid-card": "rgba(20,20,22,0.85)",
          red: "#FF4444", // ссылки и акценты
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
