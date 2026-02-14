"use client";

import { ReactNode, useEffect, useState } from "react";

import { Loader } from "../Loader";
import { filterDataAttrs } from "@/docs/lib/filter-data-attrs";

const baseClasses = [
  "appearance-none border border-transparent rounded",
  "inline-flex items-center gap-2",
  "tracking-[0.05ch] font-sans text-sm font-normal",
  "box-border leading-none text-center no-underline",
  "transition-colors duration-50 ease-in cursor-pointer whitespace-nowrap m-0",
].join(" ");

const sizeClasses = {
  medium: "min-h-[34px] py-[7px] px-[19px]",
  large: "py-[11px] px-[19px]",
} as const;

const variantClasses = {
  primary: [
    "bg-hexos-azure-04 text-white",
    "hover:bg-hexos-azure-03 active:bg-hexos-azure-02",
    "dark:bg-hexos-azure-05 dark:hover:bg-hexos-azure-04 dark:active:bg-hexos-azure-03",
    "focus-visible:outline-2 focus-visible:outline-hexos-azure-05 focus-visible:outline-offset-2",
  ].join(" "),
  secondary: [
    "border-current text-current",
    "hover:bg-hexos-azure-12 hover:text-black",
    "active:bg-hexos-azure-11 active:text-black",
    "dark:hover:bg-hexos-azure-02 dark:hover:text-white",
    "dark:active:bg-hexos-azure-01 dark:active:text-white",
    "focus-visible:outline-2 focus-visible:outline-hexos-azure-05 focus-visible:outline-offset-2",
  ].join(" "),
} as const;

export const Button = ({
  children,
  href,
  onClick,
  variant = "primary",
  type,
  disabled,
  tabIndex,
  newTab,
  fullWidth,
  icon,
  size = "medium",
  loading: loadingProp = false,
  ...props
}: {
  children: ReactNode;
  href?: string;
  onClick?: (e: any) => void | Promise<void>;
  variant?: "primary" | "secondary";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  tabIndex?: number;
  newTab?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  size?: "medium" | "large";
  loading?: boolean;
}) => {
  const [loading, setLoading] = useState(loadingProp);

  useEffect(() => setLoading(loadingProp), [loadingProp]);

  const ElementType = href ? "a" : type ? "button" : "span";
  const dataAttrs = filterDataAttrs(props);

  const className = [
    baseClasses,
    sizeClasses[size],
    variantClasses[variant],
    disabled && "bg-hexos-grey-07 text-hexos-grey-03 cursor-not-allowed hover:bg-hexos-grey-07",
    fullWidth && "justify-center w-full",
  ]
    .filter(Boolean)
    .join(" ");

  const el = (
    <ElementType
      className={className}
      onClick={(e) => {
        if (!onClick) return;

        setLoading(true);
        Promise.resolve(onClick(e)).then(() => {
          setLoading(false);
        });
      }}
      type={type}
      disabled={disabled || loading}
      tabIndex={tabIndex}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noreferrer" : undefined}
      href={href}
      {...dataAttrs}
    >
      {icon && <div className="mt-0.5">{icon}</div>}
      {children}
      {loading && (
        <div className="ps-2">
          <Loader size={14} />
        </div>
      )}
    </ElementType>
  );

  return el;
};
