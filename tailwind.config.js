/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Official Polymarket colors (poly-* prefix)
        'poly': {
          // Background colors
          'bg': '#1c2b3a',
          'card': '#243447',
          'cardHover': '#2a3d52',
          'surface': '#243447',
          'surfaceHover': '#2a3d52',
          'bgElevated': '#2a3d52',
          // Border colors
          'border': '#30363D',
          'borderLight': '#3D444D',
          // Brand colors
          'blue': '#2E5CFF',
          'blueHover': '#2451E0',
          // Trading colors
          'green': '#00D295',
          'greenHover': '#00BA85',
          'red': '#FF6B6B',
          'redHover': '#E85555',
          // Text colors
          'textPrimary': '#FFFFFF',
          'textSecondary': '#8B949E',
          'textMuted': '#6E7681',
          // UI elements
          'inputBg': '#1c2b3a',
          'pillBg': '#243447',
          'pillSelected': '#2a3d52',
          'cyan': '#2E5CFF',
        },
        // Legacy poly colors (for backwards compatibility)
        'poly-green': '#00D295',
        'poly-red': '#FF6B6B',
        'poly-dark': '#1c2b3a',
        'poly-card': '#243447',
        'poly-border': '#2c3f4f',
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
