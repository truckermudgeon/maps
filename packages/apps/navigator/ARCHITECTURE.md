# Navigator architecture

Quick map of the navigator webapp for new contributors. Browse `src/`
to get the same picture from the file tree.

## Layers

```
            ┌────────────────────────────────────┐
            │             Stores                 │   state + computeds
            │  Session  Camera  Route  NavSheet  │   (no side effects)
            │     UI    MapPadding  Controls     │
            └────────────────────────────────────┘
                  ▲           ▲           ▲
                  │           │           │
            ┌─────┴─────┐ ┌───┴────┐ ┌────┴─────┐
            │ Reactions │ │Services│ │Controllrs│
            │ (autorun  │ │(start/ │ │(flow     │
            │  /react)  │ │ stop)  │ │ orch.)   │
            └───────────┘ └────────┘ └──────────┘
                  ▲           ▲           ▲
                  └─────┬─────┴─────┬─────┘
                        │           │
                  views/ (observer  containers)
                        │
                  components/ (pure presenters)
```

## Where things live

| Question                                                         | Answer                                                                                     |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Where does telemetry get subscribed/decoded?                     | `services/telemetry.ts`                                                                    |
| Where does the playback loop run?                                | `services/telemetry-player.ts`                                                             |
| Where do route layers get drawn?                                 | `services/route-renderer.ts`                                                               |
| Where do MapLibre calls happen?                                  | `services/map/` — split into MapHandle (lifecycle + refs), MapMarkers, MapCamera, MapStyle |
| Where do tRPC calls happen?                                      | `services/route-api.ts` and `services/search-api.ts`                                       |
| Where does camera mode live?                                     | `stores/camera.ts` (computed of `userDetached` + page policy)                              |
| Where does the route + truck position live?                      | `stores/route.ts`                                                                          |
| Where does the page-stack live?                                  | `stores/nav-sheet.ts` (private array, action-method API)                                   |
| Where do `NavPageKey` / `CameraMode` / `BearingMode` enums live? | Beside their owning store — `stores/nav-sheet.ts` and `stores/camera.ts`                   |
| Where is the theme attribute set on `<html>`?                    | `reactions/theme.ts`                                                                       |
| Where do view containers (observers) live?                       | `src/views/` — read stores, dispatch to controllers, render presenters                     |
| Where do presenter components live?                              | `src/components/` — pure UI, no store/controller imports (ESLint-enforced)                 |
| Where do tests live?                                             | Beside the code, in `<domain>/tests/` (e.g. `stores/tests/`, `views/tests/`)               |

## Rules of thumb

1. **Stores hold state and computeds. No side effects** — no network,
   no localStorage, no DOM, no maplibre. Mutations go through actions;
   reads are observable so reactive consumers pick them up. Cross-store
   policy can live as a getter (e.g. `NavSheetStore.requiresFreeCamera`,
   `currentPageRequiresMapVisibility`) — that's how `CameraStore.cameraMode`
   stays a computed instead of a flag flipped imperatively from ten
   places.

2. **Services own stateful resources with `start()`/`stop()` (or
   equivalent) lifecycles.** They import `maplibre` (only `services/map/`
   should), localStorage, browser APIs, tRPC. They write to stores via
   action calls. `TelemetryPlayer` owns the `setInterval`-driven
   playback loop that drives the player marker + follow camera +
   active-route progress gradient.

3. **`services/map/` is the single maplibre boundary.** Anything that
   imports from `maplibre-gl` / `react-map-gl/maplibre`, calls a method
   on `MapRef`, or manages a map-attached DOM artifact (markers, etc.)
   belongs in one of the four classes:

   - **`MapHandle`** — load lifecycle, ref custody, generic event
     listeners (`addMapDragEndListener`, `onBearingChange`).
   - **`MapMarkers`** — player marker + choose-on-map marker. Tracks
     last player pose for follow-cam interpolation.
   - **`MapCamera`** — camera ops (`fitPoints`, `flyTo`,
     `clearPitchAndBearing`, `setPadding`, `setOffset`,
     `beginFollowCamera`).
   - **`MapStyle`** — source data + layer paint + visibility, used
     by `RouteRenderer`.

   Consumers take only the classes they need. Callers get high-level
   methods; they should not see `Marker` or `LngLat` types.
   `MapHandle.getMap()` / `getPlayerMarker()` are marked `@internal`
   for sibling-only use; outside `services/map/`, go through the
   appropriate sibling.

4. **Reactions bridge stores to services.** When a store change should
   trigger a side effect (rendering, camera move, theme attribute
   write), the `reactions/` directory wires it up. One direction:
   stores → reactions → services. `MapHandle.isMapLoaded` is exposed
   as the one observable on the adapter group so reactions can replay
   renderers that fired before MapGl finished loading (e.g. a
   `routeUpdate` from telemetry beating onLoad).

5. **The route-preview gradient animation is the documented imperative
   exception.** `RouteRenderer.renderRoutePreview(..., {animate: true})`
   uses `requestAnimationFrame` for smooth pacing; everything else
   flows from store changes through reactions or through the playback
   loop.

6. **`AppController` and `NavSheetController` coordinate flow.**
   Their methods sequence cross-domain or async-IO work — anything
   that's _just_ a state mutation lives as an action on the relevant
   store instead. If a controller method ends up being
   `this.store.X = Y` and nothing else, move it to the store.

7. **Container / presenter split.** `views/` files are MobX-`observer`
   containers — they pull from stores via hooks, dispatch to
   controllers, and pass plain props to presenters. `components/`
   files are pure UI — no store or controller imports, no
   store-driven hooks, take everything as props. Storybook stories
   live next to presenters. ESLint (`no-restricted-imports` scoped to
   `components/**`) blocks value-imports of `stores/` / `controllers/`
   from presenters; type-only imports are allowed for prop typing.

## File tree

```
src/
  stores/             ← state + computeds (Session, Camera, Route, NavSheet,
                        Controls, UIEnvironment, MapPadding) + types.ts.
                        CameraMode/BearingMode in camera.ts; NavPageKey in
                        nav-sheet.ts; co-located stores/tests/.
  services/           ← IO, DOM, lifecycle:
                          map/              — single maplibre boundary,
                                              split into MapHandle (lifecycle
                                              + refs), MapMarkers, MapCamera,
                                              MapStyle
                          TelemetryService  — tRPC subscription
                          TelemetryPlayer   — setInterval playback loop
                          RouteRenderer     — active-route + preview layers
                          RouteApi/SearchApi — tRPC delegates
                          context.tsx       — AppServices ctx + hooks
  reactions/          ← MobX glue: camera, route, theme. Co-located tests/.
  controllers/        ← flow-orchestration (AppControllerImpl,
                        NavSheetControllerImpl) + types.ts.
  views/              ← observer containers. Read stores, dispatch to
                        controllers, render components/. AppLayout is the
                        composition root (rendered by createApp).
                        Co-located tests/ (with _helpers/).
  components/         ← pure presenters — hook-free, take props. Lift-able
                        to packages/libs/ui/ for sharing with apps/demo.
                        ESLint blocks value-imports of stores/controllers.
  util/               ← pure helpers (camera-options, route-geometry,
                        telemetry-timeline, route-bounds, route-display,
                        clamp, browser, to-compass-point). Co-located tests/.
  create-app.tsx      ← composition root: builds stores/services/reactions,
                        wires the controller graph, returns the App.
  index.tsx           ← React root + tRPC client.
  index.css, dev-tools.ts
```

## Common workflows

**Adding a new map interaction (e.g., a "share location" button):**

1. If it touches maplibre, add a method to the appropriate
   `services/map/` class (MapHandle / MapMarkers / MapCamera /
   MapStyle). Otherwise reach for an existing service or create a
   new one.
2. Wire the gesture in a `views/` observer (e.g. as a click handler
   that calls into a controller method or store action).
3. If the interaction depends on a store change, set up a reaction in
   `reactions/` instead of dispatching imperatively.

**Adding a new search type (e.g., truck stops):**

1. Add the tRPC procedure on the backend (`packages/apis/navigation`).
2. Add a method on `NavSheetControllerImpl` that calls the new query
   and writes results to `NavSheetStore.destinations`.
3. The existing destinations-fit reaction picks up the change.

**Adding a new HUD element (e.g., heading degrees):**

1. Add a computed to `ControlsStore` (or a new store if the data isn't
   already in scope).
2. Add a presenter in `components/` that takes the value as a prop +
   write a Storybook story.
3. Add an `observer` wrapper in `views/` that reads the computed and
   renders the presenter.

**Adding a new page to the nav sheet:**

1. Add a `NavPageKey` enum case in `stores/nav-sheet.ts`. Update
   `NavSheetStore.title` (and `requiresFreeCamera` /
   `currentPageRequiresMapVisibility` if the page has a map-policy).
2. Add a presenter in `components/<NewPage>.tsx` and an observer in
   `views/nav-sheet/<NewPage>.tsx`.
3. Mount the new page from `views/CurrentNavPage.tsx`.

## Open follow-ups

- `services/{route,search}-api.ts` are thin tRPC delegates. They're
  intentional seams (deepened in commit `2ad20b29` to enable mocking
  without `vi.mock`); keep until that mocking style stops paying off.
