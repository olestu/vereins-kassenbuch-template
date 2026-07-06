import type { ReactNode } from "react";
import { ButtonLink } from "./button";

export function EmptyState({
  icon,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-(--radius-card) border border-dashed border-line bg-surface px-6 py-12 text-center">
      {icon && <div className="text-ink-muted">{icon}</div>}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && (
        <p className="max-w-xs text-sm text-ink-secondary">{description}</p>
      )}
      {actionHref && actionLabel && (
        <ButtonLink href={actionHref} className="mt-2">
          {actionLabel}
        </ButtonLink>
      )}
    </div>
  );
}
