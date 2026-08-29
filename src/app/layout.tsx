import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "onespec — Il configuratore di infissi per il tuo sito",
  description: "Widget di configurazione infissi integrabile via iframe: preventivi automatici, prezzi sempre aggiornati, brandizzabile per la tua azienda.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
      </body>
    </html>
  );
}