import type { Config } from 'tailwindcss'

const config: Config = {
  prefix: 'ax-',
  content: ['./src/**/*.{ts,tsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        hexos: {
          bg: 'var(--hexos-bg-primary)',
          'bg-secondary': 'var(--hexos-bg-secondary)',
          'bg-input': 'var(--hexos-bg-input)',
          'bg-user': 'var(--hexos-bg-user-bubble)',
          'bg-agent': 'var(--hexos-bg-agent-bubble)',
          border: 'var(--hexos-border-color)',
          'border-subtle': 'var(--hexos-border-subtle)',
          text: 'var(--hexos-text-primary)',
          'text-secondary': 'var(--hexos-text-secondary)',
          'text-muted': 'var(--hexos-text-muted)',
          accent: 'var(--hexos-accent)',
          'accent-hover': 'var(--hexos-accent-hover)',
        },
      },
      borderRadius: {
        'hexos-sm': 'var(--hexos-radius-sm)',
        'hexos-md': 'var(--hexos-radius-md)',
        'hexos-lg': 'var(--hexos-radius-lg)',
        'hexos-xl': 'var(--hexos-radius-xl)',
        'hexos-full': 'var(--hexos-radius-full)',
      },
      fontFamily: {
        'hexos-sans': 'var(--hexos-font-sans)',
      },
      keyframes: {
        'hexos-bounce': {
          '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: '0.5' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
        'hexos-spin': {
          to: { transform: 'rotate(360deg)' },
        },
        'hexos-blink': {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
      },
      animation: {
        'hexos-bounce': 'hexos-bounce 1.4s infinite ease-in-out both',
        'hexos-spin': 'hexos-spin 1s linear infinite',
        'hexos-blink': 'hexos-blink 1s infinite',
      },
    },
  },
}

export default config
