import Link from "next/link";

/**
 * The page used to end wherever the content ended. The footer closes it and
 * repeats the two promises the product actually keeps: no commission and
 * payment on delivery — nothing about shipping, guarantees or phone support
 * that BarrioShop does not offer.
 * modificacion aleatoria porque el puto github se pone sensible
 */
export function SiteFooter() {
  return (
    <footer className="mt-4 border-t bg-surface/60">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-3">
          <Link
            className="font-heading text-2xl font-bold tracking-tight text-primary"
            href="/"
          >
            BarrioShop
          </Link>
          <p className="max-w-sm text-sm text-muted-foreground">
            Las tiendas de Kennedy con los precios del día. Arma tu pedido y
            envíalo por WhatsApp: sin comisiones, pagas contra entrega.
          </p>
        </div>

        <nav
          aria-label="Enlaces del sitio"
          className="grid w-full grid-cols-2 gap-x-8 gap-y-2 text-sm sm:max-w-xs sm:justify-self-end"
        >
          <Link
            className="text-muted-foreground transition-colors hover:text-foreground"
            href="/directorio"
          >
            Directorio
          </Link>
          <Link
            className="text-muted-foreground transition-colors hover:text-foreground"
            href="/registro"
          >
            Crear cuenta
          </Link>
          <Link
            className="text-muted-foreground transition-colors hover:text-foreground"
            href="/login"
          >
            Ingresar
          </Link>
          {/* Session-dependent: prefetching it while anonymous caches the
              redirect to /login, and the cached hop can win right after a
              signup. */}
          <Link
            className="text-muted-foreground transition-colors hover:text-foreground"
            href="/panel/tienda"
            prefetch={false}
          >
            Registra tu tienda
          </Link>
        </nav>
      </div>

      <div className="border-t">
        <p className="mx-auto w-full max-w-6xl px-4 py-5 text-xs text-muted-foreground">
          Kennedy · Bogotá · Hecho para el comercio de barrio.
        </p>
      </div>
    </footer>
  );
}
