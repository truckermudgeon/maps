# Navigator: refactor follow-ups

Honest read on what's still rough after the controllers/ refactor wrapped
up (commits `d21a97c7..057feb2f` across `navigator-refactor` →
`navigator-refactor-continue` → `navigator-refactor-last-for-now` →
`navigator-refactor-last-for-realz`). None of these are blockers — the
codebase is in good shape — but each is a real improvement worth picking
up later.

## 1. `AppController` is still bifurcated

Two unrelated jobs share one class:

- **Map-imperative API**: `setPadding`, `setOffset`, `addMapDragEndListener`,
  `clearPitchAndBearing`, `fitPoints`, `flyTo`, `onMapLoad`,
  `renderActiveRoute`, `renderRoutePreview`, `drawStepArrow`. These are
  typed wrappers over `MapAdapter` + `RouteRenderer`.
- **User-action / orchestration methods**: `setActiveRoute`,
  `setDestinationNodeUid`, `setActiveRouteFromNodeUids`, `hideNavSheet`,
  `unpauseRouteEvents`, `synthesizeSearchResult`, `setFree`/`setFollow`/
  `setNorthLock`/`setNorthUnlock`, `forceRePair`, `requestWakeLock`,
  `toggleChooseOnMapUi`.

These have different change frequencies and audiences. Splitting:

- Move the imperative-map methods onto `MapAdapter` directly (or a thin
  `MapPresenter` shell that bundles `MapAdapter` + `RouteRenderer` +
  `ChooseOnMapService`). Components/handlers that today reach for
  `controller.fitPoints(...)` reach for `mapPresenter.fitPoints(...)`
  instead.
- Keep `AppController` for the user-action methods only, and consider
  whether several of those are now thin enough to fold further (e.g.,
  `setFree`/`setFollow` are 1-line camera writes — they could be
  `camera.setFollow()` actions on the `CameraStore` directly, the same
  way we collapsed `NavSheetController`).

Net effect: `AppController` becomes 3–5 methods of genuine
flow-orchestration. Good chance the class disappears entirely once
those methods get distributed onto stores or services.

## 2. `create-app.tsx` is ~500 LOC of inline observers

Each of these is wrapped inline in `createApp`'s factory closure:

- `_Destinations`, `_TrailerOrWaypointMarkers`, `_SlippyMap`, `_Directions`,
  `_SegmentCompleteToast`, `_RouteControls`, `_RouteStack`,
  `_WaitingForTelemetry`

Each could be a real component in `components/` that uses the per-domain
hooks (`useRouteStore`, `useSessionStore`, etc.) for its reads. Wins:

- Storybook stories become possible — current closure-bound observers
  can't be rendered standalone.
- `create-app.tsx` shrinks to pure composition (~100 LOC).
- Easier to navigate — a newcomer looking for "where does the player
  marker / segment-complete toast / waiting-for-telemetry UI live?" gets
  a file path instead of a `grep` hit inside a 500-line factory.

The migration is mechanical: each inline observer becomes a top-level
component file + an `import` in `create-app.tsx`. The handler-callback
plumbing stays the same.

## 3. `ControlsControllerImpl` is vestigial

After dropping the duplicate tRPC subscription (commit `af67ae35`), the
class has exactly one method: `onMapLoad`, which subscribes to
`map.on('move', ...)` and writes `bearing` into `ControlsStore`. The
class doesn't earn its name anymore.

Options:

- Inline into `createControls.tsx` as a one-shot effect.
- Replace with a reaction-style binding in `reactions/` that wires the
  `map.on('move')` subscription via `MapAdapter`.

Either way, drop `ControlsController` interface + impl + the wiring in
`create-app.tsx`.

## 4. `AppController.startListening` is lazy

Services (`TelemetryService`, `RouteAnimator`) are constructed on first
call instead of in the constructor:

```ts
private telemetryService: TelemetryService | undefined;
private routeAnimator: RouteAnimator | undefined;
```

…because `controlsStore` wasn't around at AppController construction
time when this was written. With `RootStore` now built up-front, that
constraint is gone. `AppController` can take `controlsStore` (or just
`rootStore`) at construction and build services eagerly. Removes the
`| undefined` field types and the `?.stop()` calls in `forceRePair` /
`startListening`.

## 5. Handler-builder factories are holdover infrastructure

`buildHideNavSheet`, `buildNavSheetHandlers`, `buildControlsHandlers`,
`buildRouteControlsHandlers` each take a deps blob (camera, route,
controller, navSheetStore, navSheetController, hideNavSheet) and return
a callbacks object. This pattern predates `RootStoreContext` + the
per-domain hooks.

Now that components have hooks, the natural shape is: each callback is
defined inline in its consuming component, reading whatever stores /
services it needs from hooks. The `build*Handlers` factories +
`HandlerDeps` shape disappear; the callbacks live next to the UI that
uses them.

This is the biggest "feels like fighting the framework" smell remaining.
Not urgent — the factories work fine — but if/when components move out
of `create-app.tsx` (item 2), this is a natural co-migration.

## Suggested order

If picking these up sequentially, **#3 (ControlsController) → #4 (eager
services) → #2 (extract observers) → #5 (drop handler factories) → #1
(split AppController)** flows nicely: each unblocks the next. Or pick #2
first as a standalone Storybook win that doesn't depend on anything
else.
