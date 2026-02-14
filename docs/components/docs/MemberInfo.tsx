import React from "react";

interface MemberInfoProps {
  kind: string;
  type: string;
  default?: string;
  since?: string;
  experimental?: string;
}

export function MemberInfo({
  type,
  default: defaultValue,
  since,
  experimental,
}: MemberInfoProps) {
  return (
    <div className="my-2 text-[0.9em]">
      <code dangerouslySetInnerHTML={{ __html: type }} />
      {defaultValue && (
        <span>
          {" "}
          (default: <code dangerouslySetInnerHTML={{ __html: defaultValue }} />)
        </span>
      )}
      {since && <span> | Since: {since}</span>}
      {experimental === "true" && (
        <span>
          {" "}
          | <em>Experimental</em>
        </span>
      )}
    </div>
  );
}
