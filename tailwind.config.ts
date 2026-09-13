import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fbfa',
          100: '#d8f5f2',
          200: '#b3eae6',
          300: '#7dd9d3',
          400: '#45c1bb',
          500: '#27a9a4',
          600: '#1d8a87',
          700: '#1b6f6e',
          800: '#1a5958',
          900: '#194a49',
          950: '#0a2e2e'
        },
        status: {
          green: { bg: '#e6f6ec', text: '#15803d', border: '#bbf7d0' },
          yellow: { bg: '#fef9e7', text: '#a16207', border: '#fde68a' },
          red: { bg: '#fdeceb', text: '#b91c1c', border: '#fecaca' }
        }
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif']
      }
    }
  },
  plugins: []
};

export default config;