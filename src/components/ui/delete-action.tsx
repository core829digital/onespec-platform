"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { requestConfirm } from "@/lib/confirm-dialog";
import { emitActionError } from "@/lib/action-toast";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { cn } from "@/lib/utils";
import { DANGER_ACTION_CLASS } from "@/components/ui/open-button";

/**
 * The one "Delete" of every list: asks for confirmation (styled dialog, never the native one), runs the mutation, and turns a refusal
 * from the server (signed quote, supply running…) into the same friendly toast everywhere. The row disappears by itself: the lists are live Convex queries.
 */
export function DeleteAction({
  onDelete,
  message,
  label,
  iconOnly = false,
  className,
  testId,
}: {
  onDelete: () => Promise<unknown>;
  /** The confirmation question, already translated. */
  message: string;
  label?: string;
  iconOnly?: boolean;
  className?: string;
  testId?: string;
}) {
  const t = useTranslations("common");
  const toMessage = useFriendlyError();
  const [busy, setBusy] = useState(false);
  const text = label ?? t("delete");
  return (
    <button
      type="button"
      data-testid={testId ?? "delete-action"}
      disabled={busy}
      aria-label={iconOnly ? text : undefined}
      title={iconOnly ? text : undefined}
      onClick={async () => {
        if (busy) return;
        if (!(await requestConfirm(message, { danger: true, confirmLabel: text }))) return;
        setBusy(true);
        try {
          await onDelete();
        } catch (e) {
          emitActionError(toMessage(e));
        } finally {
          setBusy(false);
        }
      }}
      className={cn(DANGER_ACTION_CLASS, className)}
    >
      <Trash2 size={14} aria-hidden="true" />
      {iconOnly ? null : text}
    </button>
  );
}
