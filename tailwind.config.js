/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Official Polymarket colors (poly-* prefix) - extracted from polymarket.com
        'poly': {
          // Background colors (exact from Polymarket)
          'bg': '#1d2b3a',
          'card': '#2f3f50',
          'cardHover': '#364858',
          'surface': '#2f3f50',
          'surfaceHover': '#364858',
          'bgElevated': '#364858',
          // Border colors (exact from Polymarket)
          'border': '#3d5266',
          'borderLight': '#4a6278',
          // Brand colors
          'blue': '#2E5CFF',
          'blueHover': '#2451E0',
          // Trading colors (exact from Polymarket)
          'green': '#43c773',
          'greenHover': '#3ab866',
          'red': '#e13737',
          'redHover': '#d42e2e',
          // Text colors (exact from Polymarket)
          'textPrimary': '#FFFFFF',
          'textSecondary': '#8297a3',
          'textMuted': '#8297a3',
          // UI elements
          'inputBg': '#1d2b3a',
          'pillBg': '#2f3f50',
          'pillSelected': '#364858',
          'cyan': '#2E5CFF',
        },
        // Legacy poly colors (for backwards compatibility) - updated to exact Polymarket
        'poly-green': '#43c773',
        'poly-red': '#e13737',
        'poly-dark': '#1d2b3a',
        'poly-card': '#2f3f50',
        'poly-border': '#3d5266',
        // Polymarket brand colors
        'pm': {
          'blue': '#1652f0',
          'blue-hover': '#164bcf',
          'secondary': '#2d9cdb',
          'accent': '#5d94ff',
        },
        // Polymarket dark theme (exact from Polymarket)
        'pm-dark': {
          'bg': '#1d2b3a',
          'surface': '#2f3f50',
          'surface-2': '#364858',
          'surface-3': '#3d5266',
          'surface-4': '#4a6278',
          'border': '#3d5266',
        },
        // Polymarket light theme
        'pm-light': {
          'bg': '#ffffff',
          'surface': '#f9fafa',
          'surface-2': '#f2f2f2',
          'hover': '#edeff1',
          'border': '#e6e8ea',
        },
        // Polymarket trading colors (exact from Polymarket)
        'pm-yes': {
          'DEFAULT': '#43c773',
          'bright': '#4ed97f',
          'bg': 'rgba(67, 199, 115, 0.15)',
        },
        'pm-no': {
          'DEFAULT': '#e13737',
          'orange': '#e64800',
          'bright': '#f04040',
          'bg': 'rgba(225, 55, 55, 0.15)',
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
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #00D395, 0 0 10px #00D395' },
          '100%': { boxShadow: '0 0 20px #00D395, 0 0 30px #00D395' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      }
    },
  },
  plugins: [],
}
