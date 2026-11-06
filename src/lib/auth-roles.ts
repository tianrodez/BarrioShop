/**
 * Role model for the signed-in user (formulation doc §8).
 *
 * The authoritative role lives in the `profiles` table — never in the JWT —
 * and a client-side-only union is all the UI is allowed to see. Keep this
 * module free of server-only imports so forms and unit tests can use it.
 */
export type StoreRole = "cliente" | "comerciante" | "administrador";

/**
 * Where a user lands right after signing in (HU01 CA4): merchants go to
 * their panel, clients go to the public directory (the home page).
 */
export function homePathForRole(role: StoreRole): string {
  return role === "cliente" ? "/" : "/panel";
}

/** Clients can browse and order, but the merchant panel is not for clients. */
export function panelPathForRole(role: StoreRole): "/panel" | "/" {
  return role === "cliente" ? "/" : "/panel";
}

/** Spanish label used in the header and the panel. */
export function roleLabel(role: StoreRole): string {
  switch (role) {
    case "administrador":
      return "Administrador";
    case "comerciante":
      return "Comerciante";
    default:
      return "Cliente";
  }
}
