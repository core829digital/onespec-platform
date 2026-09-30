"use client";

import { LocalizedError } from "@/components/localized-error";

export default function LocaleError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <LocalizedError kind="page" {...props} />;
}
