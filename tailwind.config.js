/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Legacy poly colors
        'poly-green': '#00D395',
        'poly-red': '#FF6B6B',
        'poly-dark': '#0D1117',
        'poly-card': '#161B22',
        'poly-border': '#30363D',
        // Polymarket brand colors
        'pm': {
          'blue': '#1652f0',
          'blue-hover': '#164bcf',
          'secondary': '#2d9cdb',
          'accent': '#5d94ff',
        },
        // Polymarket dark theme
        'pm-dark': {
          'bg': '#1d2b3a',
          'surface': '#2b3846',
          'surface-2': '#2c3f50',
          'surface-3': '#344452',
          'surface-4': '#425464',
          'border': '#2c3f4f',
        },
        // Polymarket light theme
        'pm-light': {
          'bg': '#ffffff',
          'surface': '#f9fafa',
          'surface-2': '#f2f2f2',
          'hover': '#edeff1',
          'border': '#e6e8ea',
        },
        // Polymarket trading colors
        'pm-yes': {
          'DEFAULT': '#27ae60',
          'bright': '#00b955',
          'bg': 'rgba(39, 174, 96, 0.1)',
        },
        'pm-no': {
          'DEFAULT': '#eb5757',
          'orange': '#e64800',
          'bright': '#f9452c',
          'bg': 'rgba(235, 87, 87, 0.1)',
        },
        // Polymarket text
        'pm-text': {
          'primary': '#ffffff',
          'secondary': '#777e90',
          'muted': '#8297a3',
        },
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
