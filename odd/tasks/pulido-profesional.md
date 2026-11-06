# Pulido profesional BarrioShop — feature document

Objetivo: elevar la calidad percibida de toda la app sin cambiar el mundo visual del mockup (crema/terracota/serif): una sola tarjeta de tienda, jerarquía clara, estados consistentes y un cierre de página. Rama `feat/hu02-store`. Runner: Vitest + Playwright contra Supabase local descartable.

## Specs

- **S1 — Sistema.** Sombras cálidas (`shadow-soft`/`shadow-lift`) y superficie (`bg-surface`) como tokens; una única `StoreCard` compartida por landing y directorio (hoy son dos implementaciones distintas del mismo objeto); precios con `tabular-nums`.
- **S2 — Landing.** La banda del buscador usa `bg-surface`; contador de resultados visible; tarjetas compartidas con enlace estirado (toda la tarjeta navega al perfil).
- **S3 — Directorio.** Filtros agrupados en una tarjeta con etiquetas claras; resultados en rejilla con la `StoreCard`; contador junto al título; mapa dentro de una tarjeta; se conservan `Buscar`/`Barrio`/`Categoría`, `Destacada`, distancias, mapa y "Limpiar filtros".
- **S4 — Perfil de tienda.** Cabecera con icono del comercio, nombre en serif y meta (`Tipo · Barrio`); acciones jerarquizadas (WhatsApp primario, directorio secundario, reportar terciario); ficha de ubicación con iconos y el mapa dentro de la misma sección `Ubicación`; catálogo con precio destacado, estado como píldora y nota de precio en tono bajo.
- **S5 — Pedido.** Resumen y datos en tarjetas, total jerarquizado, precios tabulares; el paso sigue siendo público y el `wa.me` no cambia.
- **S6 — Global.** Footer del sitio en todas las páginas, enlace "Saltar al contenido", foco visible, sin regresiones de roles/etiquetas que usan las pruebas ni del E2E (T1–T5, viewports, `region "Tu pedido"`, `region "Ubicación"`, `group` por producto, `Destacada`, `a 350 m`).

## Tasks

| ID | Specs | Trabajo | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- | --- |
| T1 | S1 | Tokens de sombra/superficie y `StoreCard` compartida | inline | done (RED del contrato de tarjeta) | 48310d0 |
| T2 | S2 | Landing con tarjeta compartida, contador y banda | inline | done | 48310d0 |
| T3 | S3 | Directorio con filtros en tarjeta y rejilla | inline | done | 48310d0 |
| T4 | S4 | Perfil de tienda y catálogo | inline | done | a6dbbb4 |
| T5 | S5–S6 | Pedido, footer y salto al contenido | inline | done | d704d3d |
| T6 | S6 | Playwright, capturas y docs | inline | done (8/8; detector limpio) | — |

## Log

- **L1** Pedido del humano, textual: «en base a eso ahora gemera los ajustes profesionales para el diseno de la aplicacion. Debes pulirla y hacerla atractiva». Contexto: `PRODUCT.md` (tono de barrio, sin comisiones, WhatsApp como checkout, confianza hiperlocal) y el mockup ya implementado en U11.
- **L2** Alcance: pulido, no rediseño. Se conserva el mundo visual del mockup y todo el comportamiento. Prioridad del playbook `polish`: defectos funcionales → estados → jerarquía/drift de sistema → inconsistencia visual → limpieza. Se revisan las capturas de U11 y se detectan: dos lenguajes de tarjeta para el mismo objeto (landing vs directorio), ausencia de footer, precios sin cifras tabulares y una ficha de perfil con jerarquía plana.
- **L3** T1: RED en `store-card.test.tsx` (componente inexistente). GREEN con tokens `shadow-soft`/`shadow-lift` (sombra teñida del color del texto, nunca negro puro), `bg-surface` y una única `StoreCard` con enlace estirado (`after:inset-0`), icono en loseta cálida, badge ámbar y distancia condicional. Se conserva la distancia como nodo de texto propio porque el contrato del directorio la asserta así.
- **L4** T2/T3: la landing y el directorio dejan de tener dos implementaciones del mismo objeto. El directorio pasa a `max-w-5xl`, filtros en tarjeta, mapa en tarjeta, contador junto al título y rejilla de tarjetas (1/2/3 columnas). Se acorta el placeholder del buscador ("Nombre o categoría") porque con el ancho anterior se cortaba. Contador `aria-live` en la landing que distingue "abiertas en Kennedy" de "con esos filtros".
- **L5** T4: el perfil abre con cabecera de tienda (foto o icono del comercio), la ficha de ubicación usa `dl` con Dirección/Referencia/UPZ/Horario etiquetados y el mapa vive dentro de la misma sección `Ubicación` (el contrato de la prueba se conserva). El catálogo vuelve a tarjetas: precio destacado con `tabular-nums`, estado como píldora, nota de precio en tono bajo y acciones en su propia fila. El resumen del pedido es una tarjeta con el total separado por una regla.
- **L6** T5: footer global (marca, promesa real, navegación y "Kennedy · Bogotá") y enlace "Saltar al contenido" con `#contenido` envolviendo las páginas. El paso de pedido agrupa resumen y datos en tarjetas, con inputs de 11 y total jerarquizado. `OrderLines` deja de truncar el nombre en móvil: ahora ocupa su propia línea y hace wrap.
- **L7** Defecto real encontrado por la E2E, no por el ojo: el enlace del footer a `/panel/tienda` se prefetcheaba estando anónimo, Next cacheaba el redirect a `/login` y ese salto cacheado ganaba justo después del registro (T1 terminaba en `/login`). Se corrigió con `prefetch={false}` en ese enlace y T1 ahora limita el clic al `banner`, porque el footer agregó un segundo "Registra tu tienda" y el selector por `navigation` se volvió ambiguo. Ambos cambios son de comportamiento, no cosméticos.
- **L8** Verificación: Vitest 230/230 (32 archivos), typecheck, lint, Playwright **8/8** contra el Supabase local descartable, capturas revisadas a 1440 y 390 de inicio, directorio, perfil, pedido y login, y `impeccable detect` devolvió `[]`. Nota operativa: `npm run build` lee `.env.hosted.local` y compila contra el hosted vacío; para revisar con datos hay que construir con `npx next build` y las variables locales, como hace el `webServer` de Playwright. Los datos de demostración se limpiaron de los restos que dejan T1–T3.
