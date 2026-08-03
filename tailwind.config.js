/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Restrained deep-space palette. Two accents only: a pale star-blue for
        // interactive chrome, a warm amber reserved for numeric/live values.
        void: {
          900: '#06080d',
          800: '#0a0d14',
          700: '#0f131c',
          600: '#151a25',
          500: '#1d2331',
        },
        edge: {
          DEFAULT: '#232b3b',
          soft: '#1a2130',
        },
        ink: {
          DEFAULT: '#d5dcea',
          dim: '#98a2b8',
          // The one muted tone. It was #767f93, which cleared 4.5:1 on the page
          // and the panel tints but not on void-500, the lightest surface — so a
          // second token existed for raised surfaces alone, and the two of them
          // plus `dim` made three greys competing to signal hierarchy. This is
          // that second token's value, promoted: it clears AA everywhere,
          // including 4.78 on void-500, so one tone now does the whole job.
          //
          // Against the page background: 6.09, up from 4.99.
          faint: '#858ea2',
        },
        star: {
          DEFAULT: '#9db4ff',
          dim: '#6b7fbf',
        },
        ember: {
          DEFAULT: '#e8bd7d',
        },
      },
      fontFamily: {
        // Typography-first: a real serif for prose, sans reserved for UI chrome,
        // mono for numbers so digits don't shift width as sims run.
        prose: ['Iowan Old Style', 'Palatino Linotype', 'Palatino', 'Georgia', 'serif'],
        ui: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      maxWidth: {
        measure: '68ch',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
