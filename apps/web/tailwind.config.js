/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#F5F7F6',
        surface: '#FFFFFF',
        brand: {
          DEFAULT: '#0F5C3C',
          hover: '#0B462E',
          50: '#F0F7F4',
          100: '#DFEFE8',
          200: '#BFDFD1',
          300: '#9FCFBA',
          400: '#5FAFA',
          500: '#1E8F62',
          600: '#17734E',
          700: '#0F5C3C',
          800: '#0B462E',
          900: '#073020',
          950: '#041B12',
        },
        ink: {
          main: '#17241E',
          muted: '#68756E',
          light: '#8E9C95',
        },
        line: {
          DEFAULT: '#E2E9E4',
          dark: '#CFDAD2',
        },
      },
      borderRadius: {
        'card': '18px',
        'card-lg': '22px',
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(23, 36, 30, 0.04), 0 1px 2px -1px rgba(23, 36, 30, 0.04)',
        'card': '0 4px 6px -1px rgba(23, 36, 30, 0.04), 0 2px 4px -2px rgba(23, 36, 30, 0.04)',
      },
      spacing: {
        '11': '44px', // 44px min touch target
      },
    },
  },
  plugins: [],
}
