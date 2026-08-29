import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-7 w-auto", className)}>
      <Image
        src="/onespec-logo.png"
        alt="onespec"
        width={2000}
        height={700}
        priority
        className="logo-dark h-full w-auto"
      />
      <Image
        src="/onespec-logo-light.png"
        alt="onespec"
        width={2000}
        height={700}
        priority
        className="logo-light h-full w-auto"
      />
    </span>
  );
}