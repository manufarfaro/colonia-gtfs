# MVP v0 — Trip planner turístico de Colonia

> Estado: **Draft** · Owner: @manufarfaro · Última edición: 2026-05-17
>
> Este PRD describe el v0 del producto colonia-gtfs. Define **qué** se entrega y **por qué**; los **cómo** (stack exacto, contratos, esquemas) viven en los OpenSpec que siguen a este PRD.

## 1. Resumen ejecutivo

**colonia-gtfs v0** es una app web que muestra cómo llegar en colectivo entre dos puntos de Colonia del Sacramento, usando un mapa que se siente como Google Maps. La calcula localmente (sin depender de Google Transit Partners), combina horarios oficiales con la posición real de los buses, y soporta español en su lanzamiento con infraestructura preparada para sumar inglés y portugués en versiones siguientes. v0 alcanza **demo-ready cerrado**: se le puede mostrar a Intendencia y a Sol Antigua desde un celular en una reunión, sin marketing público todavía.

## 2. Audiencia y caso de uso canónico

### 2.1 Audiencia v0 (en orden de prioridad)

1. **Stakeholders** — Intendencia de Colonia, Sol Antigua y ABC Coop.
2. **Turistas hispanohablantes** — argentinos mayoritariamente, también chilenos, españoles y otros. Caso típico: en la Terminal Buquebus con un celular.
3. **Turistas brasileros** — segundo grupo más numeroso. Estancias más largas que los argentinos.
4. **Turistas angloparlantes** — tercer grupo (norteamericanos y europeos).

Aunque ABC Coop figura en stakeholders, **v0 sigue cubriendo solo data de Sol Antigua**. Mostrarle el producto a ABC Coop abre la puerta a que se sumen en v0.1+, pero no infla el alcance del v0 con sus líneas.

**Nota sobre idiomas en v0:** El orden 2 → 3 → 4 refleja la prioridad del roadmap de idiomas, no la cobertura inmediata. v0 lanza con UI en español únicamente, lo cual cubre nativamente a la audiencia 2; brasileros (3) y angloparlantes (4) se acomodan con la traducción automática del browser hasta que v0.1 sume `pt.json` y `en.json` sobre la infraestructura i18n ya preparada. Ver §3.4 y §5.4.

### 2.2 Caso de uso canónico

> Un turista llega a la Terminal de Buquebus en Colonia, abre la URL en su celular, escribe "Plaza de Toros" en el destino, y ve: qué línea tomar (probablemente la 4), dónde está la parada más cercana (con un caminito a pie), cuándo sale el próximo bus, cuándo llega a destino, y cuánto cuesta el boleto.

### 2.3 No-audiencias en v0

- Operadores externos consumiendo el feed GTFS (trabajo de v0.1+).
- Apps de terceros vía API (idem).
- Google Maps app oficial (requiere Transit Partners endorsement, fuera de scope).

## 3. Alcance v0 (in-scope)

### 3.1 Cobertura funcional

| Modo | Descripción | Estado v0 |
|---|---|---|
| **Origen → Destino** | El turista escribe (o tap-on-map) dos puntos; el viewer muestra el itinerario sugerido en el mapa (walking + bus + walking), con horario de salida, llegada y tarifa. | ✓ |
| **Stop info** | Tap en una parada del mapa → tarjeta con los próximos buses y ETAs por línea. | ✓ |
| **Line schedule** | Vista de una línea: trazado, todas sus paradas, posición live de los buses, horarios programados del día. | ✓ |

### 3.2 Cobertura de datos

- **Operador:** Sol Antigua únicamente. La data ya está capturada en el relevamiento; otros operadores son v0.1+.
- **Geografía:** Urbano Colonia del Sacramento.
- **Líneas:** Las cuatro líneas de Sol Antigua (`lin` 3, 4, 5, 8). L5 con disclaimer visible por menor muestreo en la captura inicial (20 + 43 + 385 markers vs. miles para las otras).
- **Datos GTFS Schedule en `data/`:** archivos `.txt` canónicos (`agency`, `stops`, `routes`, `trips`, `stop_times`, `calendar`, `calendar_dates`, `shapes`, `feed_info`, `fare_attributes`, `fare_rules`). Mantenidos a mano; el GTFS builder dinámico queda fuera del producto (infra privada externa).
- **Realtime:** El bridge polea AVL Sol Antigua cada 30 s y expone GTFS-RT en `/gtfs-rt/trip-updates.pb` y `/gtfs-rt/vehicle-positions.pb`. OTP los consume.
- **Tarifas:** `fare_attributes.txt` + `fare_rules.txt` con valor a confirmar con Sol Antigua antes de cerrar v0 (dependencia bloqueante explícita, ver §7).

### 3.3 Stack (conceptual)

```
Next.js app  (App Router — UI mobile-first + API routes / BFF)
   │  Google Maps JS API + Places Autocomplete del lado del cliente
   │  /tickets, /pois como stubs documentados
   │
   ├──► OTP (Docker, motor planning)
   │      ├─ mounts gtfs.zip ← data/*.txt
   │      └─ mounts colonia.osm.pbf
   │
   └──► bridge (NestJS) ──► AVL Sol Antigua
              │
              └─ expone GTFS-RT .pb → OTP los polea
```

### 3.4 UX e idioma

- **Mobile-first** (turista con celular en Buquebus es el caso canon), responsive a desktop.
- **Idioma de UI: español en v0.** Todas las strings viven detrás de `t("...")` por key desde día 1; sumar `en.json` y `pt.json` en v0.1+ es agregar archivos, no refactorizar.
- **Datos del operador (paradas, headsigns, alertas) siempre en español** — nunca se traducen topónimos.
- **Disclaimers visibles** consistentes con el trigger demo-ready: banner discreto pero claro ("Datos preliminares · operador no oficial · horarios referenciales").
- **Principio de diseño:** mimetizar Google Maps Transit (ver §5).

## 4. Out-of-scope (no v0)

Cosas que el lector espera ver y que **explícitamente no entran** en v0:

| Item | Por qué fuera | Cuándo |
|---|---|---|
| Otros operadores (ABC Coop, TAB SRL, suburbano: Ómnibus Colonia, Berrutti, Intertur, Orsi) | Data no capturada; relación con operadores no iniciada | v0.1+ a medida que se sumen |
| Geografía más allá del urbano Colonia | Mismo motivo | v0.1+ |
| Inglés y portugués en la UI | Cubierto estructuralmente (i18n por keys); contenido se suma en versiones siguientes | v0.1 (EN) / v0.2 (PT) |
| `occupancy_status` en GTFS-RT | Sin fuente real de live passenger count (D11 firme del relevamiento) | Cuando aparezca fuente |
| Google Transit Partners enrollment | Requiere endorsement municipal; track paralelo, no bloqueante | Eventual |
| Registro en MobilityDatabase | Requiere feed estable y permisos AVL resueltos | v0.1 después de demo |
| Tooling de `gtfs-builder` dinámico | Reemplazado por mantención manual de los `.txt` en `data/` | No planeado |
| Multi-leg / transfer planning con varias líneas | A esta escala (4 líneas) raro que un viaje requiera transbordo; OTP lo soporta out-of-the-box si se diera | Implícito en OTP, no se promociona |
| Auth de usuarios / cuentas | Producto público | No planeado |
| GTFS-RT Service Alerts | Sin fuente formal de alertas en Sol Antigua | v0.1 con fuente |
| Analytics server-side | Demo no necesita métricas | v0.1+ |
| Apps nativas (iOS / Android) | Web mobile-first cubre el caso | No planeado |
| Historial Postgres del bridge | Útil para forensics, no para producto | Gated por env del bridge, ya soportado pero off por default |

## 5. Principios de diseño

En orden, los primeros pesan más que los últimos.

### 5.1 Mimetizar Google Maps Transit

El destino final del proyecto es que el turista no sienta diferencia con la experiencia de Google Maps cuando hace "directions by bus" en otras ciudades. Cualquier divergencia de patrones (search bar arriba, tap-on-map, card de itinerario, polilíneas coloreadas por modo, etc.) tiene que justificarse explícitamente. El día que entremos a Transit Partners, la migración mental del usuario es cero porque la experiencia ya es la suya.

### 5.2 Demo-ready antes que feature-complete

Los disclaimers son ciudadanos de primera, no errores que esconder. Tarifas a confirmar, horarios aproximados, datos del operador no oficiales — todo eso se muestra visiblemente y nadie se sorprende. Mejor un v0 honesto y útil que un v0 perfecto y atrasado.

### 5.3 Local-first en el motor de planning

El cálculo de viajes corre bajo nuestro control en OTP, no se delega a APIs externas. La única dependencia externa en runtime es Google Maps JS (canvas + Places Autocomplete). Si Google cierra la puerta o cambia los precios, el producto sigue funcionando con un canvas alternativo (Mapbox, OSM tiles); no hay que reemplazar el cerebro del producto.

### 5.4 UI en español, infraestructura i18n por keys

El viewer en v0 lanza en español únicamente. Todas las strings viven detrás de `t("...")` desde día 1, de modo que sumar inglés/portugués en versiones siguientes es agregar archivos JSON, no refactorizar. Los datos del operador (nombres de paradas, headsigns) quedan en español siempre — nunca traducimos topónimos del operador.

### 5.5 Mobile-first

El usuario canon está parado en la Terminal Buquebus con un celular. Diseño responsivo, pero las decisiones de jerarquía (qué se ve primero, dónde está el CTA) se hacen pensando en pantalla chica. Desktop es upgrade gratis, no target primario.

## 6. Arquitectura conceptual

El detalle de implementación (config, esquemas, contratos exactos) vive en el OpenSpec siguiente a este PRD. Acá se define qué piezas hay y para qué sirve cada una.

### 6.1 Servicios

| Servicio | Stack | Responsabilidad | Superficie pública |
|---|---|---|---|
| **Next.js app** (`viewer/`) | Next.js 16 App Router + React 19 + TypeScript + Tailwind v4 + shadcn/ui + next-intl | Combina la UI mobile-first (chrome persistente con header + disclaimer, Google Maps JS canvas para el render, Places Autocomplete del lado cliente) y las API routes (BFF) que proxean a OTP/bridge y exponen `/api/plan`, `/api/stops/:id/arrivals`, `/api/lines/:id`, `/api/lines/:id/vehicles`. Deja `/api/tickets` y `/api/pois` como stubs `501` documentados. | Único entry point público |
| **OTP** | OpenTripPlanner 2 (Docker, Java) | Motor de planning. Recibe `(lat,lon) origen` + destino → devuelve JSON con itinerarios (legs walk + bus, geometrías, horarios). Consume GTFS estático + GTFS-RT. | Solo interno; el Next.js app la proxea |
| **bridge** | NestJS + axios + fast-xml-parser + iconv-lite + gtfs-realtime-bindings | Polea AVL Sol Antigua cada 30 s, matchea markers contra GTFS, emite GTFS-RT como `.pb` HTTP. | Solo interno; OTP la polea, y el Next.js app la consulta para `/api/lines/:id/vehicles` |

### 6.2 Capa de datos

`data/` contiene los archivos GTFS Schedule `.txt` versionados en el repo + `colonia.osm.pbf` (recorte de Geofabrik UY por bbox). En el boot del contenedor de OTP, un script trivial zipea los `.txt` en `gtfs.zip` y monta también el `.pbf`.

**No hay gtfs-builder.** La captura/procesamiento del AVL para inferir paradas y horarios es infra privada externa al producto; los `.txt` resultantes se editan y commitean a mano.

### 6.3 Flujos

```
PLANNING (request del turista):

   turista → Next.js app
              │ Places Autocomplete (Google) → (lat,lon) origen + destino
              │
              │ POST /api/plan
              ▼
            API route  ──GraphQL──►  OTP
                                       │
                                       ▼
                                  JSON con itineraries[].legs[]
              ◄──────────────────
            API route ──pasa al cliente──►
                              │
                              ▼
                       viewer dibuja en Google Maps JS
                       (Polyline por leg, Marker por parada,
                        card de horarios y tarifa)

REALTIME (background, sin interacción del turista):

   AVL Sol Antigua (XML cada 30 s)
              ▼
            bridge (parsea, matchea, decodifica ISO-8859-1)
              │
              ├─ expone /gtfs-rt/trip-updates.pb
              └─ expone /gtfs-rt/vehicle-positions.pb
                              ▲
                              │ poll cada 15-30 s
                              │
                            OTP los incorpora a su grafo
                            → afecta /plan y /vehicle-positions
```

### 6.4 Boundaries públicas vs. privadas

- **Público (URL del demo):** solo la Next.js app (UI + API routes). Es el único container con `ports:` en `docker-compose.yml`. OTP y bridge viven en la red interna de Docker.
- **Privado de la operación (no se publica nunca):** la infraestructura de captura del AVL (poller, jsonl crudos, procesador) que produce los `.txt` originales. Vive en otro repo / otra máquina; el producto no la incluye.
- **De terceros:** Google Maps JS API (canvas + Places). Es la única dependencia externa en runtime.

## 7. Dependencias bloqueantes

Cosas externas al código que tienen que estar resueltas para que v0 pueda darse por terminado. Cada una bloquea el "demo-ready" si no llega a tiempo.

| Dependencia | Qué se necesita | Owner | Estado al cierre del PRD |
|---|---|---|---|
| **Tarifa Sol Antigua confirmada** | Valor flat o estructura, moneda, política de transbordo. Para poder llenar `fare_attributes.txt` + `fare_rules.txt`. | @manufarfaro (consultar al operador o constatar in-situ) | Open |
| **OSM extract de Colonia urbano** | `colonia.osm.pbf` recortado de Geofabrik UY por bbox. Se commitea en `data/` o se baja en build (decisión spec-level). | @manufarfaro | Cerrable sin terceros |
| **Google Maps API key** | Project en GCP con Maps JavaScript API + Places API habilitadas, restricción por HTTP referrer. | @manufarfaro | Cerrable sin terceros |
| **Hosting v0** | VPS chico o Mac mini con Docker compose; subdominio acotado (`demo.algo.com` o similar). | @manufarfaro | Cerrable sin terceros |
| **Disponibilidad del AVL del operador** | El endpoint del AVL upstream (URL no committeada al repo; se inyecta vía la env var `ORIGIN_AVL` — ver [`bridge-gtfs-rt` R-03](../../openspec/specs/bridge-gtfs-rt/spec.md)) sigue accesible y respondiendo. El contrato de acceso lo gestiona @manufarfaro fuera de este repo. | Operador externo | Estable de hecho |

**D10 del relevamiento (permisos legales del AVL) no es bloqueante de v0** porque el trigger es demo cerrado, no público. Pasa a ser bloqueante en v0.1 si se decide hacer URL pública (ver §10).

## 8. Criterios de aceptación

Lista cerrada. Si todos los items están ✓ y los disclaimers están visibles, v0 está demo-ready.

### 8.1 Funcionalidad

1. Un usuario en un celular abre la URL del demo y le carga el mapa centrado en Colonia urbano en menos de 5 segundos.
2. El usuario escribe "Terminal Buquebus Colonia" en origen y "Plaza de Toros Real de San Carlos" (o equivalente) en destino, y obtiene al menos una opción de itinerario que incluye: walking leg(s), bus leg(s) con línea correcta, horarios coherentes con el cronograma del día.
3. La card del itinerario muestra la tarifa.
4. El usuario hace tap en una parada del mapa y ve los próximos buses con ETAs. Cuando hay un bus tracked en vivo, el ETA usa GTFS-RT; si no, usa horario programado, claramente diferenciado.
5. El usuario selecciona una línea (3, 4, 5 u 8) desde alguna vista de navegación y ve el trazado completo + paradas + posición live de vehículos + horarios del día.
6. El idioma de la UI es español; las strings están detrás de `t()` por key.
7. Los disclaimers visibles ("Datos preliminares · operador no oficial · horarios referenciales") aparecen en chrome persistente.

### 8.2 Operación

8. El bridge poolea AVL cada 30 s sin caídas durante ≥48 hs continuas.
9. OTP arranca con `gtfs.zip` + `colonia.osm.pbf` en menos de 90 s al boot del compose.
10. El compose completo (viewer + BFF + OTP + bridge) arranca con `docker compose up` y queda funcional en un host limpio en menos de 5 minutos.
11. Existe `README.md` que explica cómo correr el demo localmente y cómo desplegarlo en un host.

### 8.3 Validación de datos

12. El feed GTFS Schedule (los `.txt` en `data/` empaquetados en `gtfs.zip`) pasa `gtfs-kit` (Python) sin errores P0/P1.
13. El feed GTFS-RT del bridge pasa `gtfs-realtime-validator` (MobilityData) sin errores P0/P1.
14. La tarifa cargada en `fare_attributes.txt` es la confirmada con Sol Antigua (no un placeholder).

### 8.4 Calidad mínima

15. Para los casos canon (Buquebus → Plaza de Toros, Buquebus → centro histórico, centro → El General) los itinerarios son razonables a juicio humano (caminos cortos, línea esperada).
16. No hay errores en consola del browser en happy path.

## 9. Riesgos

| Riesgo | Prob. | Mitigación |
|---|---|---|
| **Tarifa no se confirma a tiempo con Sol Antigua** | Media | Plan B: usar valor "consultar al chofer" como string explícito en la card, y dejar `fare_attributes` con `currency_type=UYU` y `price=null` (válido GTFS). Mejor evitarlo: contactar al operador en semana 1 del ciclo. |
| **AVL Sol Antigua cae intermitentemente o cambia su esquema XML** | Media | El bridge tiene fallback `empty FeedMessage` con header válido; reintentos con backoff; alertas locales si `>10 %` miss rate. Si cambia schema, `raw_marker JSONB` permite forensics. |
| **OTP no levanta correctamente con el OSM extract o falla parseo del GTFS** | Baja | Pre-validar `gtfs.zip` con `gtfs-kit` antes de mountear; CI corre el boot completo en GitHub Actions. |
| **Google Maps API key se filtra o cuota saturada** | Baja-Media | Restricción por HTTP referrer en GCP; alertas de cuota en consola; documentar refresh procedure. Si la cuota se rompe, el viewer queda sin canvas pero el resto sigue corriendo. |
| **Demo en celular falla por tema de geolocalización HTTPS** | Media | HTTPS obligatorio en el dominio del demo (Let's Encrypt en nginx o gestionado por el PaaS si se elige uno). Test en celular real antes de cualquier demo. |
| **L5 con poca data muestra trazado feo o ETAs raros** | Media | Disclaimer específico para L5 visible en su line schedule. Más data se acumula post-launch sin requerir cambios de código. |
| **Sol Antigua se entera del demo y se molesta** | Baja-Media | Trigger es demo-ready cerrado, no público — sin marketing. Idealmente, presentárselo *antes* de cualquier exposición externa. Courtesy email antes de v0.1 público. |
| **Sumar PT y EN en v0.1 resulta más caro que lo esperado** | Baja | i18n infra desde día 1 lo mitiga estructuralmente. Validación: en el primer feature post-v0 que agregue strings, medir la fricción real. |

## 10. Open questions y decisiones diferidas

### 10.1 Diferidas al OpenSpec siguiente (no al PRD)

| ID | Pregunta | Cuándo se resuelve |
|---|---|---|
| Q1 | ¿`trip_id` = `srv` del operador o sintético `route-service-dir-time`? (D3 del relevamiento) | Spec del bridge |
| Q2 | ¿L5 modelado como 1 route con 2 shapes o con 3? (D2 del relevamiento) | Spec del data layer |
| Q3 | ¿`colonia.osm.pbf` se commitea o se baja en build? | Spec del data layer |
| ~~Q4~~ | ~~¿Stack exacto del viewer: Vite + Vanilla TS, Vite + React, Vite + Svelte?~~ | **Resuelto en `viewer-shell-and-api`:** Next.js 16 App Router + React 19 + TypeScript (+ shadcn/ui + Tailwind v4) |
| ~~Q5~~ | ~~¿Librería i18n: `i18next`, `formatjs`, custom 30-LOC?~~ | **Resuelto en `viewer-shell-and-api`:** `next-intl` |

### 10.2 Diferidas a versiones posteriores

| ID | Decisión | Versión target |
|---|---|---|
| L1 | ¿v0.1 lanza con público abierto o sigue cerrado? (D13 del relevamiento) | Final de v0 |
| L2 | Sumar PT y EN en la UI | v0.1 si la demo es bien recibida |
| L3 | Registrar el feed en MobilityDatabase | v0.1 (requiere D10 resuelto) |
| L4 | Iniciar trámite Google Transit Partners | v0.2+ (requiere endorsement municipal) |
| L5 | Sumar ABC Coop como segundo operador | v0.2+ con su data capturada |
| L6 | Service Alerts en GTFS-RT | Cuando haya fuente formal |
| L7 | Multi-operador (cambio de modelo para `agency.txt` con N filas) | v0.2+ |

### 10.3 Del relevamiento ya cerrado

- **D11 (occupancy):** firme **no** en v0 — `bpp` no es live.
- **D12 (cobertura):** cubierto por el modelo demo-ready + disclaimers visibles.
- **D5 (nombre repo):** `colonia-gtfs` ✓.
- **D6 (validador en CI):** `gtfs-kit` + `gtfs-realtime-validator` ✓ (en criterios de aceptación 12 y 13).
- **D4 (licencia):** default propuesto **CC-BY-4.0 para datos + MIT para código**; confirmar antes de publicar el repo (open en el sentido de "cerrable sin terceros").

## 11. Próximos pasos

Tras la aprobación de este PRD:

1. Sumar este archivo al índice de [`docs/prd/README.md`](./README.md).
2. Abrir PR contra `main` para el PRD.
3. Tras el merge, iniciar la fase de OpenSpec con `/opsx:propose` por área. Mapeo sugerido (orden importa por dependencias):

   | OpenSpec change | Cubre |
   |---|---|
   | `data-layer-gtfs-static` | Estructura de `data/*.txt`, esquema, fares confirmadas, OSM extract, scripts de boot que arman `gtfs.zip` |
   | `otp-deployment` | Container de OTP, `router-config.json`, updaters apuntando al bridge, mounts |
   | `bridge-gtfs-rt` | Parseo del AVL XML (ISO-8859-1), matching markers → trip_id (Q1: `srv` vs sintético), emisión `.pb`, healthz, backoff |
   | `viewer-shell-and-api` | Una sola Next.js app (App Router) que combina **viewer shell + i18n + API routes**: stack del viewer (Q4), i18n infra (Q5), chrome persistente, disclaimer banner, language toggle preparado, endpoints `/api/plan`, `/api/stops/:id/arrivals`, `/api/lines/:id`, `/api/lines/:id/vehicles`, stubs `/api/tickets` y `/api/pois`, healthz aggregate, CORS por env. Reemplaza al pair `bff-api-and-routes` + `viewer-shell-and-i18n` del plan original |
   | `viewer-od-mode` | Modo O→D con Places autocomplete (bbox a Colonia + UY-only), render de itinerario sobre Google Maps canvas (polylines coloreadas por línea, markers en stops del bus leg), card en bottom sheet con duración + walking distance + legs + tarifa (con fallback "Consultar al chofer" cuando `fare_attributes.txt` no la declara). Extiende `viewer-shell-and-api` `/api/plan` con `legGeometry` (Google encoded polyline) + `fare` opcionales. Stack añadido: `@vis.gl/react-google-maps` + `next-themes` (theming light/dark). API key vía `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` con HTTP referrer restriction en GCP |
   | `viewer-stop-info-mode` | Bottom sheet con próximos buses, distinción live vs programado |
   | `viewer-line-schedule-mode` | Vista de línea con trazado, paradas, vehículos live |
   | `deployment-and-disclaimers` | Docker compose final, HTTPS, dominio del demo, contenido exacto del disclaimer |

Cada uno se propone con `/opsx:propose <nombre>`, se aplica con `/opsx:apply <nombre>`, y pasa por la validación del CI (`openspec validate --all --strict`) en cada PR.

## 12. Referencias

- Relevamiento que dio origen a este PRD: `/Users/manufarfaro/Documents/Claude/Projects/Colonia Mobilidad/relevamiento-mvp.md` (privado, no se publica).
- [GTFS Schedule reference](https://gtfs.org/schedule/reference/)
- [GTFS-Realtime reference](https://gtfs.org/realtime/reference/)
- [OpenTripPlanner 2 docs](https://docs.opentripplanner.org/en/latest/)
- [MobilityData GTFS Validator](https://github.com/MobilityData/gtfs-validator)
- [Geofabrik Uruguay OSM](https://download.geofabrik.de/south-america/uruguay.html)
