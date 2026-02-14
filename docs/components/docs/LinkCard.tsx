import React from "react";
import Link from "next/link";

interface LinkCardProps {
  href: string;
  title: string;
}

export function LinkCard({ href, title }: LinkCardProps) {
  return (
    <Link
      href={href}
      className="block p-4 border border-[#e5e7eb] rounded-lg mb-2 no-underline text-inherit"
    >
      {title}
    </Link>
  );
}
