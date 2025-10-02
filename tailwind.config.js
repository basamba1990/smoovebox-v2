/** @type {import('tailwindcss').Config} */
import colors from 'tailwindcss/colors'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Réactivation des couleurs Tailwind classiques
        gray: colors.gray,
        blue: colors.blue,
        red: colors.red,
        emerald: colors.emerald,
        neutral: colors.neutral,

        // Couleurs France
        france: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
          950: '#172554'
        },
        // Couleurs Maroc
        maroc: {
          50: '#FEF7F7',
          100: '#FEEBEB',
          200: '#FCD6D6',
          300: '#F9B4B4',
          400: '#F48383',
          500: '#EA5A5A',
          600: '#D63C3C',
          700: '#B32D2D',
          800: '#942929',
          900: '#7B2727',
          950: '#430F0F'
        },
        // Couleurs Vert Maroc
        marocGreen: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
          900: '#14532D',
          950: '#052E16'
        },
        // Couleurs primaires
        primary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
          950: '#172554'
        },
        // Couleurs secondaires
        secondary: {
          50: '#FEF7F7',
          100: '#FEEBEB',
          200: '#FCD6D6',
          300: '#F9B4B4',
          400: '#F48383',
          500: '#EA5A5A',
          600: '#D63C3C',
          700: '#B32D2D',
          800: '#942929',
          900: '#7B2727',
          950: '#430F0F'
        },
        // Accent vert Maroc
        accent: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
          900: '#14532D',
          950: '#052E16'
        }
      },
      backgroundImage: {
        'france-maroc-gradient': 'linear-gradient(135deg, #2563EB 0%, #FFFFFF 50%, #D63C3C 100%)',
        'france-maroc-horizontal': 'linear-gradient(90deg, #2563EB 0%, #FFFFFF 50%, #D63C3C 100%)',
        'france-flag': 'linear-gradient(90deg, #2563EB 33%, #FFFFFF 33%, #FFFFFF 66%, #D63C3C 66%)',
        'maroc-flag': 'linear-gradient(135deg, #D63C3C 0%, #16A34A 100%)',
        'spotbulle-primary': 'linear-gradient(135deg, #2563EB 0%, #D63C3C 100%)',
        'spotbulle-secondary': 'linear-gradient(135deg, #16A34A 0%, #2563EB 100%)',
      },
      gradientColorStops: {
        'france-blue': '#2563EB',
        'france-white': '#FFFFFF',
        'maroc-red': '#D63C3C',
        'maroc-green': '#16A34A',
      },
      fontFamily: {
        'french': ['"Playfair Display"', 'serif'],
        'arabic': ['"Amiri"', 'serif'],
        'spotbulle': ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
      boxShadow: {
        'france': '0 4px 14px 0 rgba(37, 99, 235, 0.1)',
        'maroc': '0 4px 14px 0 rgba(214, 60, 60, 0.1)',
        'spotbulle': '0 8px 25px 0 rgba(37, 99, 235, 0.15)',
        'spotbulle-lg': '0 15px 40px 0 rgba(37, 99, 235, 0.2)',
      },
      borderRadius: {
        'spotbulle': '12px',
        'spotbulle-lg': '20px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      }
    },
  },
  plugins: [
    // Plugin pour les dégradés animés
    function({ addUtilities }) {
      const newUtilities = {
        '.bg-spotbulle-animated': {
          background: 'linear-gradient(-45deg, #2563EB, #D63C3C, #16A34A, #1E40AF)',
          backgroundSize: '400% 400%',
          animation: 'gradient 15s ease infinite',
        },
        '.text-gradient-france': {
          background: 'linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        },
        '.text-gradient-maroc': {
          background: 'linear-gradient(135deg, #D63C3C 0%, #B32D2D 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        },
        '.text-gradient-spotbulle': {
          background: 'linear-gradient(135deg, #2563EB 0%, #D63C3C 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        },
      }
      addUtilities(newUtilities)
    }
  ],
}
