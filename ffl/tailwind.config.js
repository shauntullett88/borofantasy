/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ffc: {
          red: '#C8102E',
          gold: '#F5C842',
          dark: '#1A1A2E',
          pitch: '#2D6A4F',
          'pitch-light': '#40916C',
          surface: '#16213E',
          muted: '#0F3460',
        },
      },
      fontFamily: {
        display: ['Impact', 'Arial Narrow', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
