/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0866A6',
          hover: '#065287',
          light: '#EAF3FA',
          subtle: '#D3E6F5',
        },
        secondary: '#00A86B',
        danger: '#D32F2F',
        bggray: '#F3F6FA',
        card: '#FFFFFF',
        border: '#DCE3EB',
        slateText: '#172B4D',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

