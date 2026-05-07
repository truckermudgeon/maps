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
- [x] **#5 — drop handler-builder factories** (commits `e41548d1`,
      `0daf8d14`, `3e7cb0d8`, `0687d4fe`). Adopted React Testing Library
      and `ServicesProvider` + per-service hooks; inlined all 19 callbacks
      formerly built by `buildHideNavSheet` / `buildNavSheetHandlers` /
      `buildControlsHandlers` / `buildRouteControlsHandlers` into the views
      that consume them. Then dissolved `createControls` and `createNavSheet`
      factories — `Controls`, `NavSheet`, and 7 nav-sheet pages now live as
      top-level files in `views/` (with `views/nav-sheet/` for the page
      components). `ControlsStoreImpl` joined `RootStore` with a matching
      `useControlsStore` hook. Lost the 19 pure-fn factory tests; replaced
      with per-view RTL coverage (5 + 1 + 5 + 8 = 19 cases) using a new
      `renderWithApp` fixture. Two cases (`onRouteStepClick` and
      `onWaypointsChange`) are flagged TODO in `tests/views/nav-sheet.test.tsx`
      — mechanical inlines that need heavy LaneIcon/dnd-kit stub data.
- [x] **#6 — drop `appClient` from `AppController`**. `TelemetryService`
      and `RouteAnimator` now constructed in `create-app.tsx` and
      injected into `AppController`. `AppController` constructor lost
      `session`, `mapAdapter`, `controlsStore`, and `appClient` (10 →
      8 deps); `TelemetryService.start()` is argless.

## A note on directory layers

Two ground rules clarify what goes where, and what's lift-able to
`packages/libs/ui/` for sharing with `apps/demo/`:

- **`components/` is hook-free.** Pure presentational — takes props,
  renders UI. Importing `@truckermudgeon/navigation/types` is fine
  (it's a workspace package), but no `useRouteStore`, no MobX
  `observer()`, no navigator-specific store shapes. **This is the
  lift-to-`libs/ui/` candidate pool.**
- **`views/` (incl. `views/nav-sheet/`) is the observer-wrapper layer.**
  Uses hooks + `observer()` to pull store/service data and feed it to
  presentational components as props. Navigator-specific by design;
  never lift-able.

The followups below assume this split. In particular, **don't put
hook-using components into `components/`** — that would taint the lift
candidate pool with navigator dependencies and force a per-file audit
later.

## Lifting to `libs/ui/`

Parallel concern, separate from the internal cleanups above. The team
already has a memory-pinned preference: when `apps/navigator` and
`apps/demo` would share a component or helper, prefer extracting to
`libs/ui/` over duplicating. Most of `components/` is presentational
already and would qualify — once the directory-layer split (#2) is in
place, `components/` becomes a clean lift candidate pool.

Suggested approach (its own focused PR):

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
