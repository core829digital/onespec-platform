import { Space_Grotesk, IBM_Plex_Mono, Inter } from "next/font/google";
import "@/components/widget/widget.css";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

/** Hosted single-page configurator — same widget, full-page chrome (no iframe). */
export default function HostedConfiguratorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${spaceGrotesk.variable} ${inter.variable} ${ibmPlexMono.variable} tw-widget-root min-h-dvh`}
      style={{ background: "var(--color-bg)" }}
      data-widget-root
    >
      <div className="mx-auto w-full max-w-3xl px-3 sm:px-5 py-6">{children}</div>
    </div>
  );
}
