"use client";

import { useEffect, useState } from "react";
import { ACTION_ERROR_EVENT } from "@/lib/action-toast";

export function ActionToaster() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onError = (e: Event) => {
      setMessage((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(""), 8000);
    };
    window.addEventListener(ACTION_ERROR_EVENT, onError);
    return () => {
      window.removeEventListener(ACTION_ERROR_EVENT, onError);
      clearTimeout(timer);
    };
  }, []);

  if (!message) return null;
  return (
    <div
      role="alert"
      className="fixed left-1/2 top-4 z-[100] flex max-w-[90vw] -translate-x-1/2 items-start gap-3 rounded-lg border border-[var(--color-danger)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-danger)] shadow-lg"
    >
      <span>{message}</span>
      <button type="button" onClick={() => setMessage("")} aria-label="Close" className="font-bold leading-none">
        ×
      </button>
    </div>
  );
}
