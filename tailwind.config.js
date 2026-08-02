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
          // Raised from #6b7488, which measured 4.27:1 on the page background
          // and 4.20:1 inside a panel — under the 4.5:1 AA floor for body text,
          // and this tone carries every caption, axis label and readout label on
          // the site. #767f93 is the smallest step that clears 4.5 on all three
          // real backgrounds with margin to spare: 4.99, 4.93, 4.90.
          faint: '#767f93',
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
