> **Implementation discipline.** This apply runs under `superpowers:test-driven-development` (`/test-driven-development`). Every "tests for X" / "implement X" pair is ordered test-first: red → green → refactor. The 100% coverage threshold from `viewer-shell-and-api` is preserved — every new file under `app/`, `components/`, `lib/` either ships a test or lands on the documented `coverage.exclude` list with a comment.

## 1. Dependency + env scaffolding

- [x] 1.1 Add `@vis.gl/react-google-maps` and `@types/google.maps` to `viewer/package.json` with exact pinned versions; run `npm install` and verify `npm run build` still passes
- [x] 1.2 Update `viewer/.env.example` with `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=` (empty placeholder + comment pointing at GCP referrer restriction docs); add `NEXT_PUBLIC_VIEWER_DEFAULT_CENTER=-34.467,-57.840` as optional override
- [x] 1.3 Document the key in `viewer/README.md` (Spanish, primary) and `viewer/README.en.md` (mirror): how to provision in GCP, the referrer restriction, and that the key ends up in the client bundle by design — security relies on the referrer fence

## 2. Plan API contract extension (`viewer-shell-and-api` modify)

- [x] 2.1 **Red** — extend `viewer/lib/otp/translate-plan.test.ts`: assert the translator now emits `legs[].legGeometry: { points: string } | null` (verbatim from the OTP raw) and `itineraries[i].fare: { regular: { cents, currency } } | null` (verbatim from OTP, `null` when absent)
- [x] 2.2 **Green** — extend `viewer/lib/otp/queries.ts` `PLAN_QUERY` to also request `legGeometry { points }` per leg and `fare { regular { cents currency } }` per itinerary; extend `viewer/lib/otp/translate-plan.ts` with the new fields on `RestLeg` + `RestItinerary` and propagation in the translator
- [x] 2.3 Update the committed fixture `viewer/test/fixtures/otp/plan-response.json` with a short encoded polyline on each leg and a `fare` block on at least one itinerary (and `null` on another) to cover both branches
- [x] 2.4 **Red** — extend `viewer/app/api/plan/route.test.ts`: assert the JSON body the route handler returns carries the new fields verbatim end-to-end (the route shouldn't strip them)
- [x] 2.5 **Green** — update the handler if necessary (likely no-op since the translator does the work) until 2.4 passes

## 3. Google Maps loader + Places helpers

- [x] 3.1 **Red** — `viewer/lib/google-maps/places-options.test.ts`: assert the exported `COLONIA_BBOX` constant matches the design's SW/NE corners and that `componentRestrictions.country === 'uy'`
- [x] 3.2 **Green** — `viewer/lib/google-maps/places-options.ts` exporting the bbox + restrictions constants
- [x] 3.3 **Red** — `viewer/lib/colors/lines.test.ts`: assert `getLineColor("3"|"4"|"5"|"8")` returns the D-07 palette values; unknown short names fall back to the indigo default
- [x] 3.4 **Green** — `viewer/lib/colors/lines.ts`
- [x] 3.5 **Red** — `viewer/lib/time/montevideo.test.ts`: assert `nowInMontevideoPlusOneMinute()` returns `{ date: 'YYYY-MM-DD', time: 'HH:MM' }` strings that round-trip through the Zod schema, and that the time is the wall-clock minute after `now` in `America/Montevideo`
- [x] 3.6 **Green** — `viewer/lib/time/montevideo.ts`

## 4. OD client shell scaffolding (no Maps SDK yet)

- [x] 4.1 **Red** — `viewer/components/od/OdModeShell.test.tsx`: render with i18n provider + `apiKey="test"`; assert the search bar and the map container slot are present and that the i18n keys for the placeholders/labels resolve. Render again with `apiKey={undefined}` and assert the API-key-missing banner copy (i18n key `od.apiKeyMissing`) appears in place of the map
- [x] 4.2 **Green** — `viewer/components/od/OdModeShell.tsx` (client component) renders the layout shell + conditional API-key banner; uses `t('od.apiKeyMissing')` for the banner copy
- [x] 4.3 Add the new keys to `viewer/messages/es.json` under the `od.*` namespace (`od.search.origin.label`, `od.search.origin.placeholder`, `od.search.destination.label`, `od.search.destination.placeholder`, `od.apiKeyMissing`, `od.card.fareUnconfirmed`, `od.state.idleHint`, `od.state.loadingLabel`, `od.state.errorOtp`, `od.state.errorInvalid`, `od.state.errorEmpty`, `od.card.duration`, `od.card.walkDistance`, `od.card.legWalk`, `od.card.legBus`)

## 5. `usePlanQuery` hook + state machine

- [x] 5.1 **Red** — `viewer/components/od/usePlanQuery.test.tsx`: mock `fetch` (or axios — match what the handler client uses); assert state transitions `idle → loading → success` on a valid response, `idle → loading → error(otp)` on `502`, `idle → loading → error(invalid)` on `400`, `idle → loading → error(empty)` on `200 { itineraries: [] }`
- [x] 5.2 **Green** — `viewer/components/od/usePlanQuery.ts`: hook taking `{from, to}` and returning `{state, data, error, mutate}`; uses `nowInMontevideoPlusOneMinute()` to build the request body
- [x] 5.3 **Red** — test cancellation: when the inputs change while a request is in flight, the result of the previous request SHALL be discarded
- [x] 5.4 **Green** — wire `AbortController` cancellation in the hook until 5.3 passes

## 6. Origin/destination inputs with Places Autocomplete

- [x] 6.1 **Red** — `viewer/components/od/OriginDestinationInputs.test.tsx`: mock `@vis.gl/react-google-maps` so the autocomplete primitive emits a synthetic `place_changed` with `{lat, lon}`; assert the parent callback (`onChange`) fires with the right shape for both inputs; assert clearing the input fires `onChange(null)`
- [x] 6.2 **Green** — `viewer/components/od/OriginDestinationInputs.tsx` (client component) wiring the autocomplete primitives + clear buttons + ARIA roles
- [x] 6.3 **Red** — assert the autocomplete primitives are configured with the Colonia bbox + Uruguay-only restriction from `lib/google-maps/places-options.ts`
- [x] 6.4 **Green** — apply the props until 6.3 passes

## 7. Map canvas + itinerary render

- [x] 7.1 **Red** — `viewer/components/od/MapCanvas.test.tsx`: mock `@vis.gl/react-google-maps`. Render with a `null` itinerary → assert one `<Map>` with the Colonia default center + zoom 15, no polylines, no markers
- [x] 7.2 **Green** — `viewer/components/od/MapCanvas.tsx` rendering an `<APIProvider>` + `<Map>` with defaults
- [x] 7.3 **Red** — render with an itinerary whose three legs are walk → bus(4) → walk: assert three polylines emitted with the right colors (gray / blue / gray) and that bus leg's `from.stopId`/`to.stopId` produce two markers
- [x] 7.4 **Green** — `viewer/components/od/LegPolyline.tsx` (or inline) decoding `legGeometry.points` with `google.maps.geometry.encoding.decodePath` and emitting `<Polyline>`; markers from `from/to` of bus legs only
- [x] 7.5 **Red** — render with a leg whose `legGeometry` is `null`: assert the polyline for that leg is omitted (no throw, other legs still render)
- [x] 7.6 **Green** — guard the decode-and-render path until 7.5 passes
- [x] 7.7 **Red** — render with a non-trivial itinerary: assert the map's `bounds` prop reflects the union of all rendered polylines' bboxes with a small padding
- [x] 7.8 **Green** — implement the bbox-union helper (covered by its own unit tests in `viewer/lib/geo/bbox.test.ts` first) and apply it

## 8. Itinerary card (bottom sheet)

- [x] 8.1 **Red** — `viewer/components/od/ItineraryCard.test.tsx`: render with a fixture itinerary `{durationSeconds:1210, walkDistanceMeters:432, fare:{regular:{cents:7500, currency:'UYU'}}, legs:[walk, bus, walk]}`; assert the header shows `20 min · 433 m`, each leg row is present with the right copy, and the fare is `UYU $75.00`
- [x] 8.2 **Green** — `viewer/components/od/ItineraryCard.tsx` (client component) — bottom sheet layout, header, legs list, fare footer
- [x] 8.3 **Red** — render with `fare: null`: assert the fare row shows the i18n value of `od.card.fareUnconfirmed` ("Consultar al chofer")
- [x] 8.4 **Green** — wire the fallback until 8.3 passes
- [x] 8.5 **Red** — `od.card.legWalk` and `od.card.legBus` interpolate dynamic values (duration, stop name, line shortName) — assert the rendered string from i18n templating contains the expected substituted values

## 9. State-driven shell composition

- [x] 9.1 **Red** — extend `OdModeShell.test.tsx`: simulate the four UI states (`idle` / `loading` / `success` / `error.*`) by driving the inputs + the mocked `usePlanQuery`; assert the right copy from the catalog appears in the bottom sheet for each state
- [x] 9.2 **Green** — compose `OdModeShell` from `OriginDestinationInputs` + `MapCanvas` + `ItineraryCard` + state branches; the shell owns the `from`/`to` client state and passes it to `usePlanQuery`
- [x] 9.3 Update `viewer/app/page.tsx` (server component) to read `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and pass it to `<OdModeShell apiKey={...} />`; remove the v0 placeholder `landing.*` copy from rendered output (keys may stay in the catalog if reused — drop if not)
- [x] 9.4 Update `viewer/app/page.test.tsx`: with the env set, assert the page renders the OD shell; with the env unset (delete the env var around the test), assert the API-key-missing banner appears

## 10. Coverage discipline + lint

- [x] 10.1 Run `npm test --coverage` inside `viewer/` and confirm 100% on stmts/branches/funcs/lines; document any new exclusions in `vitest.config.ts` next to `components/ui/**` (e.g., `lib/google-maps/loader.ts` if it must touch the global `google` at runtime)
- [x] 10.2 Run `npm run lint` and confirm green
- [x] 10.3 Run `npx next build` and confirm the OD page compiles + the standalone bundle still ships under the size budget (informational — no hard limit in v0)

## 11. Documentation

- [x] 11.1 Update `viewer/README.md`: replace the "landing placeholder" mention with the OD mode description; add a section explaining the Google Maps API key + referrer restriction (link to GCP docs); update the endpoint table noting `legGeometry` + `fare` are now in `/api/plan`'s response
- [x] 11.2 Update `viewer/README.en.md` mirror
- [x] 11.3 Update the PRD `docs/prd/mvp-v0.md` §11 mapping: mark `viewer-od-mode` as in-flight, then done at archive time; if Q4/Q5 in §10.1 need touch-ups based on apply discoveries, note them

## 12. Verification

- [x] 12.1 `npm test --coverage` green at 100/100/100/100
- [x] 12.2 `npm run lint` green
- [x] 12.3 `npx next build` green
- [ ] 12.4 Manual smoke locally: `docker compose up viewer` + browser → confirm map loads, Autocomplete suggests Colonia places, plan request returns at least one itinerary for "Terminal Buquebus → Plaza de Toros Real de San Carlos" (PRD §8.1 #2 canonical case), itinerary renders on map, card shows duration + tarifa fallback or value
- [x] 12.5 `openspec validate viewer-od-mode --strict --no-interactive` → green
- [ ] 12.6 CI: `viewer.yml` + `viewer-smoke.yml` green on the apply PR (smoke continues to exercise `/api/plan` end-to-end and the disclaimer copy in `/` HTML; mapping smoke for the map render itself is deferred)
