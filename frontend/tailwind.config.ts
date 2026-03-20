import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4f9',
          100: '#dce6f0',
          200: '#b8c9db',
          300: '#8fa3bc',
          400: '#5c7a9d',
          500: '#3d5f87',
          600: '#2d5280',
          700: '#1E4F8A',
          800: '#183d6b',
          900: '#0F2A44',
          950: '#0a1c2e',
        },
        accent: {
          50: '#fff4ed',
          100: '#ffe6d5',
          200: '#ffc9a3',
          300: '#ffa35a',
          400: '#ff8c33',
          500: '#FF7A00',
          600: '#e86e00',
          700: '#c25e00',
          800: '#9b4d00',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          500: '#22C55E',
          600: '#16a34a',
          700: '#15803d',
        },
        surface: {
          DEFAULT: '#F7F9FC',
          muted: '#E5E7EB',
        },
        premium: {
          DEFAULT: '#111827',
          muted: '#374151',
        },
      },
      boxShadow: {
        card: '0 4px 24px -4px rgba(15, 42, 68, 0.08), 0 2px 8px -2px rgba(15, 42, 68, 0.06)',
        'card-hover': '0 12px 40px -8px rgba(15, 42, 68, 0.12), 0 4px 12px -4px rgba(15, 42, 68, 0.08)',
        cta: '0 4px 14px -2px rgba(255, 122, 0, 0.35)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
