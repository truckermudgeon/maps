# Navigator architecture

Quick map of the navigator webapp for new contributors. Browse `src/` to
get the same picture from the file tree.

## Layers

```
            ┌────────────────────────────────────┐
            │             Stores                 │   state + computeds
            │  Session  Camera  Route  NavSheet  │   (no side effects)
            │     UI    MapPadding               │
            └────────────────────────────────────┘
                       ▲              ▲
        (read via      │              │  (commit via
         hooks /       │              │   actions or
         observer)     │              │   service writes)
                ┌──────┴───┐    ┌─────┴──────────┐
                │ Reactions│    │    Services    │
                │ (autorun │    │ (init/dispose, │
                │  /react) │    │  side effects) │
                └──────────┘    └────────────────┘
                       ▲              ▲
                       └──────┬───────┘
                              │
                React (observer components,
                AppController flow methods)
```

## Where things live

| Question                                      | Answer                                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Where does telemetry get processed?           | `services/telemetry.ts`                                                                               |
| Where does the render loop run?               | `services/route-animator.ts`                                                                          |
| Where do route layers get drawn?              | `services/route-renderer.ts`                                                                          |
| Where does the map adapter live?              | `services/map-adapter.ts` (only file importing maplibre)                                              |
| Where does camera mode live?                  | `stores/camera.ts`                                                                                    |
| Where does the route + truck position live?   | `stores/route.ts`                                                                                     |
| Where does the page-stack live?               | `stores/nav-sheet.ts` (private array, action-method API)                                              |
| Where is the theme attribute set on `<html>`? | `reactions/theme.ts`                                                                                  |
| Where do tRPC calls happen?                   | `services/route-api.ts` and `services/search-api.ts` (thin wrappers around the typed tRPC procedures) |

## Rules of thumb

1. **Stores hold state and computeds. They don't do side effects** —
   no network, no localStorage, no DOM, no maplibre. Mutations happen
   via actions; reads are observable so anything reactive picks them up.
2. **Services are stateful resources with `start()`/`stop()` (or
   equivalent) lifecycles.** They import `maplibre` (only `MapAdapter`
   does), localStorage, browser APIs, tRPC. They write to stores via
   action calls.
3. **Reactions bridge stores to services.** When a store change should
   trigger a side effect (rendering, camera move, theme attribute
   write), the `reactions/` directory wires it up. One direction:
   stores → reactions → services.
4. **The route-preview gradient animation is the documented imperative
   exception.** `RouteRenderer.renderRoutePreview(..., {animate: true})`
   uses requestAnimationFrame for smooth pacing; everything else flows
   from store changes through reactions.
5. **`AppController` and `NavSheetController` are flow-orchestration
   coordinators.** They take handler-shaped methods (onClick, onSelect)
   and translate them into store mutations + service calls. They are
   shrinking; once domain hooks land (planned, see `docs/refactor-controllers.md`)
   most of their methods will inline at the call site.

## File tree

```
src/
  stores/             ← state + computeds (Session, Camera, Route, NavSheet, UI, MapPadding)
    types.ts
  services/           ← IO, DOM, lifecycle (TelemetryService, RouteAnimator, RouteRenderer,
                        MapAdapter, ChooseOnMapService)
  reactions/          ← MobX glue (camera, route, theme)
  controllers/        ← flow-orchestration (AppController, NavSheetController) — shrinking
    app.ts            ← AppStoreImpl facade lives here too, retiring once domain hooks land
    types.ts
    constants.ts      ← NavPageKey, CameraMode, BearingMode
  util/               ← pure helpers (camera-options, route-geometry, telemetry-timeline,
                        clamp, browser)
  components/         ← React components (with .stories.tsx files for Storybook)
  tests/              ← mirrors src/ structure (stores/, util/, plus integration tests)
  create-app.tsx      ← composition root: builds the stores, services, reactions, returns <App/>
  create-app-handlers.ts  ← handler builders that the App component wires to UI
  create-app-reactions.ts ← composes the per-domain reaction modules from reactions/
  create-nav-sheet.tsx
  create-controls.tsx
  index.tsx           ← React root + tRPC client
```

## Common workflows

**Adding a new map interaction (e.g., a "share location" button):**

1. Add a method on `MapAdapter` if it touches maplibre. Otherwise add it
   to a service that already exists, or create a new service.
2. Wire the user gesture in `create-app-handlers.ts`.
3. If the interaction depends on a store change, set up a reaction in
   `reactions/`.

**Adding a new search type (e.g., truck stops):**

1. Add the tRPC procedure on the backend (`packages/apis/navigation`).
2. Add a UI handler in `controllers/nav-sheet.ts` that calls the new
   query and writes results to `NavSheetStore.destinations`.
3. The existing `destinations fit` reaction will pick up the change.

**Adding a new HUD element (e.g., heading degrees):**

1. Add a computed to `ControlsStore` (or new store if the data isn't
   already in scope).
2. Add a presentational component in `components/`.
3. Wrap it in `observer()` and read the computed.
4. Add a Storybook story.

## Things still in flight

See `docs/refactor-controllers.md` for the migration plan. Outstanding:

- **Step 8 (infrastructure landed; consumer migration in flight)** —
  `RootStore` + `RootStoreContext` + per-domain hooks
  (`useRouteStore`, `useCameraStore`, `useNavSheetStore`,
  `useSessionStore`, `useUIEnvironmentStore`, `useMapPaddingStore`)
  are wired in `create-app.tsx`. New components should reach for the
  hooks; existing prop-drilled stores can be migrated lazily.
- **Step 10 (mostly landed)** — the `(store, ...)` first-arg pattern
  is gone from both `AppController` and `NavSheetController`. The
  `AppStore` facade has been retired from services
  (`TelemetryService`, `RouteAnimator`), reactions, handlers, and
  the focused stores themselves (`MapPaddingStore`, `ControlsStore`).
  `AppStoreImpl` is still used by the App component (and a handful of
  inner observers in `create-app.tsx` / `create-nav-sheet.tsx`) as a
  flat kitchen-sink for prop/closure access; migrating those to the
  domain hooks is the last remaining piece.
