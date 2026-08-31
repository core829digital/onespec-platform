import type { ReactNode } from "react";

export function EmptyState({
  title,
  hint,
  action,
  icon,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="px-6 py-12 text-center">
      {icon ? <div className="mx-auto mb-3 text-[var(--color-text-secondary)]">{icon}</div> : null}
      <p className="text-[var(--color-text)] font-medium">{title}</p>
      {hint ? <p className="text-sm text-[var(--color-text-secondary)] mt-1 max-w-sm mx-auto">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
