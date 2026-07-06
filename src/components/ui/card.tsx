import type { HTMLAttributes } from "react";

export function Card({
  className = "",
  hover = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={`rounded-(--radius-card) border border-line bg-surface shadow-(--shadow-card) ${
        hover ? "transition-shadow hover:shadow-(--shadow-card-hover)" : ""
      } ${className}`}
      {...props}
    />
  );
}
