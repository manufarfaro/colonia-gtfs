> **Disciplina de implementación.** Este apply se ejecuta siguiendo el skill `superpowers:test-driven-development` (`/test-driven-development`), según la decisión [D-11](design.md#d-11--implementación-test-first-tdd-vía-el-skill-test-driven-development) del design. Cada par "tests de X" / "implementar X" está ordenado test-first: primero red (test que falla con un assertion error concreto), después green (implementación mínima), después refactor. El scaffolding (grupo 1), la configuración del compose y los workflows (grupos 4 y 5), y la documentación (grupo 6) quedan fuera del flow TDD.

## 1. Scaffolding del bridge (workspace NestJS)

- [ ] 1.1 Crear `bridge/` en la raíz del repo con `package.json` (versiones pineadas: `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/schedule`, `@nestjs/axios`, `axios`, `fast-xml-parser`, `iconv-lite`, `gtfs-realtime-bindings`)
- [ ] 1.2 Agregar `bridge/tsconfig.json`, `bridge/nest-cli.json`, `bridge/.eslintrc.js`, `bridge/.prettierrc` con los defaults estándar de NestJS; declarar `engines.node: "26.x"` en `package.json` (per design D-03; fallback a `24.x` si algún dep no soporta 26 al hacer smoke)
- [ ] 1.3 Crear `bridge/Dockerfile` (multi-stage: `node:26-alpine AS build` → `node:26-alpine` runtime, solo `dist/` + `node_modules` de producción); registrar el tag patch pineado en el mensaje del commit de apply (ej. `node:26.1.0-alpine3.23` al momento del spec)
- [ ] 1.4 Crear `bridge/src/main.ts` (bootstrap de NestJS sobre `process.env.BRIDGE_PORT ?? 3001`) y `bridge/src/app.module.ts` (root module que cablea los sub-módulos)
- [ ] 1.5 Crear `.env.example` en la raíz del repo con `ORIGIN_AVL=` (sin valor — el operador lo completa local), `POLL_INTERVAL_MS=30000`, `BRIDGE_PORT=3001`; agregar `.env` al `.gitignore`. **No committear la URL real** ni en `.env.example`, ni en fixtures, docs o comentarios en ningún lado
- [ ] 1.6 Configurar scripts en `bridge/package.json`: `build`, `start`, `start:dev`, `lint`, `test`, `test:e2e`
- [ ] 1.7 Crear `bridge/test/fixtures/gtfs-mini/` (~5 stops, 1 route, 2 trips) — input determinístico para los tests del loader (grupo 2). Este fixture es **scaffolding**, no impl bajo TDD

## 2. Loader del GTFS estático y matcher (TDD)

- [ ] 2.1 **Red** — escribir los tests del loader contra `bridge/test/fixtures/gtfs-mini/`: cubrir `routes`, `trips`, `stop_times`, `calendar`, `calendar_dates`; assertar que los índices materializados (per design D-04) son los esperados
- [ ] 2.2 **Green** — implementar `bridge/src/gtfs/gtfs.module.ts` y `bridge/src/gtfs/gtfs-static.service.ts` leyendo `/var/bridge/gtfs/*.txt` (paths overrideables vía env `GTFS_DIR` para tests) hasta hacer pasar los tests de 2.1. Refactor si hace falta
- [ ] 2.3 **Red** — escribir los tests del matcher: marker que snapea limpio (devuelve el `trip_id` esperado), marker fuera del threshold 200 m (devuelve `null` e incrementa el counter de unmatched), marker con `srv` que matchea un trip directo (fast-path forward-compatible per design D-05). Cada `it(...)` nombra el R-XX del spec que cubre
- [ ] 2.4 **Green** — implementar `bridge/src/matcher/matcher.module.ts` y `bridge/src/matcher/matcher.service.ts` con el algoritmo del design D-05 hasta hacer pasar los tests de 2.3

## 3. Poller, parser XML y emitter GTFS-RT (TDD)

- [ ] 3.1 **Red** — escribir los tests del AVL parser contra `bridge/test/fixtures/avl-sample.xml` (a sumar en task 5.1): assertar que los acentuados de los stop names se decodifican correctamente (cubre el path de ISO-8859-1), que markers bien formados producen un `Marker[]` tipado, que XML mal-formado tira un error de dominio (no un throw del parser crudo)
- [ ] 3.2 **Green** — implementar `bridge/src/poller/avl-parser.ts`: `iconv-lite.decode(buf, 'iso-8859-1')` → `fast-xml-parser` → `Marker[]` tipado, hasta pasar los tests de 3.1
- [ ] 3.3 **Red** — escribir los tests del poller: progresión de backoff (`30→60→120→240→300 s` con cap, reset al primer éxito per design D-06), wrap de `AxiosError` en errores de dominio que NO incluyan la URL en su mensaje, modo fixture (`ORIGIN_AVL=file://...` lee de disco en vez de HTTP). Inyectar fakes del `HttpService` y del clock para que los tests no dependan de wall time
- [ ] 3.4 **Green** — implementar `bridge/src/poller/poller.module.ts` y `bridge/src/poller/poller.service.ts` con `@nestjs/schedule` (`@Interval(POLL_INTERVAL_MS)`) + `HttpService` de `@nestjs/axios` (`timeout: 10_000`, `responseType: 'arraybuffer'`) + fixture mode (`file://`), hasta pasar los tests de 3.3
- [ ] 3.5 **Red** — escribir los tests del emitter: header del `FeedMessage` es `2.0`+`FULL_DATASET`+timestamp del último poll; input vacío → `FeedMessage` vacío con header válido; input sample → `FeedMessage` decodifica vía `gtfs-realtime-bindings` round-trip y matchea los entities esperados (VehiclePosition + TripUpdate per design D-08/D-09)
- [ ] 3.6 **Green** — implementar `bridge/src/emitter/emitter.module.ts` y `bridge/src/emitter/emitter.service.ts` construyendo `FeedMessage`s vía `gtfs-realtime-bindings`, hasta pasar los tests de 3.5
- [ ] 3.7 **Red** — escribir los tests del controller: `GET /gtfs-rt/vehicle-positions.pb` y `GET /gtfs-rt/trip-updates.pb` devuelven `Content-Type: application/x-protobuf` y body que decodifica via `gtfs-realtime-bindings`; cuando el snapshot tiene `feed_age_seconds > 120` el body es un `FeedMessage` vacío con header válido (empty-feed fallback per design D-07)
- [ ] 3.8 **Green** — implementar `bridge/src/rt/rt.controller.ts` (lectura lazy del snapshot, sin locks porque Node es single-thread) + el empty-feed fallback, hasta pasar los tests de 3.7

## 4. Healthz endpoint e integración con compose

- [ ] 4.1 **Red** — escribir los tests de healthz: sintetizar distintos estados de snapshot (fresh ok, 90 s stale → degraded, 150 s stale → down, miss rate alto → degraded/down per design D-10) y assertar el campo `status` + el shape JSON de R-07
- [ ] 4.2 **Green** — implementar `bridge/src/healthz/healthz.module.ts` y `bridge/src/healthz/healthz.controller.ts` devolviendo el shape JSON de R-07, hasta pasar los tests de 4.1
- [ ] 4.3 Actualizar `docker-compose.yml` en la raíz: sumar el bloque del service `bridge` (`build: ./bridge`, `env_file: .env`, `volumes: ./data:/var/bridge/gtfs:ro`, `restart: unless-stopped`, sin host port mapping). *Scaffolding declarativo — no aplica TDD; el smoke workflow del grupo 5 cubre la integración*
- [ ] 4.4 Agregar un `healthcheck:` de compose para `bridge` que probe `/healthz` vía el patrón bash + `/dev/tcp` de R-06 de `otp-routing` (la imagen base `node:26-alpine` tampoco trae `curl` por default; misma restricción aplica)
- [ ] 4.5 Si la path de "bridge ausente" del smoke de OTP importa en otro lado, sumar el service bridge a `compose.override.ci.yml` solo para el smoke workflow propio del bridge — NO levantar el bridge en `otp-smoke.yml` (ese workflow existe justamente para probar que OTP tolera al bridge caído)

## 5. Workflows de CI

- [ ] 5.1 Agregar `bridge/test/fixtures/avl-sample.xml`: captura representativa de XML AVL (ISO-8859-1, ~20 markers cubriendo las cuatro líneas, al menos un acentuado en algún valor). Sanitizar antes de committear: el body del fixture NO debe incluir la URL real del upstream, ni credenciales del operador, ni identificadores que el spec no haya declarado (los códigos de ruta 3/4/5/8 y los stop names de `data/` están OK; los marker IDs opacos pueden renombrarse). Documentar la sanitización (y qué se renombró) en `bridge/test/fixtures/README.md`
- [ ] 5.2 Crear `.github/workflows/bridge.yml` (lint + unit tests): triggers en push/PR sobre `bridge/**` y el workflow file; steps = checkout, setup-node@v4 (`node-version: 26.x`), `npm ci`, `npm run lint`, `npm test`
- [ ] 5.3 Crear `.github/workflows/bridge-rt-validate.yml`: triggers per R-08; steps = checkout, setup-node, `npm ci` + `npm run build`, arrancar bridge con `ORIGIN_AVL=file://$(pwd)/bridge/test/fixtures/avl-sample.xml` (solo fixture mode — este workflow NO DEBE referenciar `secrets.ORIGIN_AVL`), pollear `/healthz` hasta status `ok` o `degraded`, `curl -o vp.pb /gtfs-rt/vehicle-positions.pb`, `curl -o tu.pb /gtfs-rt/trip-updates.pb`, construir `gtfs.zip` vía el tooling, correr el `gtfs-realtime-validator` de MobilityData contra `(vp.pb, tu.pb, gtfs.zip)`, assertar cero P0/P1
- [ ] 5.4 Agregar step `actions/upload-artifact@v4` (`if: always()`) subiendo `vp.pb`, `tu.pb`, el report del validator y un snapshot `healthz.json` — mirror del patrón de artifacts de `otp-smoke.yml`

## 6. Documentación

- [ ] 6.1 Crear `bridge/README.md` (español primario) per R-09: stack, boot local vía `docker compose up bridge`, prereq de `.env`, endpoints `.pb`, contrato de healthz, comportamiento ante AVL caído, link al spec en `openspec/specs/bridge-gtfs-rt/spec.md`
- [ ] 6.2 Crear `bridge/README.en.md` mirror con el header `Español` / `English` cross-link
- [ ] 6.3 Actualizar root `README.md` y `README.en.md`: sumar badges para `bridge.yml` y `bridge-rt-validate.yml`; sumar link de `bridge/` en la sección de Documentación
- [ ] 6.4 Actualizar `deployment/README.md` y `.en.md`: la sección "Bridge ausente — comportamiento esperado" gana una sub-sección "Bridge presente" complementaria que apunta a `bridge/README.md` para boot, healthz y el contrato de URLs que este bridge ahora cumple

## 7. Verificación

- [ ] 7.1 Correr `npm test` localmente y confirmar que toda la suite TDD (grupos 2, 3, 4) corre verde — coverage report opcional pero útil
- [ ] 7.2 Correr `docker compose up bridge` localmente (con un `.env` real apuntando a la URL fixture del AVL en modo `file://` para reproducibilidad offline); confirmar que `/healthz` devuelve `200` con `"status": "ok"` o `"degraded"`
- [ ] 7.3 Correr `docker compose up otp bridge` juntos; confirmar que los logs de OTP ya no muestran errores de `bridge:3001` después de ~30 s y que `docker compose ps` muestra ambos services healthy
- [ ] 7.4 Lanzar la query canónica del PRD (Buquebus → Plaza de Toros) vía el endpoint GraphQL de OTP y confirmar que la respuesta ahora trae datos live de `vehiclePositions` cuando al menos un marker del fixture matchea un trip en la fecha consultada
- [ ] 7.5 Correr `gtfs-realtime-validator` local contra los `.pb`s capturados (mismo path que el CI workflow) y confirmar cero errores P0/P1
- [ ] 7.6 Correr `openspec validate --all --strict --no-interactive` y confirmar verde
