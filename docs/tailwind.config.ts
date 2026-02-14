import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./theme.config.tsx",
    "./mdx-components.tsx",
  ],
  darkMode: ["class", "class"],
  theme: {
  	extend: {
  		colors: {
  			hexos: {
  				black: '#000000',
  				white: '#ffffff',
  				rose: {
  					'01': '#4a001c',
  					'02': '#670833',
  					'03': '#87114c',
  					'04': '#a81a66',
  					'05': '#bc5089',
  					'06': '#cc7ca5',
  					'07': '#d89aba',
  					'08': '#e3b8cf',
  					'09': '#efd6e3',
  					'10': '#f6eaf1',
  					'11': '#faf4f8',
  					'12': '#fef8fc'
  				},
  				azure: {
  					'01': '#00175d',
  					'02': '#002c77',
  					'03': '#014292',
  					'04': '#0158ad',
  					'05': '#3479be',
  					'06': '#6499cf',
  					'07': '#88b0da',
  					'08': '#abc7e5',
  					'09': '#cfdff0',
  					'10': '#e7eef7',
  					'11': '#f3f6fb',
  					'12': '#f7faff'
  				},
  				green: {
  					'01': '#002000',
  					'02': '#043604',
  					'03': '#084e08',
  					'04': '#0c680c',
  					'05': '#1d882f',
  					'06': '#2faa53',
  					'07': '#56c16f',
  					'08': '#7dd78b',
  					'09': '#b8e8bf',
  					'10': '#ddf3e0',
  					'11': '#eff8f0',
  					'12': '#f3fcf4'
  				},
  				yellow: {
  					'01': '#211000',
  					'02': '#362700',
  					'03': '#4c4000',
  					'04': '#645a00',
  					'05': '#877614',
  					'06': '#ab9429',
  					'07': '#bfac4e',
  					'08': '#d4c474',
  					'09': '#e6deb1',
  					'10': '#f3efd9',
  					'11': '#f9f7ed',
  					'12': '#fcfaf0'
  				},
  				red: {
  					'01': '#4c0000',
  					'02': '#6a0a10',
  					'03': '#8a1422',
  					'04': '#ac1f35',
  					'05': '#bf5366',
  					'06': '#ce7e8e',
  					'07': '#d99ca8',
  					'08': '#e4b9c2',
  					'09': '#efd7db',
  					'10': '#f6eaec',
  					'11': '#faf4f5',
  					'12': '#fff9fa'
  				},
  				grey: {
  					'01': '#181818',
  					'02': '#292929',
  					'03': '#404040',
  					'04': '#5a5a5a',
  					'05': '#767676',
  					'06': '#949494',
  					'07': '#ababab',
  					'08': '#c3c3c3',
  					'09': '#dcdcdc',
  					'10': '#efefef',
  					'11': '#f5f5f5',
  					'12': '#fafafa'
  				}
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontFamily: {
  			sans: [
  				'Inter',
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'Segoe UI',
  				'Helvetica Neue',
  				'sans-serif',
  				'Apple Color Emoji',
  				'Segoe UI Emoji',
  				'Segoe UI Symbol'
  			],
  			mono: [
  				'ui-monospace',
  				'Cascadia Code',
  				'Source Code Pro',
  				'Menlo',
  				'Consolas',
  				'DejaVu Sans Mono',
  				'monospace'
  			]
  		},
  		fontSize: {
  			'hexos-xxxs': '0.75rem',
  			'hexos-xxs': '0.875rem',
  			'hexos-xs': '1rem',
  			'hexos-s': '1.125rem',
  			'hexos-m': '1.3125rem',
  			'hexos-l': '1.5rem',
  			'hexos-xl': '1.75rem',
  			'hexos-xxl': '2.25rem',
  			'hexos-xxxl': '3rem',
  			'hexos-xxxxl': '3.5rem'
  		},
  		keyframes: {
  			'loader-spin': {
  				'0%': {
  					transform: 'rotate(0deg) scale(1)'
  				},
  				'50%': {
  					transform: 'rotate(180deg) scale(0.8)'
  				},
  				'100%': {
  					transform: 'rotate(360deg) scale(1)'
  				}
  			}
  		},
  		animation: {
  			'loader-spin': 'loader-spin 1s linear infinite'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  corePlugins: {
    preflight: false,
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
