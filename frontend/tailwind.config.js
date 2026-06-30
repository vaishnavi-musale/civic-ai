/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        civic: {
          navy: '#0A1628',
          blue: '#1B4FD8',
          sky: '#3B9EFF',
          green: '#00C896',
          orange: '#FF6B35',
          red: '#FF3B5C',
          yellow: '#FFB830',
          white: '#FFFFFF',
          off: '#F5F7FF',
          gray: '#64748B',
          border: '#E2E8F0',
        },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        civic: '0 4px 24px rgba(27, 79, 216, 0.08)',
        civicStrong: '0 20px 60px rgba(10, 22, 40, 0.14)',
      },
    },
  },
  plugins: [],
}
