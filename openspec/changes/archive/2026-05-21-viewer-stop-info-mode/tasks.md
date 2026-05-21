> **Implementation discipline.** This apply runs under `superpowers:test-driven-development`. Every "tests for X" / "implement X" pair is ordered test-first: red → green → refactor. The 100% coverage threshold from `viewer-shell-and-api` is preserved — every new file either ships a test or lands on the documented `coverage.exclude` list with a comment.

## 1. Mode-state hook (shared infra)

- [x] 1.1 **Red** — `viewer/components/mode/useViewerMode.test.tsx`: assert the hook returns `{type:'od'}` when `window.location.hash` is empty; returns `{type:'stop-info', stopId:'sol-antigua:3'}` when hash is `#stop=sol-antigua:3`; returns `{type:'line-schedule', shortName:'4'}` when hash is `#line=4`. Stub `window.history.pushState` and assert `setMode({type:'stop-info', stopId:'X'})` calls it with `'#stop=X'`. Stub `popstate` and assert the hook re-derives state from the new hash.
- [x] 1.2 **Green** — `viewer/components/mode/useViewerMode.ts`: implement the hook + the `setMode` mutator + an internal `previousMode` slot (preserved per `viewer-line-schedule-mode`'s spec delta, push semantics activated when `{push: true}` is passed).
- [x] 1.3 **Red** — additional test for the push/pop semantics: `setMode(A, {push: true})`, then `setMode(B)` (no push) → previousMode is now A; the next `setMode('restore')` (or whatever close API the hook exposes) returns to A.
- [x] 1.4 **Green** — wire the previousMode logic until 1.3 passes.

## 2. BottomSheet primitive (shared infra)

- [x] 2.1 **Red** — `viewer/components/od/sheet/BottomSheet.test.tsx`: render with `open=false` → not visible (no role="dialog" in the tree). Render with `open=true` → role="dialog" + aria-modal="true" + the children visible.
- [x] 2.2 **Green** — `viewer/components/od/sheet/BottomSheet.tsx`: implement the primitive with conditional render + the ARIA attrs.
- [x] 2.3 **Red** — close interactions: ESC key fires `onClose`; click outside fires `onClose`; touchstart at y=200 + touchend at y=300 (swipe down past threshold) fires `onClose`.
- [x] 2.4 **Green** — wire the close interactions until 2.3 passes.
- [x] 2.5 Refactor: move the inlined sheet markup from `OdModeShell.tsx` to use `<BottomSheet>`. Snapshot-y assertion in `OdModeShell.test.tsx` that the chrome layout still matches.

## 3. ETA formatter

- [x] 3.1 **Red** — `viewer/lib/format/eta.test.ts`: assert `formatEta(scheduled, now, isRealtime)` returns `"Ahora"` when delta ≤ 0; `"en N min"` for relative ≤ 1800s; `"HH:MM"` for absolute beyond 30 minutes; and that "HH:MM" formatting uses `America/Montevideo` TZ. Cover the scheduled vs realtime branch (the formatter should distinguish: e.g. append "(horario)" when isRealtime is false, OR leave that to the UI — pick one and test it).
- [x] 3.2 **Green** — `viewer/lib/format/eta.ts` implementing the helper.

## 4. Arrivals query hook

- [x] 4.1 **Red** — `viewer/components/stop-info/useArrivalsQuery.test.tsx`: mock fetch, faketimers (only `setInterval`+`setTimeout`+Date). Assert `idle → loading → success` on a valid response; `error.empty` on 200 with `arrivals: []`; `error.notFound` on 404; `error.otp` on 502; `error.network` on fetch reject; cleanup on unmount aborts in-flight request.
- [x] 4.2 **Green** — `viewer/components/stop-info/useArrivalsQuery.ts`: hook with 30s polling, AbortController cancellation, state machine.
- [x] 4.3 **Red** — polling cadence: assert that after `vi.advanceTimersByTime(30_000)` exactly one additional fetch fires; after 60s, two; switching stopId aborts the in-flight and starts a fresh one immediately.
- [x] 4.4 **Green** — wire interval + cleanup until 4.3 passes.

## 5. StopInfoCard (sheet content)

- [x] 5.1 **Red** — `viewer/components/stop-info/StopInfoCard.test.tsx`: render with a fixture stop-info response containing 2 realtime + 1 scheduled arrival. Assert: header has the stop.name + "queried at" timestamp; 3 rows rendered; realtime rows have a `[data-testid="live-badge"]` element; scheduled row carries the i18n `od.stopInfo.arrival.badge.scheduled` suffix; ETA format follows the helper.
- [x] 5.2 **Green** — `viewer/components/stop-info/StopInfoCard.tsx`: header + arrivals list using the catalog + the helper.
- [x] 5.3 **Red** — state branches: render with `state='loading'` → skeleton text from `od.stopInfo.state.loading`; with `state='error.empty'` → message from `od.stopInfo.state.errorEmpty`; with `state='error.notFound'` → message + a "Volver al inicio" button that, when clicked, fires the provided `onReturnHome` prop.
- [x] 5.4 **Green** — wire the state branches until 5.3 passes.

## 6. i18n keys

- [x] 6.1 Add `od.stopInfo.*` namespace to `viewer/messages/es.json` with: `header.title`, `header.queriedAt`, `arrival.eta.relative` ("en {minutes} min"), `arrival.eta.absolute` ("a las {time}"), `arrival.eta.now` ("Ahora"), `arrival.badge.live` ("En vivo"), `arrival.badge.scheduled` ("(horario)"), `state.loading` ("Cargando próximas llegadas…"), `state.errorEmpty` ("No hay próximos buses…"), `state.errorOtp` ("…no disponible. Reintentar…"), `state.errorNotFound` ("Esta parada no existe en el feed actual."), `state.errorNotFound.returnButton` ("Volver al inicio").

## 7. MapCanvas onClick + click handler wire

- [x] 7.1 **Red** — extend `viewer/components/od/MapCanvas.test.tsx`: assert `MapCanvas` forwards an `onStopClick` prop down to `StopMarker` (verify via the existing stub).
- [x] 7.2 **Green** — wire the prop through `MapCanvas` → `StopMarker` (the stub already swallows it; the production `StopMarker` will hand it to `google.maps.Marker.addListener('click', ...)` — runtime-only path, kept out of coverage).

## 8. OdModeShell rewires for mode-state

- [x] 8.1 **Red** — extend `viewer/components/od/OdModeShell.test.tsx`: when `useViewerMode` returns `{type:'stop-info', stopId:'X'}`, the OD inputs SHALL NOT appear in the search slot and the `StopInfoCard` (stubbed) SHALL appear in the bottom sheet. When the hook returns `{type:'od'}`, the existing OD inputs + itinerary card branch SHALL render as before.
- [x] 8.2 **Green** — refactor `OdModeShell` to use `useViewerMode()` for branching. The shell mounts a `<BottomSheet open={...}>` and renders different children based on the mode. When MapCanvas dispatches `onStopClick(id)`, the shell calls `setMode({type:'stop-info', stopId: id})`.

## 9. page.tsx wires the new shell

- [x] 9.1 Confirm `app/page.tsx` continues to forward the api key + the `OdModeShell` is happy (no signature change needed — the mode switching is internal). Update `app/page.test.tsx` only if the new structure breaks an existing assertion.

## 10. Coverage + lint

- [x] 10.1 Run `npm test --coverage` inside `viewer/` and confirm 100% on stmts/branches/funcs/lines. Document any new exclusions (e.g., a runtime-only file) in `vitest.config.ts` next to existing entries.
- [x] 10.2 Run `npm run lint` and confirm green.
- [x] 10.3 Run `npx next build` and confirm the new client components compile under standalone output.

## 11. Documentation

- [x] 11.1 Update `viewer/README.md` (Spanish): add a section on mode-state (URL hash routing), the bottom-sheet primitive, the stop-info mode UX.
- [x] 11.2 Update `viewer/README.en.md` mirror.
- [ ] 11.3 Update PRD `docs/prd/mvp-v0.md` §11 mapping row for `viewer-stop-info-mode` once apply lands (mark as in-flight → done at archive time). No need to touch Q4/Q5 of §10.1.

## 12. Verification

- [x] 12.1 `npm test --coverage` green at 100/100/100/100.
- [x] 12.2 `npm run lint` green.
- [x] 12.3 `npx next build` green.
- [ ] 12.4 Manual smoke locally: `docker compose up viewer` + browser → from the OD mode, run a plan; tap any of the stop markers; the stop-info sheet opens with arrivals; close → returns to the OD mode with the itinerary intact; deep-link `http://localhost:8080/#stop=sol-antigua:3` loads directly into the mode.
- [x] 12.5 `openspec validate viewer-stop-info-mode --strict --no-interactive` → green.
- [ ] 12.6 CI `viewer.yml` + `viewer-smoke.yml` green on the apply PR.
