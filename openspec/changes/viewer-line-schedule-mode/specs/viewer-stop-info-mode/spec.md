## MODIFIED Requirements

### Requirement: The viewer SHALL expose a tap-on-stop "stop info" mode activated by URL hash `#stop=<gtfsId>`

The viewer SHALL recognise a URL hash of the form `#stop=<gtfsId>` (URL-encoded as needed) as a request to render the stop-info mode for the named stop. The mode MAY also be activated programmatically by tap on a stop marker rendered on the map canvas — **from any active mode** that exposes stop markers (OD itineraries, or the line-schedule trazado).

Closing the mode (back button, close icon, swipe-down on the sheet, or ESC) SHALL return the viewer to the mode previously active (default: OD; if line-schedule was active when stop-info was pushed, return there per the mode-hook stash behaviour declared in the `viewer-od-mode` delta of this change).

#### Scenario: Deep-link loads the stop-info mode
- **WHEN** the user opens `https://demo/#stop=sol-antigua:3` for the first time
- **THEN** the app renders the chrome + the map canvas + the stop-info bottom sheet for stop `sol-antigua:3`, without first showing the OD mode

#### Scenario: Tapping a stop marker on the map activates the mode
- **WHEN** the user taps a `StopMarker` rendered for an OD itinerary leg **OR** for a line-schedule trazado
- **THEN** the URL hash updates to `#stop=<id>`, and the stop-info bottom sheet opens for that stop while the existing map content remains visible

#### Scenario: Closing the sheet returns to the previous mode
- **WHEN** the stop-info sheet was opened from any mode and the user closes the sheet
- **THEN** the URL hash returns to the prior mode marker (e.g. `#` for OD, or `#line=4` for line-schedule), and the previously rendered content is intact (no map remount)
