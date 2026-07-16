/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral dark base (Modrinth-like). Key name kept as `andesite` so
        // existing classes remap automatically.
        andesite: {
          900: '#0f1013', // deepest base
          850: '#141619', // app background
          800: '#191c21', // surface / cards
          700: '#232830', // raised / hover / subtle border
          600: '#30363f', // borders
          500: '#454b57',
          400: '#8b929e', // muted text
        },
        // `brass` is overloaded in the app: 50–200 are light text, 300+ are the
        // accent. Map light shades to near-white and accent shades to green.
        brass: {
          50: '#eef1f4',
          100: '#dfe3e9',
          200: '#c4cad3',
          300: '#7fe9a6',
          400: '#43dd7d',
          500: '#1bd96a', // Modrinth-style green — primary accent
          600: '#15b658',
          700: '#129148',
          800: '#0f7139',
          900: '#0c5a2f',
        },
        // Warm amber for notices/warnings (contrast against the green primary).
        copper: {
          400: '#f0b429',
          500: '#dd9a1f',
          600: '#b8801a',
        },
        patina: {
          300: '#6fd6c4',
          400: '#3fbfa8',
          500: '#2aa08b',
          600: '#1f7d6d',
        },
      },
      fontFamily: {
        display: ['"Segoe UI Semibold"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 8px 30px -12px rgba(0,0,0,0.6)',
        glow: '0 0 24px -6px rgba(27,217,106,0.5)',
      },
    },
  },
  plugins: [],
};
