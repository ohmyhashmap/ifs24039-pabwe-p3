/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./assets/script.js"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        display: ["Outfit", "sans-serif"],
      },
    },
  },
};