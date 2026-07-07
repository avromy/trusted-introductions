import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1F2933',
        cream: '#FBF7EF',
        sage: '#DDE7D8',
        trust: '#385A64',
        clay: '#B86B4B',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui'],
      },
      boxShadow: {
        soft: '0 18px 45px rgba(31, 41, 51, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
