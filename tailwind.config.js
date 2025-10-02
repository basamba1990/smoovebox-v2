// tailwind.config.js
const colors = require('tailwindcss/colors')

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // réimporter la palette grise par défaut
        gray: colors.gray,

        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        france: {
          50: '#eff6ff',  // bleu très clair
          100: '#3b82f6', // bleu France
          200: '#ffffff', // blanc
          300: '#ef4444', // rouge vif
        },
        maroc: {
          50: '#fef2f2',  // rouge clair
          100: '#dc2626', // rouge vif
          200: '#16a34a', // vert Maroc
          300: '#ffffff', // blanc
        },
      },
    },
  },
  plugins: [],
}
