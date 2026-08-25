/** @type {import('tailwindcss').Config} */
// Brand tokens live HERE and nowhere else. See THEME.md.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#9E3B1B', // rust maroon — logo, buttons, active nav, underline accents
          dark: '#7F2E14',    // hover / pressed
          tint: '#FBF1ED',    // very light rust wash for subtle backgrounds
        },
        ink: '#222222',       // headings
        body: '#595959',      // body text
        rule: '#E6E1DD',      // hairline borders
        paper: '#FFFFFF',
      },
      fontFamily: {
        display: ['"Archivo"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        sans: ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      maxWidth: { site: '76rem' },
      spacing: { section: '5rem', 'section-sm': '3.5rem' },
      borderRadius: { btn: '0.375rem' },
    },
  },
  plugins: [],
}
