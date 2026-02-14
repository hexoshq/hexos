import React from "react";

interface GenerationInfoProps {
  sourceFile: string;
  sourceLine: string;
  packageName: string;
  since?: string;
  experimental?: string;
}

export function GenerationInfo({
  packageName,
  since,
  experimental,
}: GenerationInfoProps) {
  return (
    <div className="text-[0.85em] text-[#666] mb-4 flex gap-2 flex-wrap">
      {packageName && (
        <span>
          Package: <code>{packageName}</code>
        </span>
      )}
      {since && <span>| Since: {since}</span>}
      {experimental === "true" && (
        <span>
          | <em>Experimental</em>
        </span>
      )}
    </div>
  );
}
