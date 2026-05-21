## ADDED Requirements

### Requirement: The viewer SHALL expose a line selector entry point to the line-schedule mode

When the active viewer mode is **OD**, the viewer SHALL render a compact line-selector entry point (e.g. a small icon button in the search bar or the header chrome). When this entry point is tapped, the viewer SHALL show the four v0 line chips (3, 4, 5, 8) as the search-slot content (replacing the O→D inputs while the selector is open). Tapping a chip SHALL transition the viewer to the line-schedule mode for that line via `setMode({type:'line-schedule', shortName: '<n>'})`.

When the active mode becomes `line-schedule` (whether via the selector, the chip, or a `#line=<short>` deep link), the OD inputs SHALL NOT appear in the search slot. They reappear when the user returns to the OD mode.

#### Scenario: Selector entry point is visible in OD mode
- **WHEN** the viewer is in the OD mode (default `#` hash)
- **THEN** the search slot shows the O→D inputs plus a small "Líneas" entry point (icon button) on its right side

#### Scenario: Tapping a chip activates line-schedule
- **WHEN** the selector is open and the user taps the chip for `4`
- **THEN** the URL hash becomes `#line=4` and the search slot replaces its content with the line-schedule-mode chrome (the selector itself stays available so the user can switch lines without going back to OD)

### Requirement: The mode hook SHALL track the previously active mode for stop-info push behaviour

The `useViewerMode` hook introduced by [`viewer-stop-info-mode`](../viewer-stop-info-mode/spec.md) SHALL gain a previous-mode field. When `setMode(next, {push: true})` is called, the hook SHALL stash the current mode as previous; on the next `setMode(closeStopInfo)` (typically triggered by closing the stop-info sheet), the hook SHALL restore the stashed mode instead of defaulting to OD.

Only one level of stash is required in v0 — pushing a second stop-info on top of an existing stop-info simply replaces the stash.

#### Scenario: Stop-info pushed on top of line-schedule returns to line-schedule
- **WHEN** the active mode is `line-schedule` for `4` and the user taps a stop, dispatching `setMode({type:'stop-info', stopId: ...}, {push: true})`
- **AND** the user later closes the stop-info sheet (typically `setMode(previous)`)
- **THEN** the mode returns to `{type:'line-schedule', shortName: '4'}` — not to OD
