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
          black: "#090A07", // фон
          white: "#ffff",
          title: "#E7C11C", // заголовок QASID
        },
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
