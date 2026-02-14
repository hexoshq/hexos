import { useEffect, useState } from "react";

import packageJson from "../../package.json";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://hexos.iludolf.com.br";

const { version } = packageJson;

const baseClasses = [
  "appearance-none",
  "bg-no-repeat bg-[length:12px] bg-[position:calc(100%-12px)_calc(50%+3px)]",
  "bg-hexos-grey-11 rounded-full text-black",
  "ps-4 pe-4 h-[33px] w-[156px]",
  "[background-image:url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23c3c3c3'><polygon points='0,0 100,0 50,50'/></svg>\")]",
].join(" ");

const variantClasses = {
  default: "",
  light: "bg-white border border-hexos-grey-10",
} as const;

export const ReleaseSwitcher = ({
  variant = "default",
}: {
  variant?: "light" | "default";
}) => {
  const isCanary = process.env.NEXT_PUBLIC_IS_CANARY === "true" || false;
  const isLatest = process.env.NEXT_PUBLIC_IS_LATEST === "true" || false;

  const currentValue = isCanary ? "canary" : isLatest ? "" : version;

  const [options, setOptions] = useState<{ value: string; label: string }[]>([
    {
      label: "canary",
      value: "canary",
    },
    ...(isCanary
      ? []
      : [
          {
            label: isLatest ? `${version} (latest)` : version,
            value: isLatest ? "" : version,
          },
        ]),
  ]);

  useEffect(() => {
    fetch(`${BASE_URL}/api/releases`)
      .then(async (res) => {
        const { releases } = await res.json();
        const releaseOptions = Object.keys(releases).map((key) => ({
          label: key,
          value: key,
        }));

        releaseOptions[1].label = `${releaseOptions[1].label} (latest)`;
        releaseOptions[1].value = ""; // Okay to set to "" because isLatest will be true for this release option

        setOptions(releaseOptions);
      })
      .catch((e) => {
        console.error(`Could not load releases: ${e}`);
      });
  }, []);

  return (
    <select
      className={`${baseClasses} ${variantClasses[variant]}`}
      value={currentValue}
      onChange={(e) => {
        const newHref = e.currentTarget.value
          ? `/v/${e.currentTarget.value}`
          : "https://hexos.iludolf.com.br";

        if (window.parent) {
          window.parent.location.href = newHref;
        } else {
          window.location.href = newHref;
        }
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};
