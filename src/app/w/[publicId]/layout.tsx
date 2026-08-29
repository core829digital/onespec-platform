import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "../../globals.css";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-ibm-plex-mono" });

export default function WidgetLayout({ children, params }: { children: React.ReactNode; params: Promise<{ publicId: string }> }) {
  return (
    <html suppressHydrationWarning data-theme="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} antialiased bg-[var(--color-bg)]`}>
        {children}
      </body>
    </html>
  );
}
