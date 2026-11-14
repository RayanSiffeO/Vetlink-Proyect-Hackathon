import daisyui from 'daisyui';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#1D2B4F',
        teal: '#1E8E82',
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        soft: '0 4px 18px -6px rgba(29, 43, 79, 0.16)',
        card: '0 10px 32px -14px rgba(29, 43, 79, 0.28)',
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    logs: false,
    themes: [
      {
        vetlink: {
          primary: '#1D2B4F',
          'primary-content': '#FFFFFF',
          secondary: '#1E8E82',
          'secondary-content': '#FFFFFF',
          accent: '#2AA79B',
          'accent-content': '#08312C',
          neutral: '#2B3552',
          'neutral-content': '#F4F7FB',
          'base-100': '#FFFFFF',
          'base-200': '#F4F6FA',
          'base-300': '#E2E8F2',
          'base-content': '#1D2B4F',
          info: '#3B82F6',
          'info-content': '#FFFFFF',
          success: '#1E8E82',
          'success-content': '#FFFFFF',
          warning: '#D97706',
          'warning-content': '#FFFFFF',
          error: '#DC2626',
          'error-content': '#FFFFFF',
          '--rounded-box': '1rem',
          '--rounded-btn': '0.75rem',
          '--rounded-badge': '1.9rem',
          '--border-btn': '1px',
          '--animation-btn': '0.2s',
          '--btn-text-case': 'none',
          '--tab-radius': '0.6rem',
        },
      },
    ],
  },
};
