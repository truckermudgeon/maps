# Navigator: refactor follow-ups

Honest read on what's still rough after the controllers/ refactor wrapped
up (commits `d21a97c7..057feb2f` across `navigator-refactor` →
`navigator-refactor-continue` → `navigator-refactor-last-for-now` →
`navigator-refactor-last-for-realz`). None of these are blockers — the
codebase is in good shape — but each is a real improvement worth picking
up later.

## Status (2026-05-06)

- [x] **#4 — eager services in AppController** (commit `0931fde1`)
- [x] **#3 — drop vestigial ControlsControllerImpl** (commit `a65918f5`)
- [x] **#1 — split AppController, extract MapPresenter** (commit `65b61482`)
- [x] **#2 — extract create-app.tsx inline observers into views/** (commit `c585f935`)
- [ ] **#5 — drop handler-builder factories** — _deferred_. Without
      React Testing Library in the navigator, inlining callbacks into views
      would delete the 428 LOC of regression coverage in
      `tests/create-app-handlers.test.ts` with no equivalent replacement
      (stories aren't assertion-driven without `@storybook/test`). Revisit
      when adopting RTL.
- [ ] **#6 — drop `appClient` from `AppController`** — _deferred_. After
      the `RouteApi` / `SearchApi` deepening, `AppController` only holds
      `appClient` to seed `TelemetryService.start(appClient)`. Pushing
      `appClient` into `TelemetryService`'s constructor (or factory)
      would let `AppController` depend on `RouteApi` only. Out of scope
      for the api-class PR.

## A note on directory layers

Two ground rules clarify what goes where, and what's lift-able to
`packages/libs/ui/` for sharing with `apps/demo/`:

- **`components/` is hook-free.** Pure presentational — takes props,
  renders UI. Importing `@truckermudgeon/navigation/types` is fine
  (it's a workspace package), but no `useRouteStore`, no MobX
  `observer()`, no navigator-specific store shapes. **This is the
  lift-to-`libs/ui/` candidate pool.**
- **`views/` (new dir, planned in #2 below) is the observer-wrapper
  layer.** Uses hooks + `observer()` to pull store data and feed it to
  presentational components as props. Navigator-specific by design;
  never lift-able.

The followups below assume this split. In particular, **don't put
hook-using components into `components/`** — that would taint the lift
candidate pool with navigator dependencies and force a per-file audit
later.

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

Each should become a real component file in a new `views/` directory
(NOT `components/` — see "Directory layers" above). Each `views/X.tsx`
uses per-domain hooks (`useRouteStore`, `useSessionStore`, etc.) to
read store data and passes it as props to the matching presentational
component in `components/`. Wins:

- `create-app.tsx` shrinks to pure composition (~100 LOC).
- Easier to navigate — a newcomer looking for "where does the player
  marker / segment-complete toast / waiting-for-telemetry UI live?"
  gets a file path instead of a `grep` hit inside a 500-line factory.
- Unblocks #5 (drop handler factories) — once views own their callback
  wiring, click handlers can be defined inline in the view (reading
  from hooks directly) instead of being prebuilt by a factory in
  `create-app-handlers.ts`.
- Keeps `components/` hook-free, preserving its lift-to-`libs/ui/`
  status (see "Lifting to libs/ui/" below).

The migration is mechanical: each inline observer becomes a `views/X.tsx`
file + an `import` in `create-app.tsx`. The handler-callback plumbing
stays the same in the short term.

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
(split AppController)** flows nicely: each unblocks the next.

## Lifting to `libs/ui/`

Parallel concern, separate from the internal cleanups above. The team
already has a memory-pinned preference: when `apps/navigator` and
`apps/demo` would share a component or helper, prefer extracting to
`libs/ui/` over duplicating. Most of `components/` is presentational
already and would qualify — once the directory-layer split (#2) is in
place, `components/` becomes a clean lift candidate pool.

Suggested approach (its own focused PR; no dependency on the items
above except #2):

1. **Audit pass.** Walk `components/` and tag each as
   `lift-now | lift-later | navigator-only`:

   - `lift-now`: pure presentational, takes props, no maplibre, no
     navigator-specific imports beyond `@truckermudgeon/navigation/types`.
     Likely candidates: `Compass`, `Fab`, `SpeedLimit`, `LaneIcon`,
     `RouteItem`, `DestinationItem`, `AnimatedDirections`,
     `SegmentCompleteToast`, `WaitingForTelemetry`,
     `CollapsibleButtonBar`, the page components
     (`ChooseDestinationPage`, `RoutesList`, `RouteStepsList`,
     `ManageStopsPage`, `DestinationList`, `NavSheet`, `TitleControls`,
     `ChooseOnMapPage`).
   - `lift-later`: depends on maplibre source/layer ids (`SlippyMap`,
     `DestinationMarkers`, `TrailerOrWaypointMarkers`, `RoutesStyle`,
     `PlayerMarker`). Lifting these is its own PR — the source/layer
     id assumptions become a contract that `apps/demo` would need to
     match, alongside the existing map-style scaffolding in
     `libs/ui/{BaseMapStyle,GameMapStyle,Contours,SceneryTownSource}`.
   - `navigator-only`: the new `views/` dir from #2. Never lift.

2. **Lift the easy ones in batches.** Each lift is `git mv` +
   import-path updates in `apps/navigator/src/` consumers. Stories move
   too; stories at `libs/ui/` work the same way as in apps.

3. **Watch for hidden dependencies.** Things to check during the audit:
   - Does the component import from `@mui/joy` / `@mui/material`?
     `libs/ui/` should already be set up for this (most existing
     `libs/ui/` files use it); confirm.
   - Does it use `runInAction`, `observer`, MobX anything? If yes, it
     belongs in `views/`, not `components/` — split the smart vs. dumb
     parts before lifting.
   - Does it import constants like `navSheetPagesRequiringMapVisibility`
     from `controllers/constants.ts`? Either lift the relevant constants
     to `libs/ui/`, or keep the component navigator-side.
   - Does it import routing/step/maneuver types from
     `@truckermudgeon/navigation/types`? See "Lifting routing types to
     `libs/map/`" below — those types want to move first, so the lifted
     UI component imports them from `libs/map` instead of pulling
     `apis/navigation` into the dep graph of `libs/ui/`.

## Lifting routing types to `libs/map/`

Precondition / sibling concern to the `libs/ui/` lift above. Several
types in `packages/apis/navigation/types.ts` are domain types describing
the _output of routing/search_, not the wire protocol:

- `StepManeuver`, `NonTerminalStepManeuver`, `LaneHint`, `ThenHint`
- `RouteStep`, `RouteSegment`, `Route`, `RouteIndex`
- `RouteGrade`, `RouteSummary`, `RouteWithSummary`
- `SearchResult`, `SearchResultWithRelativeTruckInfo`

They want to move to `packages/libs/map/routing.ts` — the file already
exports `Mode` and `RouteKey`, and `apis/navigation/types.ts` already
imports from there. After the lift, `ActorEvent` and the rest of the
wire-protocol union in `apis/navigation/types.ts` import these types
back from `libs/map`.

What stays in `apis/navigation/types.ts`:

- `AppRouter`, `ActorEvent` — wire protocol
- `TrailerState`, `JobState`, `SegmentInfo` — app-state event payloads
- `TelemetrySample`, `GameState` — telemetry input shapes
- `Speed`, `JobLocation`, `TruckSimTelemetry` — zod-derived types

**Why this matters for the `libs/ui/` lift:** a presentational
component that takes a `Route` or `RouteStep` prop will, post-lift,
import the type from `libs/map`. Doing the routing-types lift _first_
keeps `libs/ui/`'s dep graph clean (it depends on `libs/map`, which is
already a foundation lib); deferring it forces lifted components to
either import from `apis/navigation` (pulling the entire navigator API
package into `libs/ui/`'s deps) or duplicate the types.

Order: routing-types lift → `libs/ui/` audit → individual UI lifts.
The routing-types lift is mostly mechanical (move type declarations,
update import paths), no runtime behavior change.
