import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { roleLabel } from "@/lib/auth-roles";
import { LogoutButton } from "@/components/auth/logout-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

/**
 * Session-aware header. It reads cookies, so the layout renders it inside a
 * <Suspense> boundary (Cache Components): the static shell streams first and
 * only this strip waits for the session.
 */
export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex min-h-14 w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2">
        <Link
          href="/"
          className="font-heading text-xl font-bold tracking-tight text-primary"
        >
          BarrioShop
        </Link>

        <nav className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/directorio"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Directorio
          </Link>
          {user ? (
            <>
              <Badge variant="secondary" className="hidden sm:inline-flex">
                {roleLabel(user.role)}
              </Badge>
              {user.role === "cliente" ? (
                <Link
                  href="/panel/tienda"
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Registra tu tienda
                </Link>
              ) : (
                <Link
                  href="/panel"
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Mi panel
                </Link>
              )}
              <LogoutButton />
            </>
          ) : (
            <Link
              href="/login"
              className={buttonVariants({
                className: "rounded-full px-5",
              })}
            >
              Ingresar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
