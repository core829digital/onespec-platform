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

export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${spaceGrotesk.variable} ${inter.variable} ${ibmPlexMono.variable} tw-widget-root min-h-screen`}
      style={{ background: "var(--color-bg)" }}
      data-widget-root
    >
      {children}
    </div>
  );
}
