/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}', './public/**/*.html'],
  theme: {
    extend: {
      colors: {
        primary: '#00d9ff',
        'primary-hover': '#00b8d4',
        dark: {
          bg: '#1a1a2e',
          card: '#16213e',
          log: '#0f0f23',
        },
      },
    },
  },
  plugins: [],
}
