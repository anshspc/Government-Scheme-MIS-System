/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gov: {
          navy: '#1e3a8a',      // Primary Navy
          orange: '#f97316',    // Accent Orange
          dark: '#0f172a',      // Slate Dark
          slate: '#334155',     // Text Slate
          light: '#f8fafc',     // Background Slate Light
          border: '#cbd5e1',    // Divider Border
          success: '#10b981',   // Alert Success
          warning: '#f59e0b',   // Alert Warning
          danger: '#ef4444'     // Alert Danger
        }
      }
    },
  },
  plugins: [],
}
