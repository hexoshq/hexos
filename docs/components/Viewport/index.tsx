import { ReactNode } from "react";

export const Viewport = ({
  children,
  mobile,
  desktop,
}: {
  children: ReactNode;
  mobile?: boolean;
  desktop?: boolean;
}) => {
  const className = [
    "hidden",
    mobile && "block md:hidden",
    desktop && "md:block",
    mobile && desktop && "block",
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={className}>{children}</div>;
};
