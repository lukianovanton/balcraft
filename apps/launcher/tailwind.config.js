/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Create-inspired palette: warm brass, copper, andesite.
        brass: {
          50: '#fbf6ec',
          100: '#f3e6cc',
          200: '#e6cd9c',
          300: '#d8b06a',
          400: '#c99745',
          500: '#b87e2f',
          600: '#9a6425',
          700: '#7c4d20',
          800: '#653f20',
          900: '#56361f',
        },
        copper: {
          400: '#d98b5f',
          500: '#c56a3d',
          600: '#a5502c',
        },
        andesite: {
          900: '#17130f',
          850: '#1c1712',
          800: '#221c16',
          700: '#2c241c',
          600: '#3a2f24',
          500: '#4b3c2e',
          400: '#6b5642',
        },
        // Create's kinetic/patina accent (teal-green).
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
        panel: '0 10px 40px -12px rgba(0,0,0,0.7)',
        glow: '0 0 24px -4px rgba(201,151,69,0.45)',
      },
    },
  },
  plugins: [],
};
