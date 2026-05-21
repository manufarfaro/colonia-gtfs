> **Implementation discipline.** This apply runs under `superpowers:test-driven-development`. Every "tests for X" / "implement X" pair is ordered test-first: red → green → refactor. The 100% coverage threshold is preserved.
>
> **Order constraint:** This apply MUST follow `viewer-stop-info-mode` (which introduces `useViewerMode` + the `BottomSheet` primitive). If the prerequisite is missing from `main` at apply time, pause and surface the dependency.

## 1. Line selector entry point

- [ ] 1.1 **Red** — `viewer/components/line-schedule/LineSelector.test.tsx`: render with `lines=[3,4,5,8]` and an `onPickLine` mock. Assert: a chip per line is rendered with `data-testid="line-chip-<n>"`; each chip has the color class derived from `getLineColor(<n>)`; clicking a chip fires `onPickLine('<n>')`.
- [ ] 1.2 **Green** — `viewer/components/line-schedule/LineSelector.tsx`: chips list + onClick wiring + Tailwind color tokens for each chip.
- [ ] 1.3 **Red** — i18n: the selector header reads `od.lineSchedule.selector.label` ("Líneas"); each chip's `aria-label` reads `od.lineSchedule.selector.lineLabel` interpolated with the line short name.
- [ ] 1.4 **Green** — wire `useTranslations('od.lineSchedule.selector')` + the aria-labels until 1.3 passes.

## 2. Line query hook

- [ ] 2.1 **Red** — `viewer/components/line-schedule/useLineQuery.test.tsx`: mock fetch. Assert: state machine `idle → loading → success` on 200; `error.notFound` on 404; `error.otp` on 502; result data shape matches R-06 `RestLineResponse` (line + directions + shape). No periodic polling — only re-fetch when `shortName` changes.
- [ ] 2.2 **Green** — `viewer/components/line-schedule/useLineQuery.ts`: hook that fetches once per `shortName`, AbortController cleanup on change/unmount.

## 3. Vehicles query hook (poll 15s)

- [ ] 3.1 **Red** — `viewer/components/line-schedule/useVehiclesQuery.test.tsx`: mock fetch + faketimers (only `setInterval/setTimeout/Date`). Assert: idle when `shortName === null`; loading → success on entry; second poll fires at ~15s; switching shortName aborts the in-flight and starts a fresh poll immediately for the new line; empty `vehicles: []` resolves to `state: 'success'` with `data.vehicles = []` (per `viewer-shell-and-api` R-07, the endpoint returns 200 even when the bridge is down).
- [ ] 3.2 **Green** — `viewer/components/line-schedule/useVehiclesQuery.ts`: poll cadence 15s + abort wiring.
- [ ] 3.3 **Red** — assert `signal.aborted` after switch: build a fetch that resolves slowly + verify the previous AbortController fires before the new request goes out.
- [ ] 3.4 **Green** — finalise the abort wiring until 3.3 passes.

## 4. LineScheduleCard (sheet content)

- [ ] 4.1 **Red** — `viewer/components/line-schedule/LineScheduleCard.test.tsx`: render with the line 4 fixture (2 directions with scheduled departures). Assert: header shows `"Línea 4"` (from response, not i18n) + `longName`; 2 tabs rendered with headsigns from the data; default tab is `directionId === 0`; switching tabs swaps the visible scheduled-departures list.
- [ ] 4.2 **Green** — `viewer/components/line-schedule/LineScheduleCard.tsx`: header + tabs + scheduled departures list.
- [ ] 4.3 **Red** — single-direction lines: when `directions.length === 1`, no tab bar is rendered; the scheduled departures display directly under the header.
- [ ] 4.4 **Green** — wire the conditional until 4.3 passes.
- [ ] 4.5 **Red** — tap-on-stop within the sheet: when the sheet renders an interactive list of stops and the user clicks one, `onStopClick(stopId)` fires (the parent shell wires this to `setMode({type:'stop-info', ...}, {push: true})`).
- [ ] 4.6 **Green** — implement the stops list with the onClick prop until 4.5 passes.

## 5. MapCanvas: line layer

- [ ] 5.1 **Red** — extend `viewer/components/od/MapCanvas.test.tsx`: pass `lineLayer={{ directions, vehicles }}` while `itinerary` is null. Assert: one polyline per direction with `data-color="line-<short>"`; one stop marker per stop across directions; one vehicle marker per vehicle entry. With both `itinerary` and `lineLayer` provided, lineLayer wins (modes are mutually exclusive — render only one).
- [ ] 5.2 **Green** — add the `lineLayer` prop + the rendering branches. The lineLayer's stop markers should ALSO use the existing `onStopClick` plumbing — tap-on-stop works the same as in OD.
- [ ] 5.3 **Red** — bounds: when `lineLayer` is set and no `itinerary`, the map fits the union of the line's polyline coordinates (boundsOfPaths helper already exists from `viewer-od-mode`); no remount of the map between OD plan changes and line mode entry.
- [ ] 5.4 **Green** — wire the bbox until 5.3 passes.

## 6. VehicleMarker primitive

- [ ] 6.1 **Red** — `viewer/components/line-schedule/VehicleMarker.test.tsx`: with the existing pattern (stub `@vis.gl/react-google-maps`), assert that `<VehicleMarker label="L4" position={{...}} bearing={90} />` renders with the line color and exposes its bearing as a data attribute on the stub.
- [ ] 6.2 **Green** — `viewer/components/line-schedule/VehicleMarker.tsx`: the runtime path uses `new google.maps.Marker(...)` (runtime-only, excluded from coverage). The stubbed-test path exercises the prop wiring.
- [ ] 6.3 Update `vitest.config.ts` to add `components/line-schedule/VehicleMarker.tsx` to `coverage.exclude` (next to `LegPolyline.tsx` / `OdAutocompleteInput.tsx`).

## 7. OdModeShell extension

- [ ] 7.1 **Red** — extend `viewer/components/od/OdModeShell.test.tsx`: when `useViewerMode` returns `{type:'line-schedule', shortName:'4'}`, the search slot SHALL show the `LineSelector` (stubbed), the bottom sheet SHALL show the `LineScheduleCard` (stubbed), and `<MapCanvas>` SHALL receive `lineLayer` (stubbed). The OD inputs SHALL NOT appear.
- [ ] 7.2 **Green** — extend the `OdModeShell` mode switch to handle `line-schedule`. The shell composes `useLineQuery` + `useVehiclesQuery` and feeds the layer prop to `MapCanvas`.

## 8. Entry point from OD (selector trigger)

- [ ] 8.1 **Red** — assert `OdModeShell` renders a "Líneas" entry button when the mode is OD. Clicking it sets the mode to `line-schedule` (with no shortName initially, showing the selector but no layer rendered yet) — OR opens the selector inline. v0 picks one of these UX paths; the test pins whichever the implementation chooses.
- [ ] 8.2 **Green** — implement the entry path until 8.1 passes.

## 9. Stop-info push from line-schedule

- [ ] 9.1 **Red** — assert that when `useViewerMode` returns `{type:'line-schedule', shortName:'4'}` and a tap-on-stop fires, `setMode` is called with `({type:'stop-info', stopId:'<id>'}, {push: true})` (the push flag preserved by the hook).
- [ ] 9.2 **Green** — wire the dispatch with `{push: true}` until 9.1 passes.

## 10. i18n keys

- [ ] 10.1 Add `od.lineSchedule.*` namespace to `viewer/messages/es.json` with: `selector.label`, `selector.lineLabel` (interpolation), `selector.openLabel` ("Líneas"), `card.directionLabel`, `card.scheduledDeparturesLabel`, `state.loading`, `state.errorOtp`, `state.errorNotFound`, `vehicles.noLive` ("Sin posiciones en vivo").

## 11. Coverage + lint + build

- [ ] 11.1 `npm test --coverage` → 100/100/100/100 with updated exclusions documented.
- [ ] 11.2 `npm run lint` green.
- [ ] 11.3 `npx next build` green.

## 12. Documentation

- [ ] 12.1 Update `viewer/README.md` (Spanish): section "Modo line-schedule" describing the selector + the map layer + the sheet + the poll cadence.
- [ ] 12.2 Update `viewer/README.en.md` mirror.
- [ ] 12.3 Update PRD `docs/prd/mvp-v0.md` §11 mapping row for `viewer-line-schedule-mode` when archive time comes. Marks the v0 PRD §8.1 #5 acceptance criterion as covered.

## 13. Verification

- [ ] 13.1 `npm test --coverage` green at 100/100/100/100.
- [ ] 13.2 `npm run lint` green.
- [ ] 13.3 `npx next build` green.
- [ ] 13.4 Manual smoke locally: `docker compose up viewer` + browser → from the OD mode, tap "Líneas" → chips appear → tap "4" → map redraws with the line trazado + stops + vehicles markers (if the AVL fixture has matches for line 4). Sheet shows two tabs with scheduled departures. Tap a stop → stop-info sheet opens on top, close → returns to line-schedule. Deep-link `http://localhost:8080/#line=4` loads directly into the mode.
- [ ] 13.5 `openspec validate viewer-line-schedule-mode --strict --no-interactive` → green.
- [ ] 13.6 CI `viewer.yml` + `viewer-smoke.yml` green on the apply PR.
