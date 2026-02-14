"use client"

import { GridPattern } from "./grid-pattern"
import { cn } from "@/docs/lib/utils"

export function GridPatternLinearGradient({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex size-full items-center justify-center overflow-hidden rounded-lg bg-background p-20">
      <GridPattern
        width={20}
        height={20}
        x={-1}
        y={-1}
        className={cn(
          // light mode: centro transparente, bordas visíveis
          "[mask-image:radial-gradient(circle_at_center,transparent_40%,white_100%)]",
          // dark mode
          "dark:[mask-image:radial-gradient(circle_at_center,transparent_40%,black_100%)]"
        )}
      />
      {children}
    </div>
  )
}
