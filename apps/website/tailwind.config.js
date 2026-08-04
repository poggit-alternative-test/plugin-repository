/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EBF5FF',
          100: '#C5E4FC',
          200: '#7BC5F8',
          300: '#3BAAF2',
          400: '#18B9EE',
          500: '#128AF1',
          600: '#084DE6',
          700: '#0535A8',
          800: '#031D6B',
          900: '#010B2E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace'],
      },
      letterSpacing: {
        'tightest': '-0.04em',
        'tighter': '-0.03em',
        'tight': '-0.02em',
        'normal': '-0.01em',
      },
      lineHeight: {
        'hero': '1.1',
      },
      borderRadius: {
        'card': '12px',
        'button': '10px',
        'badge': '6px',
        'icon': '7px',
      },
    },
  },
  plugins: [],
};
