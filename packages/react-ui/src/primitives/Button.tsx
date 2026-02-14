import React from 'react';
import { Slot } from '@radix-ui/react-slot';

/**
 * @description
 * Props for the {@link Button} component.
 *
 * Extends standard HTML button attributes with variant, size, and Radix UI Slot support.
 *
 * @docsCategory ui-primitives
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Render as child element (Radix Slot pattern) */
  asChild?: boolean;
  /** Visual variant */
  variant?: 'default' | 'destructive' | 'outline' | 'ghost';
  /** Size preset */
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const BASE_CLASSES =
  'ax-inline-flex ax-items-center ax-justify-center ax-gap-2 ax-whitespace-nowrap ax-font-medium ax-transition-colors ax-border ax-cursor-pointer disabled:ax-pointer-events-none disabled:ax-opacity-50';

const VARIANT_CLASSES: Record<string, string> = {
  default: 'ax-bg-blue-500 ax-text-white ax-border-blue-500 hover:ax-bg-blue-600',
  destructive: 'ax-bg-red-500 ax-text-white ax-border-red-500 hover:ax-bg-red-600',
  outline: 'ax-bg-white ax-text-gray-700 ax-border-gray-200 hover:ax-bg-gray-50',
  ghost: 'ax-bg-transparent ax-text-gray-700 ax-border-transparent hover:ax-bg-gray-100',
};

const SIZE_CLASSES: Record<string, string> = {
  default: 'ax-h-10 ax-px-4 ax-py-2 ax-text-sm ax-rounded-md',
  sm: 'ax-h-8 ax-px-3 ax-py-1 ax-text-xs ax-rounded-md',
  lg: 'ax-h-12 ax-px-6 ax-py-3 ax-text-base ax-rounded-md',
  icon: 'ax-h-10 ax-w-10 ax-rounded-md ax-text-sm',
};

/**
 * @description
 * Generates CSS class string for button variants.
 *
 * Combines base styles with variant and size-specific classes. Used internally by {@link Button}
 * and can be used externally for custom button implementations.
 *
 * @param variant - Visual variant identifier
 * @param size - Size preset identifier
 * @returns Combined CSS class string
 *
 * @docsCategory ui-primitives
 */
function buttonVariants(variant: string, size: string): string {
  return `${BASE_CLASSES} ${VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.default} ${SIZE_CLASSES[size] ?? SIZE_CLASSES.default}`;
}

/**
 * @description
 * Styled button component with variant and size presets.
 *
 * Provides consistent button styling across the Hexos UI system. Supports Radix UI Slot pattern
 * for composition with other components (e.g., rendering as a Link).
 *
 * When `asChild` is true, the button renders its single child and merges props, enabling
 * polymorphic behavior without wrapper elements.
 *
 * @example
 * ```tsx
 * <Button variant="default" size="lg" onClick={handleClick}>
 *   Submit
 * </Button>
 * ```
 *
 * @example Using Radix Slot pattern
 * ```tsx
 * <Button asChild variant="outline">
 *   <a href="/link">Navigate</a>
 * </Button>
 * ```
 *
 * @docsCategory ui-primitives
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={`${buttonVariants(variant, size)} ${className}`}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
