import { Suspense } from "react";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The mockup draws the brand and every heading in a high-contrast serif; the
// body copy stays on Geist so long text and controls keep their density.
const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BarrioShop",
  description:
    "Tiendas del barrio: directorio, cercanía y pedidos por WhatsApp desde el celular.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* The header is session-aware and reads cookies, so it streams inside
            a boundary instead of blocking the static shell. */}
        <a
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-primary focus:px-5 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
          href="#contenido"
        >
          Saltar al contenido
        </a>
        <Suspense
          fallback={
            <header className="sticky top-0 z-10 flex min-h-14 items-center border-b bg-background/95 px-4 py-2">
              <span className="font-heading text-xl font-bold tracking-tight text-primary">
                BarrioShop
              </span>
            </header>
          }
        >
          <SiteHeader />
        </Suspense>
        <div className="flex flex-1 flex-col" id="contenido">
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
