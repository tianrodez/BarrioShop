# BarrioShop

Plataforma web para pequeños comercios de la localidad de Kennedy (Bogotá): cada tendero crea su tienda en línea, muestra su catálogo con precios del día y recibe pedidos por WhatsApp, sin comisiones ni intermediarios.

Proyecto académico — Facultad de Ingeniería, Universidad Iberoamericana. Proyecto de Software, oct. 2026 – mar. 2027.

> **Estado:** prototipo funcional con las 11 HU implementadas: registro e inicio de sesión, creación y verificación de tienda, catálogo, directorio con mapa de Kennedy, pedido por WhatsApp, panel del comerciante y consola de administración. Verificado con Vitest, Playwright y la suite SQL de RLS.

## Stack

| Capa               | Tecnología                                                      | Rol en el proyecto                                                                                                                          |
| ------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | **Next.js 16 (App Router) + TypeScript**                        | Un único proyecto con frontend y backend como funciones (Route Handlers / Server Actions)                                                   |
| UI                 | **Tailwind CSS v4 + shadcn/ui**                                 | Responsive mobile-first (HU08 / RNF-06) y componentes accesibles                                                                            |
| Base de datos      | **Supabase — PostgreSQL + PostGIS**                             | Tiendas, productos, estados; distancias calculadas en BD (HU10 / §9)                                                                        |
| Autenticación      | **Supabase Auth + `@supabase/ssr`**                             | Roles cliente / comerciante / administrador con cookies compartidas cliente-servidor y autorización verificada en servidor/RLS (HU01, HU09) |
| Archivos           | **Supabase Storage**                                            | Fotos de productos y tiendas, comprimidas a ~500 KB antes de subir (§29)                                                                    |
| Seguridad de datos | **RLS (Row Level Security)**                                    | Un comerciante no puede leer/editar la tienda de otro (RNF-02), aplicado en el motor, no en la UI                                           |
| Mapas              | **Leaflet + OpenStreetMap + Nominatim**                         | Marcadores por tienda y límite oficial de la localidad de Kennedy (§29)                                                                     |
| Validación         | **Zod**                                                         | Reglas de los formularios de tienda y producto, con errores por campo                                                                       |
| Tests              | **Vitest + Testing Library**, **Playwright** y suite SQL de RLS | Unitarios/componentes, E2E sobre build de producción y verificación de políticas                                                            |
| Despliegue         | **Vercel** + dominio propio                                     | Conforme a §29; plan Hobby durante desarrollo                                                                                               |

## Requisitos previos

- **Node.js ≥ 20.9** (probado con v26) y npm.
- Un proyecto **Supabase hosted** con PostGIS (la migración inicial crea la extensión).
- **Supabase CLI** para aplicar migraciones y, si se quiere, para el entorno local de pruebas.
- **Docker** solo si vas a correr el harness de RLS o la app en Compose; no es necesario para desplegar en Vercel.

## Variables de entorno

La aplicación solo necesita dos variables públicas. La Publishable key (o la `anon` legacy) es pública por diseño: el aislamiento por tienda se impone con políticas RLS, nunca confiando en la cookie. La Secret key / `service_role` **no se usa en esta app** y nunca debe exponerse en el navegador.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Para desarrollo local, guárdalas en `.env.hosted.local` (ignorado por Git). `npm run dev` y `npm run build` leen ese archivo. En Vercel se configuran en **Project Settings → Environment Variables** para Production y Preview.

`NEXT_PUBLIC_*` se incrusta en el bundle en tiempo de build: si cambias la URL o la key, hay que volver a desplegar.

## Puesta en marcha de Supabase

Las migraciones crean el esquema, las políticas RLS, los RPC del administrador y los buckets de Storage. La aplicación **no** aplica migraciones al arrancar: es un paso de administración separado.

```bash
npx supabase login
npx supabase link --project-ref TU-PROJECT-REF
npx supabase db push --dry-run
npx supabase db push
```

Si prefieres no usar el access token de la CLI, puedes pasar la cadena de conexión (Session pooler) directamente:

```bash
npx supabase db push \
  --db-url "postgresql://postgres.TU-REF:TU-PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
```

El access token y la DB password son credenciales administrativas: no van en Vercel ni en el repositorio. La app en ejecución no las necesita.

### Datos demo (opcional)

Para una demostración, ejecuta en orden desde el **SQL Editor** del proyecto hosted:

1. `supabase/tests/900_demo_users.sql` — crea las cuentas demo.
2. `supabase/seed_demo.sql` — crea las tiendas y el catálogo de ejemplo.

Son idempotentes. La contraseña de las cuentas demo está en `supabase/tests/900_demo_users.sql`; no las uses en un entorno real.

### Cuenta de administrador (HU09 CA4)

No hay auto-registro de administradores. Primero crea la cuenta normalmente desde `/registro` y luego promuévela desde el SQL Editor:

```sql
update public.profiles
set role = 'administrador'
where id = (select id from auth.users where email = 'tu-correo@ejemplo.com');
```

Con esa sesión, `/panel` muestra la consola de administración. `/admin` no existe: el rol se resuelve en el servidor y el panel redirige a cada rol a su vista.

### URLs de autenticación

En **Authentication → URL Configuration**:

- **Site URL:** `https://tu-app.vercel.app`
- **Redirect URLs:** `https://tu-app.vercel.app/**` y, si usas previews, `https://*-TU-EQUIPO.vercel.app/**`

Si tienes activada la confirmación por correo, el enlace de confirmación usa el Site URL. En el proyecto local viene desactivada (`supabase/config.toml`), por eso el registro inicia sesión de inmediato.

## Desarrollo local

### Contra Supabase hosted

```bash
# .env.hosted.local con NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

El script de arranque valida que la URL sea HTTPS y de Supabase hosted; los endpoints locales se rechazan a propósito para no mezclar entornos.

### Contra Supabase local (solo pruebas)

El entorno E2E usa un stack local desechable, nunca el proyecto hosted:

```bash
npx supabase start
npx supabase db reset     # aplica migraciones + seed demo
npx playwright test       # compila y sirve la app contra el stack local
```

Para levantar la UI contra Supabase local sin el validador de hosted:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key-local> \
npx next dev
```

## Scripts

```bash
npm run dev            # Next.js/Turbopack contra Supabase hosted (.env.hosted.local)
npm run build          # build de producción con el mismo perfil
npm run compose:app    # app en Docker Compose con .env.hosted.local
npm test               # Vitest, una pasada
npm run test:watch     # Vitest en modo vigilancia
npm run test:coverage  # cobertura de src/lib
npm run test:e2e       # Playwright (requiere Supabase local)
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint
npm run format         # Prettier
```

## Verificación

```bash
npm test
npm run typecheck
npm run lint
npm run build
npx playwright test
docker compose up --abort-on-container-exit --exit-code-from verify
```

El último comando levanta un PostGIS desechable (tmpfs) y corre la suite conductual de RLS. No reemplaza el runtime de Supabase: solo valida migraciones y políticas. `supabase/tests/rls_test.sql` es un arnés de pruebas y no se aplica a producción.

## Despliegue en Vercel

1. **Importa el repositorio** en Vercel. Next.js se detecta solo; no hace falta `vercel.json`.
2. **Build command:** `npm run build`. **Install command:** `npm install`. Node 20.9 o superior (la versión se fija en la configuración del proyecto).
3. **Environment Variables** (Production y Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. **Aplica las migraciones** antes del primer uso (sección anterior). Vercel no las ejecuta.
5. **Configura el Site URL** de Supabase con el dominio de Vercel (sección anterior) y vuelve a desplegar si cambiaste variables `NEXT_PUBLIC_*`.
6. Si usas dominio propio, agrégalo en Vercel y actualiza el Site URL/Redirect URLs de Supabase.

Notas:

- `next.config.ts` declara `output: "standalone"` para el contenedor Docker; Vercel lo ignora y usa su propio empaquetado.
- La app desplegada solo usa la URL y la Publishable key. No necesita DB password, access token ni `service_role`.
- La región de Vercel se elige en la configuración del proyecto (la formulación fija São Paulo, `gru1`).
- Las migraciones, el seed demo y la promoción de administradores son operaciones de administración, no parte del runtime.

## Estructura

```
src/
  app/                 # App Router: /, /directorio, /tienda/[id], /pedido/[id], /panel/*, /login, /registro
  components/          # incluye site-header.tsx y site-footer.tsx (envoltura global)
    ui/                # shadcn/ui + file-field.tsx (zona de carga con preview)
    admin/             # consola del administrador: revisión, reportes y destacadas (HU09, HU11, HU07)
    auth/              # registro e inicio de sesión con pestañas (HU01)
    directory/         # directorio con filtros, cercanía, destacadas y mapa (HU04, HU05, HU07, HU10)
    home/              # landing: hero, buscador, chips y tarjetas de tiendas (HU04/HU07)
    order/             # catálogo con carrito y paso de pedido por WhatsApp (HU06)
    products/          # panel de catálogo del comerciante (HU03)
    reports/           # botón Reportar y diálogo modal (HU11)
    stores/            # perfil de tienda, tarjeta compartida y mapas (HU02, HU05, HU09)
  lib/
    supabase/          # factories de cliente/servidor (patrón oficial @supabase/ssr)
    kennedy-map.ts     # polígono oficial de Kennedy, máscara y validación del punto
    store-form-schema.ts / product-form-schema.ts # validación Zod de los formularios
    currency.ts        # formato de precios COP (HU03/HU06)
    order-model.ts     # carrito, total, mensaje de pedido y payload de order_events (HU06)
    order-cart-store.ts# carrito del navegador, por tienda, leído con useSyncExternalStore (HU06)
    product-catalog-model.ts # columnas y etiquetas del catálogo (HU03)
    report-model.ts    # validación y forma de la fila de store_reports (HU11)
    store-directory-model.ts # modos de cercanía, filtros y etiqueta de distancia (HU04/HU10)
    store-type-icon.ts # icono por tipo de comercio para las tarjetas (HU07)
    whatsapp.ts        # deep link wa.me (HU02 CA3 / HU06 CA4)
  proxy.ts             # refresh de sesión y protección de rutas (Next 16)
e2e/                   # Playwright: T1-T8 + auditoría de viewports
supabase/
  migrations/          # 8 migraciones: esquema, RLS, RPC, storage, mapa y coordenadas
  seed_demo.sql        # datos demo (La Espiga, Fruver El Campo, NEARBUY...)
  tests/               # harness local: auth emulation + suite RLS + usuarios demo
docker-compose.yml     # db (PostGIS desechable) + verify (migraciones+RLS) + app
Dockerfile             # imagen standalone de la app
```

## Documentación del proyecto

- `historias-de-usuario.md` — 11 HU con criterios y trazabilidad a la formulación.
- `todo.md`, `avances.md` y `PRODUCT.md` — notas internas de trabajo, todavía en `.gitignore`; deben publicarse antes de la entrega final (RNF-08).
- Formulación: "Formulacion de proyecto.pdf" (raíz del proyecto, no versionado).

## Equipo

Yenny Serrano (líder) · Sebastián Castro (full-stack) · Felix Santafé (full-stack) · William Camargo (QA).
