import { Button } from '@/docs/components/Button';
import { GridPatternLinearGradient } from '../ui/grid-pattern-linear-gradient';
import Link from 'next/link';

export const Home = () => {
  return (
    <GridPatternLinearGradient>
      <section
        className={[
          'relative flex flex-col items-center justify-start text-center',
          'w-full max-w-[1200px] mx-auto box-border',
          'px-6 pb-16 gap-5',
          'pt-[clamp(28px,5.2vw,72px)]',
          'md:gap-7',
          'max-[767px]:px-4 max-[767px]:pb-12 max-[767px]:pt-7 max-[767px]:gap-5',
          "before:content-[''] before:absolute before:left-1/2 before:top-0",
          'before:w-full before:max-w-[980px] before:h-[340px]',
          'before:-translate-x-1/2 before:-z-10 before:pointer-events-none',
          'before:[background:radial-gradient(ellipse_at_center,rgba(170,176,199,0.24)_0%,rgba(170,176,199,0.08)_45%,rgba(170,176,199,0)_72%)]',
          'dark:before:[background:radial-gradient(ellipse_at_center,rgba(86,109,181,0.34)_0%,rgba(86,109,181,0.14)_42%,rgba(86,109,181,0)_72%)]',
        ].join(' ')}
      >
        <header className="w-full max-w-[840px] grid gap-2.5 max-[767px]:max-w-[540px]">
          <div className="m-0 text-[clamp(14px,1.1vw,18px)] leading-[1.2] text-[#454b58] dark:text-[#cfd8ee] [html.dark_&]:text-[#cfd8ee] [html[data-theme=dark]_&]:text-[#cfd8ee]">
            Open-source under MIT
          </div>
          <h1
            className={[
              'm-0 grid gap-0.5',
              'font-extrabold tracking-[-0.04em] leading-[0.94]',
              'text-[clamp(42px,6.2vw,96px)]',
              'max-[767px]:text-[clamp(34px,10vw,56px)] max-[767px]:leading-[0.98]',
            ].join(' ')}
          >
            <span className="text-[#343740] dark:text-[#f3f7ff] [html.dark_&]:text-[#f3f7ff] [html[data-theme=dark]_&]:text-[#f3f7ff]">
              Create your own
            </span>
            <span
              className={[
                'bg-gradient-to-r from-[#b74f7a] via-[#6f4aa7] to-[#0f4fa5]',
                'dark:from-[#d96b9a] dark:via-[#8f6ad6] dark:to-[#5a96ff]',
                '[html.dark_&]:from-[#d96b9a] [html.dark_&]:via-[#8f6ad6] [html.dark_&]:to-[#5a96ff]',
                '[html[data-theme=dark]_&]:from-[#d96b9a] [html[data-theme=dark]_&]:via-[#8f6ad6] [html[data-theme=dark]_&]:to-[#5a96ff]',
                'bg-clip-text text-transparent pb-2.5',
              ].join(' ')}
            >
              Agent Framework
            </span>
          </h1>
          <p
            className={[
              'm-0 mx-auto max-w-[640px] leading-[1.38] text-[#626774]',
              'text-[clamp(16px,1.45vw,28px)]',
              'dark:text-[#d8e2f8]',
              '[html.dark_&]:text-[#d8e2f8]',
              '[html[data-theme=dark]_&]:text-[#d8e2f8]',
              'max-[767px]:max-w-[32ch] max-[767px]:text-base max-[767px]:leading-normal',
            ].join(' ')}
          >
            Central orchestrator for multi-agent conversations with LLM providers, tool execution,
            and human-in-the-loop approvals.
          </p>
        </header>

        <div className="flex justify-center items-center flex-wrap gap-3 max-[767px]:w-full max-[767px]:max-w-[340px]">
          <Link href="/docs" className="inline-flex max-[767px]:w-full max-[767px]:justify-center">
            <Button>Read docs</Button>
          </Link>
          <Button href="https://demo.hexos.xyz" variant="secondary">
            View demo
          </Button>
        </div>
        <pre className="p-0 m-0 text-[#252a36] dark:text-[#e0e9ff] [html.dark_&]:text-[#e0e9ff] [html[data-theme=dark]_&]:text-[#e0e9ff]">
          <span className="select-none text-[#6a7388] dark:text-[#9db0dc] [html.dark_&]:text-[#9db0dc] [html[data-theme=dark]_&]:text-[#9db0dc]">
            ~{' '}
          </span>
          npx @hexos/create my-chat
        </pre>

        <div className="w-full max-w-[1080px] flex flex-col items-center mt-1 text-center max-[767px]:px-1">
          <div
            className={[
              'w-full rounded-[14px] overflow-hidden',
              'border border-[#d8dbe4] bg-white',
              'shadow-[0_18px_52px_rgba(19,26,40,0.14)]',
              'dark:border-[#31384b] dark:shadow-[0_18px_52px_rgba(0,0,0,0.45)]',
            ].join(' ')}
          >
            <div
              className={[
                'grid grid-cols-[auto_auto_auto_1fr] items-center gap-2',
                'border-b border-[#e5e8ef] px-3 py-2.5',
                'bg-gradient-to-b from-white to-[#f5f7fb]',
                'dark:border-b-[#2d3446]',
                'dark:bg-gradient-to-b dark:from-[#1b2231] dark:to-[#121725]',
              ].join(' ')}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#d0d4df] dark:bg-[#4c5874]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#d0d4df] dark:bg-[#4c5874]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#d0d4df] dark:bg-[#4c5874]" />
              <div
                className={[
                  'justify-self-center rounded-full px-3 py-1 min-w-0',
                  'border border-[#dce0ea] bg-white',
                  'text-xs text-[#677083] leading-none truncate',
                  'dark:border-[#3a4359] dark:bg-[#111725] dark:text-[#a7b2ca]',
                ].join(' ')}
              >
                demo.hexos.xyz
              </div>
            </div>
            <iframe
              src="https://demo.hexos.xyz"
              className={[
                'block w-full border-0 bg-[#eff1f7]',
                'h-[min(620px,50vw)] min-h-[360px]',
                'max-[767px]:h-[74vw] max-[767px]:min-h-[420px] max-[767px]:max-h-[560px]',
              ].join(' ')}
              title="Hexos demo"
              loading="lazy"
            />
          </div>
        </div>
      </section>
    </GridPatternLinearGradient>
  );
};
