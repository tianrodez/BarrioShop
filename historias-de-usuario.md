# Historias de Usuario — BarrioShop (v2)

Plataforma web para pequeños comercios de la localidad de Kennedy (Bogotá).
Versión 2, alineada con el documento de Formulación del Proyecto (oct. 30 de 2026). Fecha de corte: 4 de noviembre de 2026.

Las HU01–HU08 conservan su numeración original. Los criterios nuevos se marcan con **(nueva)** y los reescritos con **(corregida)** para poder revisar solo el delta.

## Resumen de cambios

| HU | Qué cambió | Por qué (formulación) |
|----|-----------|----------------------|
| HU01 | Ampliada a cliente + comerciante | §4: "registro de comerciantes y clientes" |
| HU02 | + tipo de comercio, + UPZ, + punto en mapa, + ocultar temporalmente | §7 formulario de registro, §9 coordenadas, §7 retiro |
| HU03 | + categoría y descripción, + disponible/agotado, + aviso de precio | §6 Gestión de Productos, tarea T3 |
| HU04 | Directorio solo de tiendas "Publicadas"; filtro de barrio explícito | §7 estados de tienda |
| HU05 | + mapa dentro del perfil de la tienda | Criterio "Visualización Geográfica" |
| HU06 | + paso de datos del cliente (nombre, dirección, método de pago), agotados no se agregan | §5 flujo de 4 pasos, §6 agotado |
| HU07 | + aparecen primero en el directorio | §7 etiqueta Destacada |
| HU08 | Sin cambios | RNF-06 |
| HU09 | **Nueva**: Publicación y verificación de tienda | §7 (3 etapas), §8 (admin) |
| HU10 | **Nueva**: Búsqueda por cercanía con fallbacks | §9, respaldo visible de la distancia "a 0.4 km" del mockup |
| HU11 | **Nueva**: Reportes y control de contenido | §8 matriz, riesgo "contenido falso" (nivel alto) |

---

## HU01 — Registro e inicio de sesión

| Campo | Contenido |
|-------|-----------|
| **ID** | HU01 |
| **Nombre** | Registro e inicio de sesión |
| **Historia** | Como comerciante o cliente, quiero registrarme e iniciar sesión en la plataforma para administrar mi tienda o hacer pedidos de forma segura. **(corregida)** |
| **Prioridad** | Alta |
| **Criterios de aceptación** | 1. El comerciante crea su cuenta con correo y contraseña, y luego registra su tienda.<br>2. El cliente crea su cuenta con correo y contraseña para hacer pedidos; puede navegar el directorio sin cuenta. **(nueva)**<br>3. El registro no deja continuar sin aceptar la política de tratamiento de datos.<br>4. Con datos correctos el comerciante entra a su panel y el cliente a la página de inicio; con datos incorrectos aparece un mensaje de error. **(corregida)** |

## HU02 — Perfil de la tienda

| Campo | Contenido |
|-------|-----------|
| **ID** | HU02 |
| **Nombre** | Perfil de la tienda |
| **Historia** | Como comerciante, quiero crear y editar el perfil de mi tienda para que los clientes conozcan mi negocio. |
| **Prioridad** | Alta |
| **Criterios de aceptación** | 1. El perfil guarda nombre, tipo de comercio, foto, dirección, barrio, UPZ, horario y número de WhatsApp. **(corregida)**<br>2. El comerciante marca el punto de su tienda en el mapa y la plataforma guarda sus coordenadas. **(nueva)**<br>3. La página pública de la tienda muestra la ubicación con su referencia, el horario, el catálogo y el contacto de WhatsApp apenas se guardan los cambios. **(corregida)**<br>4. Un comerciante no puede editar la tienda de otro.<br>5. El comerciante puede ocultar temporalmente su tienda (viaje o arreglo) y volver a mostrarla desde su panel. **(nueva)** |

## HU03 — Catálogo de productos

| Campo | Contenido |
|-------|-----------|
| **ID** | HU03 |
| **Nombre** | Catálogo de productos |
| **Historia** | Como comerciante, quiero agregar, editar y borrar mis productos para mantener los precios del día actualizados. |
| **Prioridad** | Alta |
| **Criterios de aceptación** | 1. Cada producto se guarda con nombre, foto, precio y categoría; la descripción es opcional. **(corregida)**<br>2. El comerciante puede cambiar el precio, editar o borrar un producto en pocos pasos.<br>3. Los cambios aparecen de inmediato en el catálogo de la tienda.<br>4. Cada producto tiene estado disponible o agotado; el agotado se visualiza, pero no se puede agregar al pedido. **(nueva)**<br>5. Un producto cuyo precio cambió muestra el aviso "Última actualización de precio" con la fecha del cambio. **(nueva)** |

## HU04 — Directorio con filtros

| Campo | Contenido |
|-------|-----------|
| **ID** | HU04 |
| **Nombre** | Directorio con filtros |
| **Historia** | Como cliente, quiero buscar tiendas por categoría y barrio para encontrar lo que necesito cerca de mi casa. |
| **Prioridad** | Alta |
| **Criterios de aceptación** | 1. El directorio muestra las tiendas en estado "Publicada" de Kennedy. **(corregida)**<br>2. Al aplicar el filtro de categoría, el filtro de barrio o la búsqueda por texto, solo aparecen las tiendas que cumplen. **(corregida)**<br>3. Si ninguna tienda cumple el filtro, aparece un mensaje que lo indica con una opción para limpiar los filtros. **(corregida)** |

## HU05 — Mapa de tiendas

| Campo | Contenido |
|-------|-----------|
| **ID** | HU05 |
| **Nombre** | Mapa de tiendas |
| **Historia** | Como cliente, quiero ver las tiendas en un mapa para saber cuál me queda más cerca. |
| **Prioridad** | Media |
| **Criterios de aceptación** | 1. El mapa muestra un marcador por cada tienda en el punto registrado por el comerciante. **(corregida)**<br>2. Al tocar un marcador aparece el nombre de la tienda y un enlace a su perfil.<br>3. El mapa se puede mover y acercar desde el celular.<br>4. El perfil de cada tienda muestra su mapa con el marcador y la dirección registrada. **(nueva)** |

## HU06 — Pedido por WhatsApp

| Campo | Contenido |
|-------|-----------|
| **ID** | HU06 |
| **Nombre** | Pedido por WhatsApp |
| **Historia** | Como cliente, quiero armar un pedido y enviarlo por WhatsApp para comprar sin tener que ir al local. |
| **Prioridad** | Alta |
| **Criterios de aceptación** | 1. El cliente puede agregar productos y cambiar las cantidades antes de enviar; los productos agotados no se pueden agregar. **(corregida)**<br>2. El sistema calcula el total del pedido.<br>3. Antes de enviar, el cliente diligencia nombre, dirección y método de pago (domicilio contra entrega o recogida en el local); si tiene sesión iniciada, los datos se precargan. **(nueva)**<br>4. Al pulsar "Enviar pedido" se abre WhatsApp con el número de la tienda y el mensaje con productos, cantidades, total y datos del cliente ya escritos. **(corregida)** |

## HU07 — Tiendas destacadas

| Campo | Contenido |
|-------|-----------|
| **ID** | HU07 |
| **Nombre** | Tiendas destacadas |
| **Historia** | Como cliente, quiero ver tiendas destacadas en la página de inicio para descubrir negocios nuevos de mi barrio. |
| **Prioridad** | Baja |
| **Criterios de aceptación** | 1. La página de inicio muestra una sección de tiendas destacadas.<br>2. Cada tienda destacada lleva a su perfil al tocarla.<br>3. Las destacadas aparecen con la etiqueta "Destacada" y primero en el directorio. **(nueva)** |

## HU08 — Uso desde el celular

| Campo | Contenido |
|-------|-----------|
| **ID** | HU08 |
| **Nombre** | Uso desde el celular |
| **Historia** | Como usuario (cliente o comerciante), quiero usar la plataforma desde mi celular para hacer todo sin necesitar un computador. |
| **Prioridad** | Alta |
| **Criterios de aceptación** | 1. Todas las pantallas se ven completas en celular, tableta y computador.<br>2. Los botones y textos se pueden leer y tocar sin hacer zoom.<br>3. Las funciones principales trabajan igual en todos los dispositivos. |

## HU09 — Publicación y verificación de la tienda *(nueva)*

| Campo | Contenido |
|-------|-----------|
| **ID** | HU09 |
| **Nombre** | Publicación y verificación de la tienda |
| **Historia** | Como comerciante, quiero que mi tienda sea verificada y quede publicada para que los clientes del barrio la encuentren con confianza. |
| **Prioridad** | Alta |
| **Criterios de aceptación** | 1. Al registrar la tienda, el comerciante sube su soporte: si está formalizado, copia del RUT o certificado de Cámara de Comercio con la dirección del local; si no, foto de un recibo de servicio público con la dirección y foto de la fachada con la placa de dirección visible.<br>2. La tienda nueva queda en estado "En revisión" y no aparece en el directorio ni en el mapa hasta ser aprobada.<br>3. El administrador aprueba la tienda y su estado cambia a "Publicada"; si falta o no coincide algún dato, el comerciante recibe un aviso con lo que debe corregir, puede editar y volver a enviar.<br>4. El panel de administración solo se alcanza con credenciales válidas y las cuentas de administrador las crea el equipo (no hay auto-registro de administradores). |

## HU10 — Búsqueda por cercanía *(nueva)*

| Campo | Contenido |
|-------|-----------|
| **ID** | HU10 |
| **Nombre** | Búsqueda por cercanía |
| **Historia** | Como cliente, quiero ver las tiendas ordenadas de más cerca a más lejos para encontrar rápido lo que necesito cerca de mi casa. |
| **Prioridad** | Media |
| **Criterios de aceptación** | 1. La plataforma pide permiso al navegador antes de usar la ubicación del cliente.<br>2. Si el cliente concede el permiso, el directorio ordena las tiendas por cercanía y muestra la distancia en cada tarjeta (p. ej. "a 0.4 km").<br>3. Si el cliente niega el permiso o el dispositivo no obtiene la posición, la plataforma le pide elegir su barrio de una lista de barrios de Kennedy y ordena las tiendas por cercanía al punto de referencia de ese barrio.<br>4. Si tampoco elige un barrio, las tiendas se muestran en orden alfabético.<br>5. La ubicación del cliente no se guarda en la base de datos. |

## HU11 — Reportes y control de contenido *(nueva)*

| Campo | Contenido |
|-------|-----------|
| **ID** | HU11 |
| **Nombre** | Reportes y control de contenido |
| **Historia** | Como cliente o comerciante, quiero reportar una tienda o un producto con información falsa para que la plataforma siga siendo confiable. |
| **Prioridad** | Media |
| **Criterios de aceptación** | 1. En el perfil de la tienda y de cada producto hay una opción visible "Reportar".<br>2. Los reportes llegan a un panel del administrador donde puede revisar el caso y ocultar el contenido engañoso.<br>3. Una tienda con reportes reiterados confirmados puede ser despublicada por el administrador. |

---

## Trazabilidad

| HU | Sección de la formulación | Tarea de usabilidad |
|----|---------------------------|---------------------|
| HU01 | §4, §10, RNF-03 (Ley 1581) | T1 |
| HU02 | §7 (datos del formulario), §9 (coordenadas), §1 "Comunicación con los clientes" | T1 |
| HU03 | §6 | T2, T3 |
| HU04 | §4, §7 (estado Publicada) | T5 |
| HU05 | Criterios de aceptación "Visualización Geográfica" | T5 |
| HU06 | §5 | T2–T5 flujo de compra |
| HU07 | §1 financiación, §7 | — |
| HU08 | RNF-06 | todas |
| HU09 | §7 (tres etapas), §8 (permisos admin) | T1 |
| HU10 | §9 (búsqueda por cercanía) | T4 |
| HU11 | §8 (reportes), matriz de riesgos | — |

## Cómo se cubren los RNF (no son HU, son restricciones de calidad)

- **RNF-01 Seguridad** (contraseñas cifradas + HTTPS) → verificación técnica en despliegue, no pantalla evaluable.
- **RNF-02 Aislamiento por tienda** → HU02, criterio 4.
- **RNF-03 Ley 1581** → HU01, criterio 3.
- **RNF-04 Carga < 3 s** → verificación técnica en navegador.
- **RNF-05 Tienda creada en < 5 min** → se comprueba con T1 sobre HU01+HU02+HU09.
- **RNF-06 Adaptable** → HU08.
- **RNF-07 Disponibilidad 95% + respaldo semanal** → operación del despliegue, fuera del prototipo.
- **RNF-08 GitHub + README** → proceso del equipo, fuera del prototipo.

## Fuera de las HU deliberadamente (con decisión de equipo)

1. **Desactivación automática por 30 días de inactividad (§7):** requiere un job periódico de backend; en el prototipo se simula con la despublicación manual del administrador (HU11). Si la profesora la pide, se demuestra en backend más adelante.
2. **Gestión del pago de destacados (§1, §7):** el pago se hace por fuera de la plataforma; el admin solo activa la etiqueta. En el prototipo se simula con la etiqueta ya activada (HU07).
3. **Botón "Continuar con Google":** aparece en el mockup de Lovable pero no es requisito de la formulación; queda como facilidad opcional del prototipo (Supabase Auth lo soporta), no como criterio de aceptación.
