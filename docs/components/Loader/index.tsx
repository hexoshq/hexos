import type { JSX } from "react";

export const Loader = ({
  color,
  size = 16,
  ...props
}: {
  color?: string;
  size?: number;
} & JSX.IntrinsicAttributes) => {
  return (
    <span
      className="bg-transparent rounded-full border-2 border-current border-b-transparent inline-block animate-loader-spin"
      style={{
        width: size,
        height: size,
        color,
      }}
      aria-label="loading"
      {...props}
    />
  );
};
