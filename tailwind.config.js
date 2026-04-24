/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/shell/view/**/*.{html,js,ts,jsx,tsx}",
    "./src/features/**/view/**/*.{html,js,ts,jsx,tsx}",
    "./src/core/ui/**/*.{html,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
