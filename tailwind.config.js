/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#6C63FF', 50: '#F1F0FF', 100: '#E4E2FF', 200: '#C9C5FF', 300: '#A9A3FF', 400: '#8A82FF', 500: '#6C63FF', 600: '#5A50F0', 700: '#4A40D6', 800: '#3B33AD', 900: '#2E2887' },
        navy: { DEFAULT: '#0F172A', 800: '#1E293B', 700: '#334155', 900: '#0B1120', 950: '#070B16' },
        muted: '#64748B',
        surface: '#F8FAFC',
      },
      fontFamily: {
        heading: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        urdu: ['"Noto Nastaliq Urdu"', 'Inter', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.06)',
        lift: '0 10px 30px rgba(108,99,255,0.18)',
      },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        fadein: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: { marquee: 'marquee 40s linear infinite', fadein: 'fadein .25s ease-out' },
    },
  },
  plugins: [],
};
