// ============================================================
// tailwind.config.js — AMUL PAGLU
// ============================================================

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // dark mode toggled via class on <html>
  theme: {
    extend: {
      colors: {
        // Amul Brand Colors
        amul: {
          red:        '#C8102E',
          'red-dark': '#A00D24',
          'red-light':'#E8304E',
          gold:       '#FFD700',
          'gold-dark':'#E6C200',
          cream:      '#FAFAF7',
          warm:       '#FFF8F0',
        },
        dark: {
          base: '#1C1410',   // warm charcoal — dark mode background
          card: '#2A1F18',   // warm dark brown — dark mode card
        },
        // Rarity Colors (for badges)
        rarity: {
          common:     '#6B7280', // gray
          uncommon:   '#16A34A', // green
          rare:       '#2563EB', // blue
          epic:       '#7C3AED', // purple
          legendary:  '#D97706', // amber/gold
        },
        // Tier Colors (for user badges)
        tier: {
          milk:       '#94A3B8',
          cheese:     '#65A30D',
          icecream:   '#0891B2',
          butter:     '#CA8A04',
          legend:     '#C8102E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl':  '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card':    '0 2px 12px 0 rgba(0,0,0,0.06)',
        'card-lg': '0 4px 24px 0 rgba(0,0,0,0.10)',
        'amul':    '0 4px 20px 0 rgba(200,16,46,0.15)',
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-in-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'bounce-in':  'bounceIn 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55)',
        'confetti':   'confetti 0.6s ease-out forwards',
        'marquee':    'marquee 28s linear infinite',
        'shine':      'shine 3s linear infinite',
        'shake':      'shake 0.4s cubic-bezier(.36,.07,.19,.97) both',
        'pop':        'pop 0.15s ease-out',
        'slide-in-up':'slideInUp 0.2s ease-out',
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        bounceIn: {
          '0%':   { transform: 'scale(0.8)', opacity: '0' },
          '60%':  { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)',   opacity: '1' },
        },
        confetti: {
          '0%':   { transform: 'scale(1)' },
          '50%':  { transform: 'scale(1.3)' },
          '100%': { transform: 'scale(1)' },
        },
        marquee: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-33.333%)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%':  { transform: 'translateX(-6px)' },
          '30%':  { transform: 'translateX(5px)' },
          '45%':  { transform: 'translateX(-4px)' },
          '60%':  { transform: 'translateX(3px)' },
          '75%':  { transform: 'translateX(-2px)' },
        },
        pop: {
          '0%':   { transform: 'scale(0.94)' },
          '60%':  { transform: 'scale(1.04)' },
          '100%': { transform: 'scale(1)' },
        },
        slideInUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      screens: {
        'xs': '375px', // minimum mobile support
      },
    },
  },
  plugins: [],
}
