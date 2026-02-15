'use client';

import { GridPattern } from './grid-pattern';
import { cn } from '@/docs/lib/utils';

export function GridPatternLinearGradient({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex w-full items-center justify-center overflow-hidden bg-background px-0 py-6 sm:px-6 sm:py-10 md:rounded-lg md:p-20">
      <GridPattern
        width={20}
        height={20}
        x={-1}
        y={-1}
        className={cn(
          // light mode: centro transparente, bordas visíveis
          '[mask-image:radial-gradient(circle_at_center,transparent_40%,white_100%)]',
          // dark mode
          'dark:[mask-image:radial-gradient(circle_at_center,transparent_40%,black_100%)]'
        )}
      />
      {children}
    </div>
  );
}
