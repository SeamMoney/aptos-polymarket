/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'poly-green': '#00D395',
        'poly-red': '#FF6B6B',
        'poly-dark': '#0D1117',
        'poly-card': '#161B22',
        'poly-border': '#30363D',
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #00D395, 0 0 10px #00D395' },
          '100%': { boxShadow: '0 0 20px #00D395, 0 0 30px #00D395' },
        }
      }
    },
  },
  plugins: [],
}
