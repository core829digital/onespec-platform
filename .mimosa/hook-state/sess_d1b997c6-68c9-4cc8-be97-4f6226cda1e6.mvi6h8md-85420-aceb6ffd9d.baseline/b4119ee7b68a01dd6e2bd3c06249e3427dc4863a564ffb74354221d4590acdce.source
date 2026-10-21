import type { Metadata } from "next";
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

// Public demos embedded on onespec.eu: never indexed on their own.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${spaceGrotesk.variable} ${inter.variable} ${ibmPlexMono.variable} tw-widget-root`}
      style={{ background: "var(--color-bg)" }}
    >
      {/* Framed at its full content height by onespec.eu: the frame itself must never
          scroll, otherwise it swallows the mouse wheel instead of scrolling the page. */}
      <style>{"html,body{overflow:hidden!important;overscroll-behavior:auto}"}</style>
      {children}
    </div>
  );
}
